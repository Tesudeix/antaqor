const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: 'Нэр, мессеж шаардлагатай' });
    // For now just log — can add DB storage or email later
    console.log(`[CONTACT] ${name} (${email || phone}): ${message}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
