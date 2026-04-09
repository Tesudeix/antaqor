const mongoose = require('mongoose');

const drinkSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['wine', 'spirit', 'beer', 'cocktail'], required: true },
  details: String,
  price: { type: Number, required: true },
  image: String,
  available: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Drink', drinkSchema);
