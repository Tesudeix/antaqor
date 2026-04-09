const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');

// Get all menu items
router.get('/', async (req, res) => {
  try {
    const filter = { available: true };
    if (req.query.category && req.query.category !== 'all') {
      filter.category = req.query.category;
    }
    const items = await MenuItem.find(filter).sort({ order: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
