const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'joybilliard_secret_key_change_in_production';

// Generate JWT token (inspired by Antaqor JWT strategy)
function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Auth middleware - require logged in
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'Хэрэглэгч олдсонгүй' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token буруу эсвэл хугацаа дууссан' });
  }
}

// Admin middleware (inspired by Antaqor: role-based check)
async function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Админ эрх шаардлагатай' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token буруу эсвэл хугацаа дууссан' });
  }
}

module.exports = { generateToken, requireAuth, requireAdmin, JWT_SECRET };
