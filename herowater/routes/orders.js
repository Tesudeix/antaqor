const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');

async function generateOrderNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `HW-${dateStr}-`;
  const lastOrder = await Order.findOne({ orderNumber: { $regex: `^${prefix}` } })
    .sort({ orderNumber: -1 }).lean();
  let seq = 1;
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.orderNumber.split('-').pop());
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// POST /api/orders — create order
router.post('/', async (req, res) => {
  try {
    const { customer, items, paymentMethod } = req.body;
    if (!customer?.name || !customer?.phone) {
      return res.status(400).json({ error: 'Нэр, утас шаардлагатай' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Сагс хоосон байна' });
    }

    // Validate items against DB
    const validatedItems = [];
    let subtotal = 0;
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.available) continue;
      const qty = Math.max(1, Math.min(item.quantity || 1, 999));
      validatedItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: qty,
        volume: product.volume,
      });
      subtotal += product.price * qty;
    }

    if (validatedItems.length === 0) {
      return res.status(400).json({ error: 'Бүтээгдэхүүн олдсонгүй' });
    }

    const deliveryFee = subtotal >= 50000 ? 0 : 5000;
    const total = subtotal + deliveryFee;
    const orderNumber = await generateOrderNumber();

    const order = await Order.create({
      orderNumber,
      customer,
      items: validatedItems,
      subtotal,
      deliveryFee,
      total,
      paymentMethod: paymentMethod || 'cash',
    });

    res.status(201).json({ order: { orderNumber: order.orderNumber, total: order.total, status: order.status } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/:orderNumber — track order
router.get('/:orderNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber }).lean();
    if (!order) return res.status(404).json({ error: 'Захиалга олдсонгүй' });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
