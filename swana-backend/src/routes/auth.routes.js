'use strict';

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { validate }    = require('../middleware/validate');
const { authenticate, signToken } = require('../middleware/auth');
const UserModel = require('../models/user.model');

// POST /api/auth/login
router.post('/login',
  validate({ username: 'required', pin: 'required' }),
  (req, res) => {
    const { username, pin } = req.body;

    const user = UserModel.findByUsername(username.trim());
    if (!user || !bcrypt.compareSync(String(pin), user.pin_hash)) {
      return res.status(401).json({ error: 'Invalid username or PIN' });
    }

    const token = signToken({ id: user.id, username: user.username, role: user.role, name: user.name });

    res.json({
      token,
      user: { id: user.id, name: user.name, username: user.username, role: user.role, site: user.site },
    });
  }
);

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = UserModel.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// GET /api/auth/users  (owner only)
router.get('/users', authenticate, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Forbidden' });
  res.json(UserModel.listAll());
});

module.exports = router;
