const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const Notification = require('../models/Notification');
const { broadcast } = require('./notifications');
const { requireAdmin } = require('../middleware/auth');

// Submit contact/feedback form (public)
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, branch, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ error: 'Name and message are required' });
    }
    const contact = await Contact.create({ name, phone, email, branch, message });

    // Create notification for admin
    const notif = await Notification.create({
      type: 'sanal',
      title: `Шинэ санал: ${name}`,
      message: `${name}${branch ? ' (' + branch + ')' : ''} — "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`,
      refId: contact._id
    });

    // Push real-time to admin
    broadcast({ event: 'new_notification', notification: notif });

    res.status(201).json({ message: 'Message sent successfully', contact });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all contacts (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark contact as read (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!contact) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete contact (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
