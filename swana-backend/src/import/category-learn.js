'use strict';

/**
 * Category learning — given parsed historical transactions, build a
 * keyword → category mapping that can be used to auto-classify new
 * transactions during import.
 *
 * Strategy:
 *   1. Start with a small seed dictionary (domain-specific for Swana).
 *   2. For each historical message, look for "for X" or descriptive words.
 *   3. Count keyword co-occurrence with each seed category.
 *   4. Expand each category's keyword list with high-confidence new keywords.
 *
 * The output (categories.json) is a simple { categoryName: [keywords...] }
 * map. The importer matches each new message's body against all keywords
 * and picks the category with the most hits.
 */

// ─── Seed dictionary — based on actual chat content (authoritative) ──────────
// Words in the seed lists are protected: even if statistics suggest they
// belong elsewhere, the seed wins. This codifies domain knowledge that
// data alone can't reliably reproduce.
const SEED = {
  Fuel:        ['petrol', 'cng', 'diesel', 'gas', 'fuel'],
  Food:        ['meal', 'meals', 'naan', 'yogurt', 'tea', 'refreshment', 'refreshments', 'lunch', 'dinner', 'breakfast', 'biryani', 'fruit', 'sugar', 'biscuits', 'chicken', 'ice cream', 'icecream', 'milk', 'bread', 'rice', 'dal', 'sabzi', 'roti', 'water bottle', 'water bottles', 'cold drink', 'soft drink', 'pepsi', 'coke', 'snacks'],
  Transport:   ['fare', 'rickshaw', 'taxi', 'suzuki', 'truck', 'rent', 'bilty', 'tcs', 'leopards', 'courier', 'bykea', 'rawalpindi', 'islamabad'],
  Materials:   ['paint', 'painting', 'painter', 'copper', 'ms bar', 'steel', 'sheet', 'heet', 'ms heet', 'tape', 'brush', 'emery', 'emery paper', 'sandpaper', 'masking', 'binding', 'photocopy', 'photocopies', 'folder', 'rod', 'screw', 'bolt', 'nut', 'thinner', 'thiner', 'pipe', 'silver', 'putty', 'wall putty', 'gypsum', 'cement', 'sand', 'wire', 'cable', 'hardware'],
  Salary:      ['salary', 'advance salary', 'advance pay', 'wages', 'labor pay', 'labour pay'],
  Loan:        ['loan', 'qarz', 'qarza', 'borrowing'],
  Utilities:   ['electricity', 'wapda', 'sui gas', 'bill', 'internet', 'phone bill', 'mobile charges', 'mobile balance', 'iesco', 'ptcl', 'nayatel'],
  Maintenance: ['repairing', 'repair', 'maintenance', 'servicing', 'service', 'generator'],
  Office:      ['stationery', 'pen', 'paper', 'photocopier', 'printer', 'cartridge', 'tissue', 'soap', 'markers', 'tonner', 'toner', 'registries', 'registry'],
  Bank:        ['bank', 'cheque', 'atm', 'withdraw', 'deposit', 'challan'],
};

// ─── Stopwords excluded from keyword discovery ───────────────────────────────
const STOPWORDS = new Set([
  'rs', 'paid', 'pay', 'payment', 'req', 'request', 'received', 'recieved',
  'cash', 'cheque', 'online', 'transfer', 'to', 'from', 'for', 'of', 'and',
  'is', 'the', 'a', 'an', 'by', 'in', 'on', 'at', 'with', 'against', 'sb',
  'sahib', 'sa', 'salam', 'approved', 'confirmed', 'against', 'this', 'that',
  'these', 'those', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had',
]);

