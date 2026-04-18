const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { requireAdmin } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    cb(null, `vid_${Date.now()}${ext}`);
  }
});
const videoUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.webm', '.mov'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only mp4, webm, mov allowed'));
  }
});

// Image upload via multer
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `img_${Date.now()}${ext}`);
  }
});
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only png, jpg, jpeg, gif, webp allowed'));
  }
});

// POST /api/upload/image — multipart file upload
router.post('/image', requireAdmin, (req, res) => {
  imageUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image file' });
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

// POST /api/upload — base64 image
router.post('/', requireAdmin, (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });
    const matches = image.match(/^data:([A-Za-z0-9\-+\/.]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid image format' });
    const ext = (filename || 'image.png').split('.').pop().toLowerCase();
    const allowed = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    if (!allowed.includes(ext)) return res.status(400).json({ error: 'Invalid file type' });
    const name = `img_${Date.now()}.${ext}`;
    const buffer = Buffer.from(matches[2], 'base64');
    fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);
    res.json({ url: '/uploads/' + name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload/video — multipart or base64
router.post('/video', requireAdmin, (req, res) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    videoUpload.single('video')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'No video file' });
      res.json({ url: '/uploads/' + req.file.filename });
    });
    return;
  }
  try {
    const { video, filename } = req.body;
    if (!video) return res.status(400).json({ error: 'No video provided' });
    const matches = video.match(/^data:([A-Za-z0-9\-+\/.]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid video format' });
    const ext = (filename || 'video.mp4').split('.').pop().toLowerCase();
    if (!['mp4', 'webm', 'mov'].includes(ext)) return res.status(400).json({ error: 'Only mp4/webm/mov' });
    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 100 * 1024 * 1024) return res.status(400).json({ error: 'Too large' });
    const name = `vid_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);
    res.json({ url: '/uploads/' + name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
