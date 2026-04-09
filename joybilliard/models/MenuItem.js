const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  category: { type: String, enum: ['beef', 'chicken', 'pasta', 'pizza', 'snack'], required: true },
  price: { type: Number, required: true },
  image: String,
  tags: [String],
  available: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
