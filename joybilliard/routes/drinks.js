const express = require('express');
const router = express.Router();
const Drink = require('../models/Drink');

// Get all drinks
router.get('/', async (req, res) => {
  try {
    const filter = { available: true };
    if (req.query.type && req.query.type !== 'all') {
      filter.type = req.query.type;
    }
    const drinks = await Drink.find(filter).sort({ order: 1 });
    res.json(drinks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
