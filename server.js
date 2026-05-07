const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { fal } = require('@fal-ai/client');

const app = express();
const PORT = process.env.PORT || 3000;

/* --- Configure fal.ai client --- */
var falKey = process.env.FAL_KEY || '';
if (falKey) {
  fal.config({ credentials: falKey });
}

/* --- Multer for photo uploads (memory, max 10MB) --- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

/* --- Static files --- */
app.use(express.static(path.join(__dirname), {
  maxAge: '7d',
  setHeaders: function (res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

/* --- Compress image for API (max 1200px, JPEG quality 80) --- */
async function compressImage(buffer) {
  var image = sharp(buffer);
  var metadata = await image.metadata();

  var pipeline = image;
  var maxDim = 1200;

  if (metadata.width > maxDim || metadata.height > maxDim) {
    pipeline = pipeline.resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true });
  }

  var compressed = await pipeline.jpeg({ quality: 80 }).toBuffer();
  return 'data:image/jpeg;base64,' + compressed.toString('base64');
}

/* --- Simulate hairstyle API --- */
app.post('/api/simulate', upload.single('photo'), async function (req, res) {
  try {
    if (!falKey) {
      return res.status(500).json({ error: 'API non configurée. Contactez le barbershop.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Aucune photo reçue.' });
    }

    var stylePrompt = req.body.prompt || 'modern fade haircut';
    var prompt = 'Change ONLY the hairstyle to ' + stylePrompt + '. Keep the exact same person, same face, same eyes, same skin tone, same background, same clothing. Only modify the hair. Photorealistic result.';

    /* Compress image */
    var base64Image = await compressImage(req.file.buffer);
    console.log('Image compressed:', Math.round(base64Image.length / 1024), 'KB');

    var model = process.env.FAL_MODEL || 'fal-ai/flux-pro/kontext';
    console.log('fal.ai — model:', model, '| prompt:', prompt.substring(0, 80) + '...');

    /* Submit to fal.ai and wait for result */
    var result = await fal.subscribe(model, {
      input: {
        prompt: prompt,
        image_url: base64Image
      },
      pollInterval: 3000
    });

    console.log('fal.ai result received:', JSON.stringify(result.data).substring(0, 300));

    /* Extract image URL from response */
    var imageUrl = result.data?.images?.[0]?.url
      || result.data?.image?.url
      || result.data?.output?.url;

    if (imageUrl) {
      return res.json({ result: imageUrl });
    }

    console.error('No image in result:', JSON.stringify(result.data));
    return res.status(502).json({ error: 'Génération terminée mais aucune image reçue.' });

  } catch (err) {
    console.error('Simulate error:', err.message || err);

    var msg = err.message || 'Erreur interne.';

    if (msg.includes('credentials') || msg.includes('Unauthorized') || msg.includes('401')) {
      return res.status(500).json({ error: 'Clé API invalide. Contactez le barbershop.' });
    }
    if (msg.includes('NSFW') || msg.includes('safety') || msg.includes('moderation') || msg.includes('nsfw')) {
      return res.status(400).json({ error: 'Photo rejetée par le filtre de sécurité. Essayez une autre photo.' });
    }
    if (msg.includes('timeout') || msg.includes('Timeout')) {
      return res.status(504).json({ error: 'Délai dépassé. Réessayez avec une photo plus petite.' });
    }
    if (msg.includes('credits') || msg.includes('Credits') || msg.includes('402')) {
      return res.status(402).json({ error: 'Crédits épuisés. Contactez le barbershop.' });
    }

    return res.status(502).json({ error: msg });
  }
});

/* --- Fallback --- */
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, function () {
  var model = process.env.FAL_MODEL || 'fal-ai/flux-pro/kontext';
  console.log('BORA-BORA Barbershop on port ' + PORT + ' (' + model + ', key: ' + (falKey ? 'set' : 'MISSING') + ')');
});
