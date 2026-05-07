const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const RunwayML = require('@runwayml/sdk');

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

/* --- Compress image for API (max 1200px, JPEG quality 80, under 5MB data URI limit) --- */
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
    var client = getRunwayClient();

    if (!req.file) {
      return res.status(400).json({ error: 'Aucune photo reçue.' });
    }

    var stylePrompt = req.body.prompt || 'modern fade haircut';
    var promptText = 'Portrait photo of @photo with a ' + stylePrompt + '. Keep the exact same person — same face, same eyes, same skin tone, same background. Only the hairstyle is different. Photorealistic, natural lighting, barbershop quality.';

    /* Compress image (Runway data URI limit: 5MB) */
    var base64Image = await compressImage(req.file.buffer);
    console.log('Image compressed:', Math.round(base64Image.length / 1024), 'KB');

    if (base64Image.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image trop lourde après compression. Essayez une photo plus petite.' });
    }

    var model = process.env.RUNWAY_MODEL || 'gen4_image';
    console.log('Runway — model:', model, '| prompt:', promptText.substring(0, 80) + '...');

    /* Submit task to Runway */
    var task = await client.textToImage.create({
      model: model,
      promptText: promptText,
      ratio: '1080:1440',
      referenceImages: [
        {
          uri: base64Image,
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

    /* Map SDK error types to user-friendly messages */
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
  var hasKey = !!process.env.RUNWAY_API_KEY;
  console.log('BORA-BORA Barbershop on port ' + PORT + ' (Runway ' + model + ', key: ' + (hasKey ? 'set' : 'MISSING') + ')');
});
