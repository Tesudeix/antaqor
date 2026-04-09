const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { requireAdmin } = require('../middleware/auth');

// SSE clients list
const sseClients = [];

// Broadcast to all connected admin SSE clients
function broadcast(data) {
  sseClients.forEach(res => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// SSE stream endpoint (admin only — token via query param)
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');

router.get('/stream', async (req, res) => {
  // Auth via query param (SSE can't send headers)
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(':ok\n\n');

  sseClients.push(res);
  req.on('close', () => {
    const i = sseClients.indexOf(res);
    if (i !== -1) sseClients.splice(i, 1);
  });
});

// GET all notifications (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET unread count (admin only)
router.get('/unread', requireAdmin, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT mark as read (admin only)
router.put('/:id/read', requireAdmin, async (req, res) => {
  try {
    const notif = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!notif) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT mark all as read (admin only)
router.put('/read-all', requireAdmin, async (req, res) => {
  try {
    await Notification.updateMany({ read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.broadcast = broadcast;
