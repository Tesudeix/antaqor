const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Нэр оруулна уу'],
    trim: true,
    minlength: [2, 'Нэр хамгийн багадаа 2 тэмдэгт'],
    maxlength: [50, 'Нэр хамгийн ихдээ 50 тэмдэгт']
  },
  email: {
    type: String,
    required: [true, 'И-мэйл оруулна уу'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'И-мэйл буруу байна']
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  password: {
    type: String,
    required: [true, 'Нууц үг оруулна уу'],
    minlength: [6, 'Нууц үг хамгийн багадаа 6 тэмдэгт']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}, { timestamps: true });

// Hash password before save (inspired by Antaqor: bcrypt 12 rounds)
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
