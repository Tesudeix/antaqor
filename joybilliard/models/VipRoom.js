const mongoose = require('mongoose');

const vipRoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  badge: { type: String, default: 'VIP' },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  video: { type: String, default: '' },
  gallery: [{ type: String }],
  features: [{ type: String }],
  price: { type: String, default: '' },
  priceUnit: { type: String, default: '/ цаг' },
  phone: { type: String, default: '' },
  location: { type: String, default: '' },
  locationUrl: { type: String, default: '' },
  order: { type: Number, default: 0 },
  branch: { type: String, default: 'Салбар 1' }
}, { timestamps: true });

module.exports = mongoose.model('VipRoom', vipRoomSchema);
