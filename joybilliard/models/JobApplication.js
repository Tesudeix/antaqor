const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema({
  position: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  age: String,
  experience: String,
  message: String,
  read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('JobApplication', jobApplicationSchema);
