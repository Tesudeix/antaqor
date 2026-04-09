const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['anket', 'sanal', 'contact'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  refId: { type: mongoose.Schema.Types.ObjectId },
  read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
