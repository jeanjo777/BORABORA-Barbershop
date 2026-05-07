const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

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

/* --- Compress image for API (max 1500px, JPEG quality 85) --- */
async function compressImage(buffer, mimetype) {
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
    const fullPrompt = 'Edit this photo: change ONLY the hairstyle to ' + prompt + '. Keep the exact same person, face, skin tone, background, and clothing. Only modify the hair.';

    /* Compress image before sending to API */
    const base64Image = await compressImage(req.file.buffer, req.file.mimetype);
    console.log('Image compressed, base64 length:', base64Image.length);

    /* Call Higgsfield API — Flux Kontext Max (image editing) */
    const apiUrl = process.env.HIGGSFIELD_ENDPOINT || 'https://platform.higgsfield.ai/flux-pro/kontext/max';
    console.log('Calling API:', apiUrl);

    const submitRes = await fetch(apiUrl, {
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
      console.error('API submit error:', submitRes.status, errText);
      return res.status(502).json({ error: 'Erreur du service IA (' + submitRes.status + '). Réessayez plus tard.' });
    }

    const submitData = await submitRes.json();
    console.log('API response:', JSON.stringify(submitData).substring(0, 800));

    /* Check for direct result first */
    const directUrl = submitData.images?.[0]?.url
      || submitData.output?.images?.[0]?.url
      || submitData.result?.url
      || submitData.sample?.url;

    if (directUrl) {
      console.log('Direct result:', directUrl);
      return res.json({ result: directUrl });
    }

    const requestId = submitData.request_id || submitData.id;
    const statusUrl = submitData.status_url;

    if (!requestId && !statusUrl) {
      console.error('No request_id, status_url, or direct result:', JSON.stringify(submitData));
      return res.status(502).json({ error: 'Réponse inattendue du service IA.' });
    }

    console.log('Polling — request_id:', requestId, 'status_url:', statusUrl);

    /* Poll for result */
    const maxAttempts = 40;
    const pollInterval = 3000;
    const pollUrl = statusUrl || ('https://platform.higgsfield.ai/v1/requests/' + requestId + '/status');

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(function (resolve) { setTimeout(resolve, pollInterval); });

      let pollRes;
      try {
        pollRes = await fetch(pollUrl, {
          headers: { 'Authorization': 'Key ' + keyId + ':' + keySecret }
        });
      } catch (pollErr) {
        console.error('Poll fetch error:', pollErr.message);
        continue;
      }

      if (!pollRes.ok) {
        console.warn('Poll HTTP', pollRes.status, 'attempt', i + 1);
        continue;
      }

      const pollData = await pollRes.json();
      const status = (pollData.status || '').toLowerCase();

      console.log('Poll #' + (i + 1) + ' status:', status);

      if (status === 'completed' || status === 'ready' || status === 'succeeded') {
        console.log('Result payload:', JSON.stringify(pollData).substring(0, 800));
        const imageUrl = pollData.images?.[0]?.url
          || pollData.output?.images?.[0]?.url
          || pollData.result?.images?.[0]?.url
          || pollData.result?.url
          || pollData.sample?.url;

        if (imageUrl) {
          return res.json({ result: imageUrl });
        }
        console.error('Completed but no image URL found in:', JSON.stringify(pollData));
        return res.status(502).json({ error: 'Génération terminée mais aucune image reçue.' });
      }

      if (status === 'failed' || status === 'error' || status === 'cancelled') {
        const reason = pollData.error || pollData.message || 'Raison inconnue';
        console.error('Generation failed:', reason, pollData);
        return res.status(502).json({ error: 'La génération a échoué : ' + reason });
      }

      if (status === 'nsfw' || status === 'content_moderation') {
        return res.status(400).json({ error: 'Photo rejetée par le filtre de sécurité. Essayez une autre photo.' });
      }
    }

    return res.status(504).json({ error: 'Délai dépassé (2 min). Réessayez avec une photo plus petite.' });

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
