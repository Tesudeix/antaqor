const express = require('express');
const router = express.Router();
const SiteSettings = require('../models/SiteSettings');
const { requireAdmin } = require('../middleware/auth');

async function getSettings() {
  let settings = await SiteSettings.findOne();
  if (!settings) {
    settings = await SiteSettings.create({
      heroSections: [
        { title: 'HEROWATER', subtitle: 'Цэвэр. Премиум. Усны шинэ стандарт.', image: '', ctaText: 'Захиалах', ctaLink: '/products.html', order: 0, active: true },
      ],
      contactPhone: '+976 9999 0000',
      contactEmail: 'info@herowater.mn',
    });
  }
  return settings;
}

// GET /api/settings/public — public
router.get('/public', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — admin update
router.put('/', requireAdmin, async (req, res) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) settings = new SiteSettings();
    Object.assign(settings, req.body);
    await settings.save();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
