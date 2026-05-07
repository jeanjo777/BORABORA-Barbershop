const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const RunwayML = require('@runwayml/sdk');
const { fal } = require('@fal-ai/client');

const app = express();
const PORT = process.env.PORT || 3000;

/* --- Configure fal.ai (used only for image hosting) --- */
var falKey = process.env.FAL_KEY || '';
if (falKey) {
  fal.config({ credentials: falKey });
}

/* --- Runway client (initialized on first use) --- */
var runwayClient = null;

function getRunwayClient() {
  if (!runwayClient) {
    var apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) throw new Error('RUNWAY_API_KEY non configurée.');
    runwayClient = new RunwayML({ apiKey: apiKey });
  }
  return runwayClient;
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

/* --- Simulate hairstyle API --- */
app.post('/api/simulate', upload.single('photo'), async function (req, res) {
  try {
    var client = getRunwayClient();

    if (!req.file) {
      return res.status(400).json({ error: 'Aucune photo reçue.' });
    }

    var stylePrompt = req.body.prompt || 'modern fade haircut';
    var promptText = 'This is a photo of @photo. Change ONLY the hairstyle to ' + stylePrompt + '. The person must be IDENTICAL to @photo — same face, same eyes, same skin tone, same background, same clothing. Only the hair changes. Photorealistic, natural lighting.';

    /* Compress and upload image to get HTTPS URL (Runway requires HTTPS, not data URI) */
    var jpegBuffer = await sharp(req.file.buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    var imageFile = new File([jpegBuffer], 'photo.jpg', { type: 'image/jpeg' });
    var imageUrl = await fal.storage.upload(imageFile);
    console.log('Image uploaded:', imageUrl, '(' + Math.round(jpegBuffer.length / 1024) + ' KB)');

    var model = process.env.RUNWAY_MODEL || 'gen4_image';
    console.log('Runway — model:', model, '| prompt:', promptText.substring(0, 80) + '...');

    /* Submit task to Runway with HTTPS URL */
    var task = await client.textToImage.create({
      model: model,
      promptText: promptText,
      ratio: '1080:1440',
      referenceImages: [
        {
          uri: imageUrl,
          tag: 'photo'
        }
      ]
    });

    console.log('Runway task created:', task.id);

    /* Wait for result (SDK handles polling) */
    var result = await task.waitForTaskOutput({ pollIntervalMs: 3000 });

    console.log('Runway task completed, outputs:', result.output?.length);

    if (result.output && result.output.length > 0) {
      return res.json({ result: result.output[0] });
    }

    console.error('Task succeeded but no output:', JSON.stringify(result));
    return res.status(502).json({ error: 'Génération terminée mais aucune image reçue.' });

  } catch (err) {
    console.error('Simulate error:', err.message || err);

    var msg = err.message || 'Erreur interne.';

    if (err.constructor?.name === 'AuthenticationError') {
      return res.status(500).json({ error: 'Clé API Runway invalide. Contactez le barbershop.' });
    }
    if (err.constructor?.name === 'RateLimitError') {
      return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans quelques minutes.' });
    }
    if (err.constructor?.name === 'TaskFailedError') {
      return res.status(502).json({ error: 'La génération a échoué. Essayez une autre photo ou un autre style.' });
    }
    if (err.constructor?.name === 'TaskTimedOutError') {
      return res.status(504).json({ error: 'Délai dépassé. Réessayez avec une photo plus petite.' });
    }
    if (msg.includes('moderation') || msg.includes('safety') || msg.includes('NSFW')) {
      return res.status(400).json({ error: 'Photo rejetée par le filtre de sécurité. Essayez une autre photo.' });
    }

    return res.status(502).json({ error: msg });
  }
});

/* --- Fallback --- */
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, function () {
  var model = process.env.RUNWAY_MODEL || 'gen4_image';
  var hasRunway = !!process.env.RUNWAY_API_KEY;
  var hasFal = !!process.env.FAL_KEY;
  console.log('BORA-BORA Barbershop on port ' + PORT + ' (Runway ' + model + ', key: ' + (hasRunway ? 'set' : 'MISSING') + ', image host: ' + (hasFal ? 'fal' : 'MISSING') + ')');
});
