const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { fal } = require('@fal-ai/client');

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

/* ============================================================
   Provider: fal.ai — Nano Banana (image editing)
   Requires: FAL_KEY env var
   ============================================================ */
async function simulateWithFal(base64Image, prompt) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY non configurée.');

  fal.config({ credentials: falKey });

  const model = process.env.FAL_MODEL || 'fal-ai/nano-banana/edit';
  console.log('fal.ai — model:', model);

  const result = await fal.subscribe(model, {
    input: {
      prompt: prompt,
      image_urls: [base64Image],
      num_images: 1,
      aspect_ratio: '3:4',
      output_format: 'jpeg',
      safety_tolerance: '4'
    },
    logs: true,
    onQueueUpdate: function (update) {
      console.log('fal.ai queue:', update.status);
    }
  });

  console.log('fal.ai result:', JSON.stringify(result.data || result).substring(0, 500));

  const imageUrl = result.data?.images?.[0]?.url
    || result.images?.[0]?.url;

  if (!imageUrl) {
    throw new Error('Aucune image dans la réponse fal.ai.');
  }

  return imageUrl;
}

/* ============================================================
   Provider: Higgsfield — Flux Kontext Max (fallback)
   Requires: HIGGSFIELD_KEY_ID + HIGGSFIELD_KEY_SECRET env vars
   ============================================================ */
async function simulateWithHiggsfield(base64Image, prompt) {
  const keyId = process.env.HIGGSFIELD_KEY_ID;
  const keySecret = process.env.HIGGSFIELD_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Higgsfield non configuré.');

  const apiUrl = process.env.HIGGSFIELD_ENDPOINT || 'https://platform.higgsfield.ai/flux-pro/kontext/max';
  console.log('Higgsfield — endpoint:', apiUrl);

  const submitRes = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Key ' + keyId + ':' + keySecret,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt,
      image_url: base64Image,
      aspect_ratio: '3:4',
      safety_tolerance: 2
    })
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    console.error('Higgsfield submit error:', submitRes.status, errText);
    throw new Error('Erreur Higgsfield (' + submitRes.status + ')');
  }

  const submitData = await submitRes.json();
  console.log('Higgsfield response:', JSON.stringify(submitData).substring(0, 500));

  /* Direct result */
  const directUrl = submitData.images?.[0]?.url
    || submitData.output?.images?.[0]?.url
    || submitData.result?.url
    || submitData.sample?.url;

  if (directUrl) return directUrl;

  /* Queue polling */
  const requestId = submitData.request_id || submitData.id;
  const statusUrl = submitData.status_url;

  if (!requestId && !statusUrl) {
    throw new Error('Réponse Higgsfield inattendue.');
  }

  const pollUrl = statusUrl || ('https://platform.higgsfield.ai/v1/requests/' + requestId + '/status');
  const maxAttempts = 40;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(function (r) { setTimeout(r, 3000); });

    let pollRes;
    try {
      pollRes = await fetch(pollUrl, {
        headers: { 'Authorization': 'Key ' + keyId + ':' + keySecret }
      });
    } catch (e) {
      continue;
    }
    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const status = (pollData.status || '').toLowerCase();
    console.log('Higgsfield poll #' + (i + 1) + ':', status);

    if (status === 'completed' || status === 'ready' || status === 'succeeded') {
      const url = pollData.images?.[0]?.url
        || pollData.output?.images?.[0]?.url
        || pollData.result?.images?.[0]?.url
        || pollData.result?.url;
      if (url) return url;
      throw new Error('Terminé mais aucune image.');
    }
    if (status === 'failed' || status === 'error') {
      throw new Error('Génération échouée.');
    }
  }

  throw new Error('Délai dépassé.');
}

/* ============================================================
   API Route — /api/simulate
   ============================================================ */
app.post('/api/simulate', upload.single('photo'), async function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune photo reçue.' });
    }

    /* Detect provider */
    const provider = process.env.AI_PROVIDER || (process.env.FAL_KEY ? 'fal' : 'higgsfield');

    if (provider === 'fal' && !process.env.FAL_KEY) {
      return res.status(500).json({ error: 'FAL_KEY non configurée. Contactez le barbershop.' });
    }
    if (provider === 'higgsfield' && !process.env.HIGGSFIELD_KEY_ID) {
      return res.status(500).json({ error: 'API non configurée. Contactez le barbershop.' });
    }

    const prompt = req.body.prompt || 'modern fade haircut';
    const fullPrompt = 'Edit this photo: change ONLY the hairstyle to ' + prompt + '. Keep the exact same person, face, skin tone, background, and clothing. Only modify the hair.';

    /* Compress image */
    const base64Image = await compressImage(req.file.buffer);
    console.log('Image compressed (' + Math.round(base64Image.length / 1024) + ' KB), provider:', provider);

    /* Call AI provider */
    var imageUrl;
    if (provider === 'fal') {
      imageUrl = await simulateWithFal(base64Image, fullPrompt);
    } else {
      imageUrl = await simulateWithHiggsfield(base64Image, fullPrompt);
    }

    return res.json({ result: imageUrl });

  } catch (err) {
    console.error('Simulate error:', err.message || err);
    var userMsg = err.message || 'Erreur interne.';
    if (userMsg.includes('moderation') || userMsg.includes('safety')) {
      return res.status(400).json({ error: 'Photo rejetée par le filtre de sécurité. Essayez une autre photo.' });
    }
    return res.status(502).json({ error: userMsg });
  }
});

/* --- Fallback --- */
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, function () {
  var provider = process.env.AI_PROVIDER || (process.env.FAL_KEY ? 'fal' : 'higgsfield');
  console.log('BORA-BORA Barbershop on port ' + PORT + ' (AI: ' + provider + ')');
});
