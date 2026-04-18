const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
  heroSections: [{
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    image: { type: String, default: '' },
    video: { type: String, default: '' },
    ctaText: { type: String, default: '' },
    ctaLink: { type: String, default: '' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  }],
  announcement: {
    text: { type: String, default: '' },
    active: { type: Boolean, default: false },
  },
  deliveryInfo: { type: String, default: 'Улаанбаатар хотод хүргэлт үнэгүй' },
  contactPhone: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  socialLinks: {
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
  },
}, { timestamps: true });

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
