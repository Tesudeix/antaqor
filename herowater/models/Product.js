const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  longDescription: { type: String, default: '' },
  category: {
    type: String,
    enum: ['still', 'sparkling', 'alkaline', 'mineral', 'flavored', 'bulk'],
    required: true
  },
  price: { type: Number, required: true },
  volume: { type: String, default: '' },
  packSize: { type: Number, default: 1 },
  images: [String],
  heroImage: { type: String, default: '' },
  tags: [String],
  sku: { type: String, default: '' },
  stock: { type: Number, default: 0 },
  available: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { timestamps: true });

productSchema.index({ category: 1, available: 1 });
productSchema.index({ featured: 1 });

module.exports = mongoose.model('Product', productSchema);
