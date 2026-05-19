'use strict';

/**
 * Resolver — turns parser output + knowledge files into final fields
 * with confidence scores. Runs after the parser; this is where rules
 * meet learned knowledge.
 *
 * Pipeline for each message:
 *   1. Parser extracts amount, type, raw payee (regex-based)
 *   2. Resolver maps raw payee → canonical via payees.json (fuzzy)
 *   3. If no payee found in step 1, scan body for known payee aliases
 *   4. Category from learned dict + payee-specific defaults
 *   5. Attach confidence per field so the UI can flag uncertain rows
 */

const { resolveName, normalize } = require('./name-cluster');
const { bestCategory }           = require('./category-learn');

// ─── Build a fast lookup: every alias (normalized) → canonical name ──────────
function buildAliasIndex(payees) {
  const idx = new Map();   // normAlias → canonical
  for (const p of payees) {
    for (const a of p.aliases) {
      const n = normalize(a);
      if (n.length >= 3) idx.set(n, p.canonical);
    }
  }
  return idx;
}

// ─── Build payee → common category mapping from history (optional bonus) ─────
// We don't have it pre-computed, so this just falls back to bestCategory.
// In a future iteration we could enrich payees.json with `typical_categories`.

// ─── Scan a body for any known payee mentioned as a word/phrase ──────────────
function findKnownPayeeInBody(body, aliasIdx) {
  const lower = body.toLowerCase();
  const tokens = lower.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);

  // Try multi-word matches first (longer = more specific)
  for (let len = 3; len >= 1; len--) {
    for (let i = 0; i <= tokens.length - len; i++) {
      const phrase = tokens.slice(i, i + len).join(' ');
      if (aliasIdx.has(phrase)) return aliasIdx.get(phrase);
    }
  }
  return null;
}

// ─── Main: turn a parser-classified transaction into a final record ──────────
function resolveTransaction(classified, knowledge) {
  if (classified.kind !== 'transaction') return null;

  const { payees, categories, aliasIdx } = knowledge;

  // 1. Payee resolution
  let canonicalPayee = null;
  let payeeSource    = null;                                     // 'regex' | 'body-scan' | null
  let payeeConfidence = 0;

  if (classified.payee) {
    canonicalPayee = resolveName(classified.payee, payees);
    if (canonicalPayee) {
      payeeSource     = 'regex';
      payeeConfidence = 0.9;                                     // regex match + fuzzy cluster hit
    }
  }

  if (!canonicalPayee) {
    // Fallback: scan body for a known payee alias
    const found = findKnownPayeeInBody(classified.body, aliasIdx);
    if (found) {
      canonicalPayee  = found;
      payeeSource     = 'body-scan';
      payeeConfidence = 0.6;                                     // less certain — pattern-free
    }
  }

  // 2. Category resolution
  const category = bestCategory(classified.body, categories);
  const categoryConfidence = category ? 0.7 : 0;

  // 3. Payment method inference
  const bodyLow = classified.body.toLowerCase();
  let paymentMethod = null;
  if (/\bcheque\b|\bck\b|\bcheck\b/.test(bodyLow))     paymentMethod = 'cheque';
  else if (/\bonline\b|\btransfer\b|\bbank\b/.test(bodyLow)) paymentMethod = 'online';
  else if (/\beasypay\b|\beasypaisa\b/.test(bodyLow))  paymentMethod = 'easypay';
  else if (/\bcash\b/.test(bodyLow))                   paymentMethod = 'cash';

  // 4. Overall confidence — average of available signals
  const signals = [];
  if (canonicalPayee) signals.push(payeeConfidence);
  if (category)       signals.push(categoryConfidence);
  signals.push(0.95);                                            // amount is essentially always right
  const overallConfidence = signals.reduce((s, x) => s + x, 0) / signals.length;

  return {
    date:           classified.date,
    time:           classified.time,
    sender:         classified.sender,
    type:           classified.type,
    amount:         classified.amount,
    extraAmounts:   classified.extraAmounts || [],
    payee:          canonicalPayee,
    payeeRaw:       classified.payee,
    payeeSource,
    category,
    paymentMethod,
    description:    classified.body,
    confidence:     +overallConfidence.toFixed(2),
    needsReview:    !canonicalPayee || overallConfidence < 0.7,
  };
}

module.exports = { resolveTransaction, buildAliasIndex, findKnownPayeeInBody };
