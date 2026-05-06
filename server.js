const express = require('express');
const path = require('path');
const multer = require('multer');

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

/* --- Simulate hairstyle API --- */
app.post('/api/simulate', upload.single('photo'), async function (req, res) {
  try {
    const keyId = process.env.HIGGSFIELD_KEY_ID;
    const keySecret = process.env.HIGGSFIELD_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(500).json({ error: 'API non configurée. Contactez le barbershop.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Aucune photo reçue.' });
    }

    const prompt = req.body.prompt || 'modern fade haircut';
    const fullPrompt = 'Change this person\'s hairstyle to: ' + prompt + '. Keep the person\'s face, skin tone, and features exactly the same. Only change the hairstyle. Professional barbershop photo, high quality.';

    /* Convert uploaded image to base64 data URL */
    const base64Image = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');

    /* Call Higgsfield API — Flux Kontext image editing */
    const submitRes = await fetch('https://api.higgsfield.ai/api/v1/flux-pro/kontext/max/text-to-image', {
      method: 'POST',
      headers: {
        'Authorization': 'Key ' + keyId + ':' + keySecret,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        image_url: base64Image,
        width: 768,
        height: 1024,
        num_images: 1
      })
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error('Higgsfield submit error:', submitRes.status, errText);
      return res.status(502).json({ error: 'Erreur du service IA. Réessayez plus tard.' });
    }

    const submitData = await submitRes.json();
    const taskId = submitData.id || submitData.task_id;

    if (!taskId) {
      /* Direct result (some endpoints return immediately) */
      const directUrl = submitData.images?.[0]?.url || submitData.output?.url || submitData.url;
      if (directUrl) {
        return res.json({ result: directUrl });
      }
      console.error('No task ID or direct result:', submitData);
      return res.status(502).json({ error: 'Réponse inattendue du service IA.' });
    }

    /* Poll for result */
    const maxAttempts = 30;
    const pollInterval = 3000;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(function (resolve) { setTimeout(resolve, pollInterval); });

      const pollRes = await fetch('https://api.higgsfield.ai/api/v1/tasks/' + taskId, {
        headers: {
          'Authorization': 'Key ' + keyId + ':' + keySecret
        }
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      const status = pollData.status || pollData.state;

      if (status === 'completed' || status === 'succeeded' || status === 'done') {
        const imageUrl = pollData.images?.[0]?.url
          || pollData.output?.images?.[0]?.url
          || pollData.output?.url
          || pollData.result?.url
          || pollData.url;

        if (imageUrl) {
          return res.json({ result: imageUrl });
        }
        console.error('Completed but no image URL:', pollData);
        return res.status(502).json({ error: 'Génération terminée mais aucune image reçue.' });
      }

      if (status === 'failed' || status === 'error') {
        console.error('Generation failed:', pollData);
        return res.status(502).json({ error: 'La génération a échoué. Essayez une autre photo.' });
      }
    }

    return res.status(504).json({ error: 'Délai dépassé. Réessayez avec une photo plus petite.' });

  } catch (err) {
    console.error('Simulate error:', err);
    return res.status(500).json({ error: 'Erreur interne. Réessayez plus tard.' });
  }
});

/* --- Fallback --- */
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, function () {
  console.log('BORA-BORA Barbershop running on port ' + PORT);
});
