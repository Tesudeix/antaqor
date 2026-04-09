const express = require('express');
const router = express.Router();
const KaraokeRoom = require('../models/KaraokeRoom');
const { requireAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const rooms = await KaraokeRoom.find().sort({ order: 1 });
    res.json(rooms);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const room = await KaraokeRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json(room);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const room = await KaraokeRoom.create(req.body);
    res.status(201).json(room);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const room = await KaraokeRoom.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!room) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json(room);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const room = await KaraokeRoom.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
