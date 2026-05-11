const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const RunwayML = require('@runwayml/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

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
    var promptText = 'A photorealistic portrait of @subject with a ' + stylePrompt + '. This is the EXACT same person as @subject — preserve every facial feature, skin tone, eye color, jawline, expression, and head shape. Keep the same lighting, background, clothing, and camera angle. The ONLY change is the hairstyle. Professional barbershop photography, sharp focus.';

    /* Compress image and convert to data URI for Runway */
    var jpegBuffer = await sharp(req.file.buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    var dataUri = 'data:image/jpeg;base64,' + jpegBuffer.toString('base64');
    console.log('Image prepared:', Math.round(jpegBuffer.length / 1024), 'KB');

    var model = process.env.RUNWAY_MODEL || 'gen4_image_turbo';
    console.log('Runway — model:', model, '| prompt:', promptText.substring(0, 80) + '...');

    /* Submit task to Runway with data URI */
    var task = await client.textToImage.create({
      model: model,
      promptText: promptText,
      ratio: '1080:1440',
      referenceImages: [
        {
          uri: dataUri,
          tag: 'subject'
        }
      ]
    });

    var taskId = task.id;
    console.log('Runway task created:', taskId);

    /* Poll for result */
    var apiKey = process.env.RUNWAY_API_KEY;
    for (var i = 0; i < 60; i++) {
      await new Promise(function (r) { setTimeout(r, 3000); });
      var pollRes = await fetch('https://api.dev.runwayml.com/v1/tasks/' + taskId, {
        headers: { 'Authorization': 'Bearer ' + apiKey, 'X-Runway-Version': '2024-11-06' }
      });
      if (!pollRes.ok) { if (pollRes.status >= 500) continue; throw new Error('Polling failed: ' + pollRes.status); }
      var pollData = await pollRes.json();
      var status = String(pollData.status || '').toUpperCase();
      if (status === 'SUCCEEDED') {
        var outputUrl = pollData.output && pollData.output[0];
        if (outputUrl) {
          console.log('Runway task completed');
          return res.json({ result: outputUrl });
        }
        console.error('Task succeeded but no output:', JSON.stringify(pollData));
        return res.status(502).json({ error: 'Génération terminée mais aucune image reçue.' });
      }
      if (status === 'FAILED') {
        console.error('Runway task failed:', JSON.stringify(pollData));
        throw new Error(pollData.failure || pollData.error || 'La génération a échoué.');
      }
    }
    throw new Error('Temps d\'attente dépassé.');

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
  console.log('BORA-BORA Barbershop on port ' + PORT + ' (Runway ' + model + ', key: ' + (hasRunway ? 'set' : 'MISSING') + ')');
});
