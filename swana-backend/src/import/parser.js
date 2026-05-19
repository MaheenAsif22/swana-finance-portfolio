'use strict';

/**
 * WhatsApp chat parser — extracts structured transaction data from messages.
 *
 * This is a pure, dependency-free module used by both:
 *   - The analyzer (training pass over historical chat)
 *   - The importer (production parsing of new monthly chats)
 *
 * It does NOT do name normalization or category resolution — those come
 * from the knowledge files (payees.json, categories.json) and are applied
 * by the layer above this one.
 */

// ─── Message-line extraction ─────────────────────────────────────────────────
// WhatsApp export format: [DD/MM/YYYY, HH:MM:SS] Sender: body
// Body may span multiple lines (continues until the next [date] line or EOF).
const MSG_LINE_RE = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\] ([^:]+?): ([\s\S]*?)(?=\r?\n\[\d{2}\/\d{2}\/\d{4},|\s*$)/g;

function parseChat(text) {
  const messages = [];
  let m;
  // Reset regex state on each call
  MSG_LINE_RE.lastIndex = 0;
  while ((m = MSG_LINE_RE.exec(text)) !== null) {
    const [, dd, mm, yyyy, hh, mi, ss, sender, body] = m;
    messages.push({
      date:   `${yyyy}-${mm}-${dd}`,        // ISO format
      time:   `${hh}:${mi}:${ss}`,
      sender: sender.trim(),
      body:   body.trim(),
    });
  }
  return messages;
}

// ─── Message classification ──────────────────────────────────────────────────
// Filter out system messages, deleted messages, and pure replies.
function isSystemMessage(msg) {
  const b = msg.body;
  if (!b) return true;
  if (b.startsWith('\u200E')) return true;                              // WhatsApp meta marker
  if (/^You (created|changed|added|deleted|removed)/i.test(b)) return true;
  if (/Messages and calls are end-to-end encrypted/i.test(b)) return true;
  if (/This message was deleted/i.test(b)) return true;
  if (/You deleted this message/i.test(b)) return true;
  if (b === '<Media omitted>') return true;
  if (b === 'null') return true;
  return false;
}

// "Approved", "Confirmed", "OK", "Salam" — replies/acks with no money content.
const ACK_WORDS = new Set([
  'approved', 'aproved', 'aprroved', 'confirmed', 'confirm', 'ok', 'okay',
  'noted', 'done', 'yes', 'no', 'thanks', 'thank you', 'salam', 'aoa',
  'salaam', 'walaikum salam', 'wa alaikum salam', 'jazakallah',
]);

function isAckOnly(msg) {
  const clean = msg.body.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  if (!clean) return false;
  return ACK_WORDS.has(clean);
}

// ─── Amount extraction ───────────────────────────────────────────────────────
// Handles: "Rs 1000", "Rs. 1,200,000", "Rs:500", "rs 500/-"
// Multiple amounts in one message → returns first as primary, rest as secondary.
const AMOUNT_RE = /\bRs\.?\s*[:\.]?\s*(\d[\d,]*)/gi;

function extractAmounts(body) {
  const matches = [];
  let m;
  AMOUNT_RE.lastIndex = 0;
  while ((m = AMOUNT_RE.exec(body)) !== null) {
    const n = parseInt(m[1].replace(/,/g, ''), 10);
    if (!Number.isNaN(n) && n > 0) matches.push(n);
  }
  return matches;
}

// ─── Opening balance detection ───────────────────────────────────────────────
const OPENING_RE = /\bopen(ing|i?n?g)?\s*bal(ance)?\b/i;

function isOpeningBalance(body) {
  return OPENING_RE.test(body);
}

// ─── Transaction type inference ──────────────────────────────────────────────
// Order matters — most specific patterns first.
function inferType(body) {
  const b = body.toLowerCase();

  if (/\bcheque\b/.test(b) && /\bpaid\b/.test(b))                       return 'cheque_out';
  if (/\bcheque\b/.test(b) && /\bof\s+rs/i.test(body))                  return 'cheque_out';

  if (/\bonline\s+transfer\b/.test(b))                                  return 'transfer';
  if (/\btransfer(red)?\b/.test(b) && !/online/.test(b))                return 'transfer';

  if (/\b(received|recived|recieved)\b/.test(b))                        return 'receipt';
  if (/\bcash\s+rs\b.*\b(is\s+)?received\b/.test(b))                    return 'receipt';

  if (/\breq(uest|uested)?\b/.test(b) || /\brq\b/.test(b) || /\bask(ed)?\b/.test(b))  return 'request';

  if (/\bpaid\b/.test(b) || /\bpay(ment)?\b/.test(b))                   return 'payment';
  if (/\bgiven?\b/.test(b))                                             return 'payment';
  if (/\bfor\b/.test(b))                                                return 'payment';   // weak default

  return 'payment';
}

// ─── Payee extraction ────────────────────────────────────────────────────────
// Patterns:
//   "Rs X paid to NAME for ITEM"            → payee = NAME
//   "Rs X req to NAME for ITEM"             → payee = NAME
//   "Cash Rs X received from NAME"          → payee = NAME (counterparty)
//   "Rs X to NAME"                          → payee = NAME
//   "Rs X NAME ..."                         → payee = first capitalized word(s)
// Returns trimmed name string, or null.

const STOP_WORDS = new Set([
  // Verbs and prepositions
  'cash', 'cheque', 'check', 'online', 'transfer', 'paid', 'pay', 'payment',
  'req', 'request', 'received', 'recieved', 'recived', 'for', 'to', 'from',
  'of', 'by', 'and', 'is', 'the', 'a', 'an', 'rs', 'rupees',
  // Common items that get mis-captured
  'paper', 'petrol', 'meal', 'meals', 'food', 'water', 'bottle', 'tea',
  'lunch', 'dinner', 'breakfast', 'bills', 'bill', 'rent', 'fare',
  'photocopy', 'photocopies', 'registries', 'tcs', 'leopards', 'bykea',
  'electric', 'electricity', 'salary', 'advance', 'loan', 'stamp',
  'sheet', 'paint', 'brush', 'oil', 'oxygen', 'cylinder', 'tape',
  'spray', 'clip', 'honey', 'fruit', 'chicken', 'lpg', 'cng',
  // Day/time noise
  'yesterday', 'today', 'tomorrow', 'morning', 'evening',
]);

function extractPayee(body) {
  // Strip the first "Rs X" / "Rs. X" / "Rs:X" segment (and any "of" before/after)
  const stripped = body.replace(/\b(of\s+)?Rs\.?\s*[:\.]?\s*\d[\d,]*\s*\/?-?/i, ' ');

  // Try common preposition-anchored patterns in order of reliability.
  // NAME = (optional initial like "a" or "m") + 1–3 capitalized words OR 1–2 lowercase words.
  const NOT_NAME = String.raw`(?:For|By|And|With|Is|Was|To|From|Of|The|An|Yesterday|Today|Tomorrow|Approved|Confirmed|Cash|Cheque|Online|Paid|Pay|Req|Request|Received|Recieved|Recived|Salam|Aoa)`;
  const NOT_NAME_LOW = String.raw`(?:for|by|and|with|is|was|to|from|of|the|an|yesterday|today|tomorrow|approved|confirmed|cash|cheque|online|paid|pay|req|request|received|recieved|recived|salam|aoa)`;
  // Allow a single-letter initial ("a quddus", "m faisal") OR a regular 2+-letter word.
  const INITIAL_CAP = String.raw`[A-Z]\.?\s+`;
  const INITIAL_LOW = String.raw`[a-z]\.?\s+`;
  const NAME_CAP = String.raw`(?:${INITIAL_CAP})?(?!${NOT_NAME}\b)[A-Z][A-Za-z]+(?:\s+(?!${NOT_NAME}\b)[A-Z][A-Za-z]+){0,2}`;
  const NAME_LOW = String.raw`(?:${INITIAL_LOW})?(?!${NOT_NAME_LOW}\b)[a-z][a-z]+(?:\s+(?!${NOT_NAME_LOW}\b)[a-z]+){0,1}`;
  const NAME = `(?:${NAME_CAP}|${NAME_LOW})`;
  const STOP = String.raw`(?:\s+for\b|\s+by\b|\s+against\b|\s+is\b|\s+sb\b|\s+sahib\b|\s+yesterday\b|[\.,;\n\r]|$)`;

  const patterns = [
    // "paid/given/pay/payment to NAME"
    new RegExp(String.raw`\b(?:paid|given|pay|payment)\s+to\s+(${NAME})${STOP}`, 'i'),
    // "req/requested/asked to/by NAME" — but NOT "req for X" (X is usually an item)
    new RegExp(String.raw`\b(?:req(?:uested)?|asked|ask)\s+(?:to|by)\s+(${NAME})${STOP}`, 'i'),
    // "received/recieved from/by NAME"
    new RegExp(String.raw`\b(?:received|recieved|recived)\s+(?:from|by)\s+(${NAME})${STOP}`, 'i'),
    // "given by NAME" (cheque idiom)
    new RegExp(String.raw`\bgiven\s+by\s+(${NAME})${STOP}`, 'i'),
    // "online transfer to NAME" — drop "online paid for" (too ambiguous with items)
    new RegExp(String.raw`\bonline\s+(?:transfer\s+to|transferred\s+to)\s+(${NAME})${STOP}`, 'i'),
    // "paid NAME" (no preposition, e.g. "Rs X labour paid sarfraz")
    new RegExp(String.raw`\b(?:paid|pay)\s+(${NAME})${STOP}`, 'i'),
    // Fallback: bare "to NAME" or "from NAME" (NOT "for" — that introduces items)
    new RegExp(String.raw`\b(?:to|from)\s+(${NAME})${STOP}`, 'i'),
  ];

  for (const re of patterns) {
    const m = stripped.match(re);
    if (m) {
      const name = cleanName(m[1]);
      if (name) return name;
    }
  }

  return null;
}

function cleanName(raw) {
  if (!raw) return null;
  let s = raw.trim();
  // Cut at the first newline — multi-line messages shouldn't bleed into the name
  s = s.split(/[\r\n]/)[0].trim();
  // Drop trailing "sb" / "sahib" honorifics
  s = s.replace(/\s+(sb|sahib|sahab|sa+b)\.?$/i, '');
  // Drop trailing dots and commas
  s = s.replace(/[\.,;]+$/, '').trim();
  // Reject if it's only stop words
  const tokens = s.toLowerCase().split(/\s+/);
  if (tokens.every((t) => STOP_WORDS.has(t))) return null;
  // Reject one-letter junk and reject if too long (likely picked up garbage)
  if (s.length < 2 || s.length > 40) return null;
  return s;
}

// ─── Item / description extraction (the "for X" part) ────────────────────────
function extractItem(body) {
  // "... for ITEM_DESCRIPTION" — capture everything after "for" up to end or "by"
  const m = body.match(/\bfor\s+(.{2,80}?)(?:\s+by\b|[\.;]|$)/i);
  if (m) return m[1].trim();
  return null;
}

// ─── Main: turn a parsed message into a candidate transaction ────────────────
function classifyMessage(msg) {
  if (isSystemMessage(msg))   return { kind: 'system' };
  if (isAckOnly(msg))         return { kind: 'ack',     body: msg.body };

  const amounts = extractAmounts(msg.body);

  if (isOpeningBalance(msg.body)) {
    if (amounts.length === 0) return { kind: 'unparseable', reason: 'opening-balance-no-amount' };
    return {
      kind:    'opening_balance',
      date:    msg.date,
      time:    msg.time,
      sender:  msg.sender,
      amount:  amounts[0],
      body:    msg.body,
    };
  }

  if (amounts.length === 0)   return { kind: 'no-amount', body: msg.body };

  return {
    kind:           'transaction',
    date:           msg.date,
    time:           msg.time,
    sender:         msg.sender,
    amount:         amounts[0],
    extraAmounts:   amounts.slice(1),    // for multi-amount messages
    type:           inferType(msg.body),
    payee:          extractPayee(msg.body),
    item:           extractItem(msg.body),
    body:           msg.body,
  };
}

module.exports = {
  parseChat,
  classifyMessage,
  extractAmounts,
  extractPayee,
  extractItem,
  inferType,
  isOpeningBalance,
  isSystemMessage,
  isAckOnly,
  cleanName,
};