// ─── Word extraction ─────────────────────────────────────────────────────────
function tokenize(body) {
  return body
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

// ─── Category match given a body and a keyword dictionary ────────────────────
function bestCategory(body, dict) {
  if (!body) return null;
  const text = body.toLowerCase();
  let best = null, bestScore = 0;
  for (const [cat, keywords] of Object.entries(dict)) {
    let score = 0;
    for (const kw of keywords) {
      // Word-boundary match
      const re = new RegExp(`\\b${kw}\\b`, 'i');
      if (re.test(text)) score += kw.split(' ').length;   // multi-word keywords weighted higher
    }
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best;
}

// ─── Training: expand seed dictionary with high-confidence new keywords ──────
function learnCategories(transactions) {
  // transactions: [{ body, payee, ... }] — the parsed historical transactions
  const dict = JSON.parse(JSON.stringify(SEED));   // deep clone

  // Collect known payee tokens — these should never become category keywords
  // even if they co-occur frequently with a category.
  const payeeTokens = new Set();
  for (const tx of transactions) {
    if (!tx.payee) continue;
    for (const tok of tx.payee.toLowerCase().split(/\s+/)) {
      if (tok.length >= 3) payeeTokens.add(tok);
    }
  }

  // For each transaction, find its best seed-category match (if any).
  // Then count which new words co-occur with each category, AND track
  // how many DISTINCT payees they appear with (a real keyword should
  // appear across many payees; a name-leak appears with just one).
  const cooc       = {};   // { cat: { word: count } }
  const distinct   = {};   // { cat: { word: Set(payees) } }
  for (const cat of Object.keys(dict)) {
    cooc[cat]     = {};
    distinct[cat] = {};
  }

  let matched = 0, unmatched = 0;
  for (const tx of transactions) {
    const cat = bestCategory(tx.body, dict);
    if (!cat) { unmatched++; continue; }
    matched++;
    const payeeKey = (tx.payee || '<none>').toLowerCase();
    for (const w of tokenize(tx.body)) {
      if (dict[cat].includes(w))    continue;   // already a seed
      if (payeeTokens.has(w))       continue;   // looks like a person's name
      cooc[cat][w]     = (cooc[cat][w] || 0) + 1;
      distinct[cat][w] = distinct[cat][w] || new Set();
      distinct[cat][w].add(payeeKey);
    }
  }

  // Promote co-occurring words. Track which category claims each new word
  // most strongly so we can later resolve overlaps with seed lists.
  const newKeywordWinners = {};                                  // word → bestCategoryForWord
  const newKeywordScores  = {};                                  // word → bestScore
  for (const cat of Object.keys(dict)) {
    const candidates = Object.entries(cooc[cat])
      .filter(([w, count]) => count >= 5 && distinct[cat][w].size >= 4)
      .sort((a, b) => b[1] - a[1]);

    for (const [word, count] of candidates) {
      let maxOther = 0;
      for (const other of Object.keys(dict)) {
        if (other === cat) continue;
        maxOther = Math.max(maxOther, cooc[other][word] || 0);
      }
      if (count >= maxOther * 3) {
        // Only one category may own each new word — pick the strongest.
        if (!newKeywordScores[word] || count > newKeywordScores[word]) {
          newKeywordWinners[word] = cat;
          newKeywordScores[word]  = count;
        }
      }
    }
  }

  // Apply the winners
  for (const [word, cat] of Object.entries(newKeywordWinners)) {
    if (!dict[cat].includes(word)) dict[cat].push(word);
  }

  // Resolve seed-list overlaps and learned-vs-seed conflicts.
  // Rule: SEED words stay where they are originally seeded. Learned words
  // are removed from any category where they conflict with a seed word.
  const seedMap = new Map();   // word → seedCategory
  for (const [cat, kws] of Object.entries(SEED)) {
    for (const w of kws) {
      if (!seedMap.has(w)) seedMap.set(w, cat);
    }
  }

  const allWords = new Map();    // word → [cat, ...]
  for (const cat of Object.keys(dict)) {
    for (const w of dict[cat]) {
      if (!allWords.has(w)) allWords.set(w, []);
      allWords.get(w).push(cat);
    }
  }
  for (const [word, cats] of allWords.entries()) {
    if (cats.length <= 1) continue;
    // If one of the categories is the seed home, keep that one
    const seedCat = seedMap.get(word);
    let winner;
    if (seedCat && cats.includes(seedCat)) {
      winner = seedCat;
    } else {
      // Pick the category where this word appears in the most actual messages
      winner = cats[0];
      let bestCount = cooc[cats[0]][word] || 0;
      for (const c of cats.slice(1)) {
        const n = cooc[c][word] || 0;
        if (n > bestCount) { bestCount = n; winner = c; }
      }
    }
    for (const c of cats) {
      if (c !== winner) dict[c] = dict[c].filter((kw) => kw !== word);
    }
  }

  return { dict, stats: { matched, unmatched, total: transactions.length } };
}

module.exports = { learnCategories, bestCategory, SEED };
