'use strict';

const express = require('express');
const crypto  = require('crypto');

const { authenticate, requireOwner } = require('../middleware/auth');
const importModel                    = require('../models/import.model');

const router = express.Router();

// Owner-only feature
router.use(authenticate, requireOwner);

// ─── POST /api/import/preview ────────────────────────────────────────────────
// Body: { chatText, sourceFile }
// Returns: { stats, transactions, openingBalances, batchId }
router.post('/preview', (req, res, next) => {
  try {
    const { chatText, sourceFile } = req.body || {};
    if (typeof chatText !== 'string' || chatText.length < 10) {
      return res.status(400).json({ error: 'chatText is required and must be the .txt content' });
    }
    if (chatText.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'Chat file too large (limit 10 MB)' });
    }
    const preview = importModel.buildPreview(chatText, sourceFile || null);
    const batchId = crypto.randomUUID();
    res.json({ ...preview, batchId });
  } catch (err) { next(err); }
});

// ─── POST /api/import/commit ─────────────────────────────────────────────────
// Body: { batchId, sourceFile, transactions, openingBalances }
// Each transaction in `transactions` may have `skip: true` to exclude it,
// or edited payee/category/date/etc. from the review UI.
router.post('/commit', (req, res, next) => {
  try {
    const { batchId, sourceFile, transactions, openingBalances } = req.body || {};
    if (!batchId || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'batchId and transactions array are required' });
    }
    const result = importModel.commit({
      rows:             transactions,
      openingBalances:  openingBalances || [],
      sourceFile:       sourceFile || null,
      batchId,
      userId:           req.user.id,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ─── GET /api/import/jobs ────────────────────────────────────────────────────
router.get('/jobs', (req, res, next) => {
  try {
    res.json(importModel.listJobs(req.query.limit || 20));
  } catch (err) { next(err); }
});

// ─── GET /api/import/knowledge ───────────────────────────────────────────────
// Returns the current payees + categories knowledge files.
router.get('/knowledge', (req, res, next) => {
  try {
    const k = importModel.getKnowledge();
    res.json({ payees: k.payees, categories: k.categories });
  } catch (err) { next(err); }
});

// ─── PUT /api/import/knowledge/payees ────────────────────────────────────────
// Body: full payees array (replaces the file). Used by the cluster editor UI.
router.put('/knowledge/payees', (req, res, next) => {
  try {
    const { payees } = req.body || {};
    if (!Array.isArray(payees)) {
      return res.status(400).json({ error: 'payees must be an array' });
    }
    importModel.savePayees(payees);
    res.json({ ok: true, count: payees.length });
  } catch (err) { next(err); }
});

// ─── PUT /api/import/knowledge/categories ────────────────────────────────────
router.put('/knowledge/categories', (req, res, next) => {
  try {
    const { categories } = req.body || {};
    if (!categories || typeof categories !== 'object') {
      return res.status(400).json({ error: 'categories must be an object' });
    }
    importModel.saveCategories(categories);
    res.json({ ok: true, categories: Object.keys(categories).length });
  } catch (err) { next(err); }
});

module.exports = router;
