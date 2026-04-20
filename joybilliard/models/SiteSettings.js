const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
  profileImage: { type: String, default: '/joybilliardprofile.png' },
  heroType: { type: String, enum: ['image', 'video'], default: 'image' },
  heroVideo: { type: String, default: '' },
  siteName: { type: String, default: 'JOY BILLIARD & PUB' },
  tagline: { type: String, default: 'Premium Pool Lounge · Since 2015 · Улаанбаатар' },
  phone: { type: String, default: '+976 9911 2233' },
  location: { type: String, default: 'Joy billiards' },
  locationUrl: { type: String, default: 'https://maps.app.goo.gl/9W9cpVcTaiwWHRCX8' },
  location2: { type: String, default: 'Himchan Center' },
  location2Url: { type: String, default: 'https://maps.app.goo.gl/QuybXy3ZvK2fFF5x9' },
  hours: { type: String, default: 'Өдөр бүр 11:30 - 02:00' },
  email: { type: String, default: '' },
  socialFacebook: { type: String, default: 'https://www.facebook.com/joybilliard' },
  socialFacebookOn: { type: Boolean, default: true },
  socialInstagram: { type: String, default: 'https://www.instagram.com/joybilliard' },
  socialInstagramOn: { type: Boolean, default: true },
  socialTiktok: { type: String, default: 'https://www.tiktok.com/@joybilliard' },
  socialTiktokOn: { type: Boolean, default: true },
  menuCtaText: { type: String, default: 'Хоол & Ундааны Цэс' },
  menuCtaSub: { type: String, default: '130+ төрлийн хоол, ундаа' },
  statusPills: { type: [String], default: ['11:30 - 02:00', 'VIP Өрөө', 'POOL & PUB'] },
  siteUrl: { type: String, default: 'https://joybilliard.mn' },
  heroSlides: [{ type: String }],
  alliedCompanies: [{
    name: { type: String, required: true },
    logo: { type: String, required: true },
    url: { type: String, default: '' }
  }]
}, { timestamps: true });

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
