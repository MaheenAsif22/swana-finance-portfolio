'use strict';

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const CategoryModel    = require('../models/category.model');

router.use(authenticate);

// GET /api/categories
router.get('/', (req, res) => res.json(CategoryModel.listAll()));

// GET /api/categories/payees
router.get('/payees', (req, res) => res.json(CategoryModel.listPayees()));

// GET /api/categories/accounts
router.get('/accounts', (req, res) => res.json(CategoryModel.listAccounts()));

module.exports = router;
