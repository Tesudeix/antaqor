const mongoose = require('mongoose');

const karaokeRoomSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  badge:       { type: String, default: 'KARAOKE' },
  description: { type: String, default: '' },
  image:       { type: String, default: '' },
  gallery:     [{ type: String }],
  features:    [{ type: String }],
  capacity:    { type: String, default: '' },
  price:       { type: String, default: '' },
  priceUnit:   { type: String, default: '/ цаг' },
  phone:       { type: String, default: '' },
  order:       { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('KaraokeRoom', karaokeRoomSchema);
