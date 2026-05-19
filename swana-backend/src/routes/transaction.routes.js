'use strict';

const router = require('express').Router();
const { authenticate, requireOwner } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const TxModel = require('../models/transaction.model');

const TX_TYPES   = 'payment,request,receipt,cheque_out,transfer';
const TX_METHODS = 'cash,cheque,online,easypay,other';

router.use(authenticate);

// GET /api/transactions?date=&status=&type=&page=&limit=
router.get('/', (req, res) => {
  const result = TxModel.list(req.query);
  res.json(result);
});

// GET /api/transactions/pending
router.get('/pending', (req, res) => {
  res.json(TxModel.listPending());
});

// GET /api/transactions/:id
router.get('/:id', (req, res) => {
  const tx = TxModel.findById(Number(req.params.id));
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  res.json(tx);
});

// POST /api/transactions
router.post('/',
  validate({
    type:   `required|in:${TX_TYPES}`,
    amount: 'required|number|positive',
    description: 'required',
  }),
  (req, res) => {
    const { type, amount, description, payee, payment_method, category_id, account_id, ref_number, date, notes, receipt_image } = req.body;

    // Cashiers can only create payments/requests/receipts for their own account
    const approverId = (type !== 'request' && req.user.role === 'owner') ? req.user.id : null;

    const tx = TxModel.create({
      type, amount: Number(amount), description,
      payee, payment_method, category_id, account_id,
      ref_number, date, notes, receipt_image,
      created_by:  req.user.id,
      approved_by: approverId,
    });

    res.status(201).json(tx);
  }
);

// PATCH /api/transactions/:id/approve  (owner only)
router.patch('/:id/approve', requireOwner, (req, res) => {
  const tx = TxModel.findById(Number(req.params.id));
  if (!tx)                    return res.status(404).json({ error: 'Transaction not found' });
  if (tx.status !== 'pending') return res.status(400).json({ error: `Cannot approve — current status: ${tx.status}` });

  const updated = TxModel.approve(tx.id, req.user.id);
  res.json(updated);
});

// PATCH /api/transactions/:id/reject  (owner only)
router.patch('/:id/reject', requireOwner, (req, res) => {
  const tx = TxModel.findById(Number(req.params.id));
  if (!tx)                    return res.status(404).json({ error: 'Transaction not found' });
  if (tx.status !== 'pending') return res.status(400).json({ error: `Cannot reject — current status: ${tx.status}` });

  const updated = TxModel.reject(tx.id, req.user.id, req.body.reason || null);
  res.json(updated);
});

// PATCH /api/transactions/bulk-approve  (owner only)
router.patch('/bulk/approve', requireOwner, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }
  const results = [];
  for (const id of ids) {
    const tx = TxModel.findById(Number(id));
    if (tx && tx.status === 'pending') {
      results.push(TxModel.approve(tx.id, req.user.id));
    }
  }
  res.json({ approved: results.length, transactions: results });
});

module.exports = router;
