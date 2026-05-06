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
    const submitRes = await fetch('https://platform.higgsfield.ai/flux-pro/kontext/max/text-to-image', {
      method: 'POST',
      headers: {
        'Authorization': 'Key ' + keyId + ':' + keySecret,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        image_url: base64Image,
        aspect_ratio: '3:4',
        safety_tolerance: 2
      })
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error('Higgsfield submit error:', submitRes.status, errText);
      return res.status(502).json({ error: 'Erreur du service IA. Réessayez plus tard.' });
    }

    const submitData = await submitRes.json();
    console.log('Higgsfield submit response:', JSON.stringify(submitData).substring(0, 500));
    const requestId = submitData.request_id;
    const statusUrl = submitData.status_url;

    if (!requestId) {
      /* Direct result (some endpoints return immediately) */
      const directUrl = submitData.images?.[0]?.url || submitData.output?.images?.[0]?.url;
      if (directUrl) {
        console.log('Direct result URL:', directUrl);
        return res.json({ result: directUrl });
      }
      console.error('No request_id or direct result:', JSON.stringify(submitData).substring(0, 500));
      return res.status(502).json({ error: 'Réponse inattendue du service IA.' });
    }

    console.log('Polling request_id:', requestId, 'status_url:', statusUrl);

    /* Poll for result using status_url from response */
    const maxAttempts = 30;
    const pollInterval = 3000;
    const pollUrl = statusUrl || ('https://platform.higgsfield.ai/requests/' + requestId + '/status');

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(function (resolve) { setTimeout(resolve, pollInterval); });

      const pollRes = await fetch(pollUrl, {
        headers: {
          'Authorization': 'Key ' + keyId + ':' + keySecret
        }
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      const status = pollData.status;

      console.log('Poll attempt', i + 1, '- status:', status);

      if (status === 'completed') {
        console.log('Completed response:', JSON.stringify(pollData).substring(0, 500));
        const imageUrl = pollData.images?.[0]?.url
          || pollData.output?.images?.[0]?.url
          || pollData.result?.images?.[0]?.url;

        if (imageUrl) {
          console.log('Image URL:', imageUrl);
          return res.json({ result: imageUrl });
        }
        console.error('Completed but no image URL:', pollData);
        return res.status(502).json({ error: 'Génération terminée mais aucune image reçue.' });
      }

      if (status === 'failed' || status === 'error') {
        console.error('Generation failed:', pollData);
        return res.status(502).json({ error: 'La génération a échoué. Essayez une autre photo.' });
      }

      if (status === 'nsfw') {
        return res.status(400).json({ error: 'Photo rejetée par le filtre de sécurité. Essayez une autre photo.' });
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
