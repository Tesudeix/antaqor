const express = require('express');
const router = express.Router();
const JobApplication = require('../models/JobApplication');
const Notification = require('../models/Notification');
const { broadcast } = require('./notifications');
const { requireAdmin } = require('../middleware/auth');

// Submit job application (public)
router.post('/', async (req, res) => {
  try {
    const { position, name, phone, age, experience, message } = req.body;
    if (!position || !name || !phone) {
      return res.status(400).json({ error: 'Position, name and phone are required' });
    }
    const application = await JobApplication.create({ position, name, phone, age, experience, message });

    // Create notification for admin
    const notif = await Notification.create({
      type: 'anket',
      title: `Шинэ анкет: ${position}`,
      message: `${name} (${phone}) — ${position} албан тушаалд анкет илгээлээ`,
      refId: application._id
    });

    // Push real-time to admin
    broadcast({ event: 'new_notification', notification: notif });

    res.status(201).json({ message: 'Application submitted successfully', application });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all applications (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const applications = await JobApplication.find().sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update application status (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const app = await JobApplication.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!app) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json(app);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete application (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const app = await JobApplication.findByIdAndDelete(req.params.id);
    if (!app) return res.status(404).json({ error: 'Олдсонгүй' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
