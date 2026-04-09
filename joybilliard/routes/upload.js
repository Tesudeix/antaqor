const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { requireAdmin } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');

// POST /api/upload — upload base64 image
router.post('/', requireAdmin, (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const matches = image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid image format' });

    const ext = (filename || 'image.png').split('.').pop().toLowerCase();
    const allowed = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    if (!allowed.includes(ext)) return res.status(400).json({ error: 'Invalid file type' });

    const name = `img_${Date.now()}.${ext}`;
    const buffer = Buffer.from(matches[2], 'base64');

    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);

    res.json({ url: '/uploads/' + name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload/video — upload video file via multipart
router.post('/video', requireAdmin, (req, res) => {
  try {
    const contentType = req.headers['content-type'] || '';

    // Handle base64 video (from admin panel)
    if (contentType.includes('application/json')) {
      const { video, filename } = req.body;
      if (!video) return res.status(400).json({ error: 'No video provided' });

      const matches = video.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: 'Invalid video format' });

      const ext = (filename || 'video.mp4').split('.').pop().toLowerCase();
      const allowed = ['mp4', 'webm', 'mov'];
      if (!allowed.includes(ext)) return res.status(400).json({ error: 'Only mp4, webm, mov allowed' });

      const buffer = Buffer.from(matches[2], 'base64');
      // 50MB limit
      if (buffer.length > 50 * 1024 * 1024) return res.status(400).json({ error: 'Video too large (max 50MB)' });

      const name = `hero_${Date.now()}.${ext}`;
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);

      return res.json({ url: '/uploads/' + name });
    }

    res.status(400).json({ error: 'Unsupported content type' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
