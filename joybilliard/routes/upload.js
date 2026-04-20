const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { requireAdmin } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer storage for video files
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    cb(null, `vid_${Date.now()}${ext}`);
  }
});
const videoUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.webm', '.mov'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only mp4, webm, mov allowed'));
  }
});

// POST /api/upload — upload base64 image
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

// POST /api/upload/video — upload video via multipart OR base64
router.post('/video', requireAdmin, (req, res, next) => {
  const contentType = req.headers['content-type'] || '';

  // Multipart form upload (preferred — handles large files)
  if (contentType.includes('multipart/form-data')) {
    videoUpload.single('video')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'No video file provided' });
      res.json({ url: '/uploads/' + req.file.filename });
    });
    return;
  }

  // Base64 JSON fallback
  if (contentType.includes('application/json')) {
    try {
      const { video, filename } = req.body;
      if (!video) return res.status(400).json({ error: 'No video provided' });

      const matches = video.match(/^data:([A-Za-z0-9\-+\/.]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: 'Invalid video format' });

      const ext = (filename || 'video.mp4').split('.').pop().toLowerCase();
      const allowed = ['mp4', 'webm', 'mov'];
      if (!allowed.includes(ext)) return res.status(400).json({ error: 'Only mp4, webm, mov allowed' });

      const buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length > 100 * 1024 * 1024) return res.status(400).json({ error: 'Video too large (max 100MB)' });

      const name = `vid_${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);

      return res.json({ url: '/uploads/' + name });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(400).json({ error: 'Unsupported content type' });
});

module.exports = router;
