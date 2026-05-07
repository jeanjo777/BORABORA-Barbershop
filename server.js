const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { higgsfield } = require('@higgsfield/client/v2');

const app = express();
const PORT = process.env.PORT || 3000;

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

/* --- Configure Higgsfield SDK --- */
var hfKeyId = process.env.HIGGSFIELD_KEY_ID || '';
var hfKeySecret = process.env.HIGGSFIELD_KEY_SECRET || '';

if (hfKeyId && hfKeySecret) {
  higgsfield.configure({ credentials: hfKeyId + ':' + hfKeySecret });
}

/* --- Compress image for API (max 1500px, JPEG quality 85) --- */
async function compressImage(buffer) {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  let pipeline = image;
  const maxDim = 1500;

  if (metadata.width > maxDim || metadata.height > maxDim) {
    pipeline = pipeline.resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true });
  }

  const compressed = await pipeline.jpeg({ quality: 85 }).toBuffer();
  return 'data:image/jpeg;base64,' + compressed.toString('base64');
}

/*
   Available Higgsfield endpoints to try (set via HIGGSFIELD_MODEL env var):
   - flux-pro/kontext/max                    (Flux Kontext Max — image editing)
   - flux-pro/kontext/max/text-to-image      (text only, no input image)
   - nano-banana-pro/inpaint                 (Nano Banana Pro inpaint)
   - google/nano-banana-pro/edit             (Nano Banana Pro edit)
   - higgsfield-ai/soul/standard             (Soul — text to image)
   - bytedance/seedream/v4/text-to-image     (Seedream — text only)
*/
var DEFAULT_MODEL = 'flux-pro/kontext/max';

/* --- Simulate hairstyle API --- */
app.post('/api/simulate', upload.single('photo'), async function (req, res) {
  try {
    if (!hfKeyId || !hfKeySecret) {
      return res.status(500).json({ error: 'API non configurée. Contactez le barbershop.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Aucune photo reçue.' });
    }

    var prompt = req.body.prompt || 'modern fade haircut';
    var fullPrompt = 'Edit this photo: change ONLY the hairstyle to ' + prompt + '. Keep the exact same person, face, skin tone, background, and clothing. Only modify the hair.';

    /* Compress image */
    var base64Image = await compressImage(req.file.buffer);
    console.log('Image compressed:', Math.round(base64Image.length / 1024), 'KB');

    var model = process.env.HIGGSFIELD_MODEL || DEFAULT_MODEL;
    console.log('Calling Higgsfield model:', model);

    /* Call Higgsfield via SDK — handles queue + polling */
    var result = await higgsfield.subscribe(model, {
      input: {
        prompt: fullPrompt,
        image_url: base64Image,
        aspect_ratio: '3:4',
        safety_tolerance: 2
      }
    });

    console.log('Higgsfield result:', JSON.stringify(result).substring(0, 600));

    /* Extract image URL from response (try various response shapes) */
    var imageUrl = result.images?.[0]?.url
      || result.output?.images?.[0]?.url
      || result.result?.images?.[0]?.url
      || result.result?.url
      || result.sample?.url
      || result.data?.images?.[0]?.url;

    if (imageUrl) {
      return res.json({ result: imageUrl });
    }

    console.error('No image URL in result:', JSON.stringify(result));
    return res.status(502).json({ error: 'Génération terminée mais aucune image reçue.' });

  } catch (err) {
    console.error('Simulate error:', err.message || err);

    var msg = err.message || 'Erreur interne.';

    if (msg.includes('NSFW') || msg.includes('safety') || msg.includes('moderation')) {
      return res.status(400).json({ error: 'Photo rejetée par le filtre de sécurité. Essayez une autre photo.' });
    }
    if (msg.includes('credits') || msg.includes('Credits')) {
      return res.status(402).json({ error: 'Crédits Higgsfield épuisés. Contactez le barbershop.' });
    }
    if (msg.includes('timeout') || msg.includes('Timeout')) {
      return res.status(504).json({ error: 'Délai dépassé. Réessayez avec une photo plus petite.' });
    }

    return res.status(502).json({ error: msg });
  }
});

/* --- Fallback --- */
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, function () {
  var model = process.env.HIGGSFIELD_MODEL || DEFAULT_MODEL;
  var status = (hfKeyId && hfKeySecret) ? 'configured' : 'NOT configured';
  console.log('BORA-BORA Barbershop on port ' + PORT + ' (Higgsfield: ' + status + ', model: ' + model + ')');
});
