const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, requireAuth } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Бүх талбарыг бөглөнө үү' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Энэ и-мэйл бүртгэлтэй байна' });
    }

    const user = await User.create({ name, email, phone, password });
    const token = generateToken(user);

    res.status(201).json({ token, user: user.toJSON() });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'И-мэйл, нууц үг оруулна уу' });
    }

    // Allow login by email or username
    const query = email.includes('@')
      ? { email: email.toLowerCase() }
      : { name: { $regex: new RegExp(`^${email}$`, 'i') } };
    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({ error: 'Нэвтрэх нэр эсвэл нууц үг буруу' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'И-мэйл эсвэл нууц үг буруу' });
    }

    const token = generateToken(user);
    res.json({ token, user: user.toJSON() });
  } catch (err) {
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
