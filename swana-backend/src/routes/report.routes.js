'use strict';

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate }     = require('../middleware/validate');
const ReportModel = require('../models/report.model');

router.use(authenticate);

// GET /api/reports/daily?date=YYYY-MM-DD
router.get('/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  res.json(ReportModel.dailyReport(date));
});

// GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/summary', (req, res) => {
  const to   = req.query.to   || new Date().toISOString().split('T')[0];
  const from = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  res.json(ReportModel.summaryReport(from, to));
});

// GET /api/reports/balance?date=YYYY-MM-DD
router.get('/balance', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  res.json(ReportModel.getBalance(date));
});

// GET /api/reports/balance/history?account_id=1
router.get('/balance/history', (req, res) => {
  const account_id = Number(req.query.account_id) || 1;
  res.json(ReportModel.allBalances(account_id));
});

// POST /api/reports/balance  — post / update opening balance for today
router.post('/balance',
  validate({ amount: 'required|number' }),
  (req, res) => {
    const { amount, account_id = 1 } = req.body;
    const date = new Date().toISOString().split('T')[0];

    if (Number(amount) < 0) {
      return res.status(400).json({ error: 'Amount cannot be negative' });
    }

    const result = ReportModel.upsertBalance(Number(account_id), date, Number(amount), req.user.id);
    res.status(201).json(result);
  }
);

module.exports = router;
