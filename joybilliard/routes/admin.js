const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const MenuItem = require('../models/MenuItem');
const Drink = require('../models/Drink');
const User = require('../models/User');
const Contact = require('../models/Contact');
const JobApplication = require('../models/JobApplication');
const Notification = require('../models/Notification');

// All admin routes require admin auth
router.use(requireAdmin);

// ── STATS ──
router.get('/stats', async (req, res) => {
  try {
    const [users, menuItems, drinks, messages, applications, unreadNotifs] = await Promise.all([
      User.countDocuments(),
      MenuItem.countDocuments(),
      Drink.countDocuments(),
      Contact.countDocuments(),
      JobApplication.countDocuments(),
      Notification.countDocuments({ read: false })
    ]);

    res.json({ users, menuItems, drinks, messages, applications, unreadNotifs });
  } catch (err) {
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

// ── MENU ITEMS CRUD ──
router.get('/menu', async (req, res) => {
  try {
    const items = await MenuItem.find().sort({ order: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

router.post('/menu', async (req, res) => {
  try {
    const item = await MenuItem.create(req.body);
    res.status(201).json(item);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

router.put('/menu/:id', async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true
    });
    if (!item) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

router.delete('/menu/:id', async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

// ── DRINKS CRUD ──
router.get('/drinks', async (req, res) => {
  try {
    const items = await Drink.find().sort({ order: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

router.post('/drinks', async (req, res) => {
  try {
    const item = await Drink.create(req.body);
    res.status(201).json(item);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

router.put('/drinks/:id', async (req, res) => {
  try {
    const item = await Drink.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true
    });
    if (!item) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

router.delete('/drinks/:id', async (req, res) => {
  try {
    const item = await Drink.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

// ── MESSAGES (Contact) ──
router.get('/messages', async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 }).limit(50);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

// ── USERS ──
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

module.exports = router;
