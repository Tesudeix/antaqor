const express = require('express');
const router = express.Router();
const VipRoom = require('../models/VipRoom');
const { requireAdmin } = require('../middleware/auth');

// GET all rooms (public)
router.get('/', async (req, res) => {
  try {
    const rooms = await VipRoom.find().sort({ order: 1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single room (public)
router.get('/:id', async (req, res) => {
  try {
    const room = await VipRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create (admin)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const room = await VipRoom.create(req.body);
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update (admin)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const room = await VipRoom.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true
    });
    if (!room) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE (admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const room = await VipRoom.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
