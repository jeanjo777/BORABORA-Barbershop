/* ============================================
   BORA-BORA BARBERSHOP — Homme Simulator v2
   Uses /api/simulate (Express + multer + Runway)
   ============================================ */

(function () {
  'use strict';

  var form = document.getElementById('hommeForm');
  if (!form) return;

  var camInput = document.getElementById('cam');
  var uploadInput = document.getElementById('upload');
  var btnCamera = document.getElementById('btnCamera');
  var btnFile = document.getElementById('btnFile');
  var previewZone = document.getElementById('uploadPreview');
  var generateBtn = document.getElementById('generateBtn');
  var simStatus = document.getElementById('simStatus');
  var resultPlaceholder = document.getElementById('resultPlaceholder');
  var simLoading = document.getElementById('simLoading');
  var loadingStep = document.getElementById('loadingStep');
  var resultImage = document.getElementById('resultImage');
  var resultSummary = document.getElementById('resultSummary');
  var resultTitle = document.getElementById('resultTitle');
  var resultText = document.getElementById('resultText');
  var resultActions = document.getElementById('resultActions');
  var openLink = document.getElementById('openLink');

  var state = { file: null };

  function setStatus(msg, tone) {
    if (!simStatus) return;
    simStatus.textContent = msg;
    simStatus.dataset.tone = tone || 'neutral';
    simStatus.hidden = !msg;
  }

  function handleFile(input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setStatus('Image trop lourde. Maximum 10 Mo.', 'error');
      return;
    }
    state.file = file;
    var url = URL.createObjectURL(file);
    previewZone.innerHTML = '<img src="' + url + '" alt="Photo ajoutée">';
    input.value = '';
    setStatus('Photo ajoutée. Choisis ta coupe puis lance la simulation.', 'success');
  }

  if (btnCamera) btnCamera.addEventListener('click', function () { camInput && camInput.click(); });
  if (btnFile) btnFile.addEventListener('click', function () { uploadInput && uploadInput.click(); });
  if (camInput) camInput.addEventListener('change', function () { handleFile(camInput); });
  if (uploadInput) uploadInput.addEventListener('change', function () { handleFile(uploadInput); });

  /* Build prompt from selected style + options */
  function buildPrompt() {
    var checked = form.querySelector('input[name="styleId"]:checked');
    var basePrompt = checked ? checked.dataset.prompt : 'classic fade haircut';
    var styleName = checked ? checked.parentElement.querySelector('.sim-style__name').textContent : 'Fade classique';

    var colorMap = { noir: 'black', brun: 'brown', chatain: 'chestnut brown', blond: 'blonde', decolore: 'bleached platinum' };
    var lengthMap = { ras: 'very close-cropped', tres_court: 'very short', court: 'short', mi_long: 'medium-length' };
    var finishMap = { naturel: 'natural', mat: 'matte', brillant: 'glossy', texture: 'textured' };
    var fadeMap = { sans: '', low: 'low skin fade on the sides', mid: 'mid skin fade on the sides', high: 'high skin fade on the sides' };

    var color = colorMap[form.querySelector('[name="color"]').value] || 'black';
    var length = lengthMap[form.querySelector('[name="length"]').value] || 'short';
    var finish = finishMap[form.querySelector('[name="finish"]').value] || 'natural';
    var fade = fadeMap[form.querySelector('[name="fade"]').value] || '';

    var prompt = basePrompt + ', ' + color + ' ' + length + ' hair, ' + finish + ' finish';
    if (fade) prompt += ', ' + fade;

    return { prompt: prompt, styleName: styleName };
  }

  /* Loading steps animation */
  var loadingSteps = [
    'Envoi de la photo…',
    'Analyse du visage…',
    'Application du style…',
    'Rendu en cours…',
    'Finalisation…',
    'Presque terminé…'
  ];

  function showLoading() {
    resultPlaceholder.hidden = true;
    resultImage.hidden = true;
    resultSummary.hidden = true;
    resultActions.hidden = true;
    simLoading.hidden = false;

    var stepIndex = 0;
    loadingStep.textContent = loadingSteps[0];
    var interval = setInterval(function () {
      stepIndex++;
      if (stepIndex < loadingSteps.length) {
        loadingStep.textContent = loadingSteps[stepIndex];
      } else {
        clearInterval(interval);
      }
    }, 5000);

    return interval;
  }

  function showResult(imageUrl, styleName) {
    simLoading.hidden = true;
    resultPlaceholder.hidden = true;
    resultImage.src = imageUrl;
    resultImage.hidden = false;
    resultTitle.textContent = styleName;
    resultText.textContent = 'Si ce rendu te plaît, passe directement à la réservation.';
    resultSummary.hidden = false;
    openLink.href = imageUrl;
    resultActions.hidden = false;
    resultImage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showError(msg) {
    simLoading.hidden = true;
    resultPlaceholder.hidden = false;
    setStatus(msg || 'Génération impossible pour le moment.', 'error');
  }

  /* Submit */
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!state.file) {
      setStatus('Ajoute une photo avant de générer.', 'error');
      return;
    }

    var info = buildPrompt();
    var formData = new FormData();
    formData.append('photo', state.file);
    formData.append('prompt', info.prompt);

    generateBtn.disabled = true;
    generateBtn.innerHTML = 'Génération en cours…';
    setStatus('Préparation de la photo puis génération du rendu…', 'warning');
    var interval = showLoading();

    try {
      var res = await fetch('/api/simulate', { method: 'POST', body: formData });
      var data = await res.json();

      clearInterval(interval);

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Échec de la génération.');
      }

      showResult(data.result, info.styleName);
      setStatus('Aperçu généré. Tu peux maintenant réserver ce look.', 'success');
    } catch (err) {
      clearInterval(interval);
      showError(err.message);
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Générer mon aperçu';
    }
  });

  setStatus('Module prêt. Ajoute une photo puis lance la simulation.', 'success');
})();
