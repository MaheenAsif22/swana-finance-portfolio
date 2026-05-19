'use strict';

/**
 * Name clustering — given a frequency map of raw payee strings,
 * groups them into clusters that likely refer to the same person/vendor.
 *
 * Algorithm:
 *   1. Normalize each name (lowercase, strip honorifics, collapse spaces).
 *   2. Compute Levenshtein distance between every pair of normalized names.
 *   3. Build clusters with single-link clustering using a tunable threshold.
 *   4. Pick a "canonical" name per cluster: highest frequency, properly cased.
 *
 * Threshold rules (empirical):
 *   - Distance ≤ 1 → almost always the same (typo / one-letter diff)
 *   - Distance ≤ 2 AND name length ≥ 5 → likely the same
 *   - Substring match (one fully contains the other) → likely the same
 *
 * This module is dependency-free and runs synchronously over thousands of
 * names in milliseconds.
 */

// ─── Levenshtein distance ────────────────────────────────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Two-row DP
  let prev = Array(b.length + 1);
  let curr = Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,        // insert
        prev[j]     + 1,        // delete
        prev[j - 1] + cost,     // substitute
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// ─── Name normalization ──────────────────────────────────────────────────────
function normalize(name) {
  return name
    .toLowerCase()
    .replace(/\bsb\b|\bsahib\b|\bsahab\b|\bsaab\b/g, '')      // honorifics
    .replace(/\bnew\b|\bold\b/g, '')                          // qualifiers
    .replace(/[^a-z\s]/g, ' ')                                // punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Title-case for canonical display name ───────────────────────────────────
function titleCase(s) {
  return s.replace(/\b([a-z])([a-z]*)/gi, (_, a, rest) => a.toUpperCase() + rest.toLowerCase());
}

// ─── Shared-substring check ──────────────────────────────────────────────────
// Two names should only be considered the same if they share a meaningful
// run of characters. "Tariq" vs "Farid" have edit distance 3 but share NO
// 3-letter substring — they shouldn't cluster.
function sharesSubstring(a, b, minLen = 3) {
  if (a.length < minLen || b.length < minLen) {
    // For very short names, fall back to character overlap
    const setA = new Set(a);
    let common = 0;
    for (const ch of b) if (setA.has(ch)) common++;
    return common >= Math.min(a.length, b.length) - 1;
  }
  for (let i = 0; i <= a.length - minLen; i++) {
    if (b.includes(a.substr(i, minLen))) return true;
  }
  return false;
}

// ─── Pairwise similarity check ───────────────────────────────────────────────
function areSimilar(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;

  // Names typically share their first letter when they're variants of each other.
  // Tariq/Haris, Naeem/Naveed, Yasir/Nasir differ in their first letter and
  // should NOT cluster, even if edit distance is small.
  // Exception: when one is a multi-word name and the first word is the same.
  const aFirst = a.split(' ')[0];
  const bFirst = b.split(' ')[0];
  if (aFirst[0] !== bFirst[0]) return false;

  // Must share a 3+ character substring — kills false matches with totally
  // different name bodies that just happen to be edit-close.
  if (!sharesSubstring(a, b)) return false;

  // One contains the other (and the shorter is at least 3 chars)
  const shorter = a.length < b.length ? a : b;
  const longer  = a.length < b.length ? b : a;
  if (shorter.length >= 3 && longer.includes(shorter)) {
    const re = new RegExp(`\\b${shorter}\\b`);
    if (re.test(longer)) return true;
  }

  const d = levenshtein(a, b);

  // Strict for short names, lenient for longer ones
  if (a.length <= 4 || b.length <= 4) return d <= 1;
  if (a.length <= 7 || b.length <= 7) return d <= 2;
  return d <= 3;
}

// ─── Centroid-based clustering (avoids chain-merging) ────────────────────────
// Process names in descending frequency order. Each name either joins an
// existing cluster (if it's similar to the cluster's CENTROID, not just
// some member) or starts a new cluster. This prevents the classic single-link
// failure where A~B~C~D all chain into one giant cluster even though A and D
// have nothing in common.
function clusterNames(rawCounts) {
  // rawCounts: { "abdul quddus": 142, "a quddus": 87, ... }
  // Returns: [ { canonical, aliases: [...], frequency } ]

  const entries = Object.entries(rawCounts)
    .map(([raw, freq]) => ({ raw, norm: normalize(raw), freq }))
    .filter((e) => e.norm.length >= 2)
    .sort((a, b) => b.freq - a.freq);   // most-frequent names define centroids

  const clusters = [];   // [{ centroidNorm, centroidRaw, members: [{raw, freq}], totalFreq }]

  for (const entry of entries) {
    let best = null, bestDist = Infinity;

    // Find the cluster whose centroid is most similar (must pass threshold)
    for (const cluster of clusters) {
      if (areSimilar(entry.norm, cluster.centroidNorm)) {
        const d = levenshtein(entry.norm, cluster.centroidNorm);
        if (d < bestDist) { bestDist = d; best = cluster; }
      }
    }

    if (best) {
      best.members.push({ raw: entry.raw, freq: entry.freq });
      best.totalFreq += entry.freq;
    } else {
      clusters.push({
        centroidNorm: entry.norm,
        centroidRaw:  entry.raw,
        members:      [{ raw: entry.raw, freq: entry.freq }],
        totalFreq:    entry.freq,
      });
    }
  }

  // Build output: canonical = title-cased centroid (the highest-frequency variant)
  const result = clusters.map((c) => ({
    canonical: titleCase(c.centroidRaw),
    aliases:   c.members.map((m) => m.raw),
    frequency: c.totalFreq,
  }));

  result.sort((a, b) => b.frequency - a.frequency);
  return result;
}

// ─── Resolution: given a fresh raw name, find its canonical cluster ──────────
// Used at import time (production parsing of new chats).
function resolveName(rawName, clusters) {
  if (!rawName) return null;
  const target = normalize(rawName);
  if (!target) return null;

  // First pass: exact alias match (cheapest)
  for (const c of clusters) {
    for (const a of c.aliases) {
      if (normalize(a) === target) return c.canonical;
    }
  }

  // Second pass: fuzzy match
  let best = null, bestDist = Infinity;
  for (const c of clusters) {
    for (const a of c.aliases) {
      const d = levenshtein(target, normalize(a));
      if (d < bestDist) { bestDist = d; best = c.canonical; }
    }
  }
  // Accept only if reasonably close
  const threshold = target.length <= 4 ? 1 : (target.length <= 7 ? 2 : 3);
  if (bestDist <= threshold) return best;
  return null;       // unknown — let the caller decide what to do
}

module.exports = { clusterNames, resolveName, normalize, levenshtein };
