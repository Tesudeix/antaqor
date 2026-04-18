const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// GET /api/products — public product list
router.get('/', async (req, res) => {
  try {
    const { category, featured } = req.query;
    const query = { available: true };
    if (category) query.category = category;
    if (featured === 'true') query.featured = true;
    const products = await Product.find(query).sort({ order: 1, createdAt: -1 }).lean();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:slug — single product
router.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, available: true }).lean();
    if (!product) return res.status(404).json({ error: 'Бүтээгдэхүүн олдсонгүй' });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
