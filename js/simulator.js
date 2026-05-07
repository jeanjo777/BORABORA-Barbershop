/* ============================================
   BORA-BORA BARBERSHOP — Simulateur de Coiffure
   ============================================ */

(function () {
  'use strict';

  /* --- Elements --- */
  var photoInput = document.getElementById('photoInput');
  var uploadZone = document.getElementById('uploadZone');
  var uploadPlaceholder = document.getElementById('uploadPlaceholder');
  var uploadPreview = document.getElementById('uploadPreview');
  var previewImg = document.getElementById('previewImg');
  var changePhoto = document.getElementById('changePhoto');
  var btnCamera = document.getElementById('btnCamera');
  var btnFile = document.getElementById('btnFile');
  var styleList = document.getElementById('styleList');
  var generateBtn = document.getElementById('generateBtn');
  var generateBtnText = document.getElementById('generateBtnText');
  var previewEmpty = document.getElementById('previewEmpty');
  var simLoading = document.getElementById('simLoading');
  var loadingStep = document.getElementById('loadingStep');
  var loadingBar = document.getElementById('loadingBar');
  var simResult = document.getElementById('simResult');
  var simError = document.getElementById('simError');
  var simErrorMsg = document.getElementById('simErrorMsg');
  var resultBefore = document.getElementById('resultBefore');
  var resultAfter = document.getElementById('resultAfter');
  var retryBtn = document.getElementById('retryBtn');
  var retryErrorBtn = document.getElementById('retryErrorBtn');
  var downloadBtn = document.getElementById('downloadBtn');
  var compareSlider = document.getElementById('compareSlider');
  var compareBar = document.getElementById('compareBar');
  var compareHandle = document.getElementById('compareHandle');

  /* --- State --- */
  var selectedFile = null;
  var selectedStyle = null;
  var selectedPrompt = '';
  var loadingTimer = null;
  var resultImageUrl = '';

  /* --- Mobile menu toggle --- */
  var navToggle = document.getElementById('navToggle');
  var navMenu = document.getElementById('navMenu');

  navToggle.addEventListener('click', function () {
    var isOpen = navMenu.classList.toggle('nav__menu--open');
    navToggle.classList.toggle('nav__toggle--active');
    navToggle.setAttribute('aria-expanded', isOpen);
    navToggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  navMenu.querySelectorAll('.nav__link').forEach(function (link) {
    link.addEventListener('click', function () {
      navMenu.classList.remove('nav__menu--open');
      navToggle.classList.remove('nav__toggle--active');
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  /* --- Photo upload --- */
  function handleFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image (JPG, PNG).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('L\'image est trop lourde (max 10 Mo).');
      return;
    }

    selectedFile = file;
    var reader = new FileReader();
    reader.onload = function (ev) {
      previewImg.src = ev.target.result;
      uploadPlaceholder.hidden = true;
      uploadPreview.hidden = false;
      photoInput.style.display = 'none';
      photoInput.style.pointerEvents = 'none';
      updateGenerateBtn();
    };
    reader.readAsDataURL(file);
  }

  photoInput.addEventListener('change', function (e) {
    handleFile(e.target.files[0]);
  });

  changePhoto.addEventListener('click', function (e) {
    e.stopPropagation();
    selectedFile = null;
    previewImg.src = 'data:,';
    uploadPreview.hidden = true;
    uploadPlaceholder.hidden = false;
    photoInput.style.display = '';
    photoInput.style.pointerEvents = '';
    photoInput.value = '';
    updateGenerateBtn();
  });

  /* --- Camera button --- */
  btnCamera.addEventListener('click', function () {
    photoInput.setAttribute('capture', 'user');
    photoInput.click();
  });

  /* --- File button --- */
  btnFile.addEventListener('click', function () {
    photoInput.removeAttribute('capture');
    photoInput.click();
  });

  /* --- Drag and drop --- */
  uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', function () {
    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    var file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  });

  /* --- Style selection (event delegation + ARIA) --- */
  styleList.addEventListener('click', function (e) {
    var btn = e.target.closest('.sim-style-item');
    if (!btn) return;
    var allItems = styleList.querySelectorAll('.sim-style-item');
    allItems.forEach(function (b) {
      b.classList.remove('sim-style-item--selected');
      b.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('sim-style-item--selected');
    btn.setAttribute('aria-checked', 'true');
    selectedStyle = btn.getAttribute('data-style');
    selectedPrompt = btn.getAttribute('data-prompt');
    updateGenerateBtn();
  });

  /* --- Keyboard navigation for style list --- */
  styleList.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' &&
        e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    var items = Array.from(styleList.querySelectorAll('.sim-style-item'));
    var current = document.activeElement;
    var idx = items.indexOf(current);
    if (idx === -1) return;
    var next = (e.key === 'ArrowDown' || e.key === 'ArrowRight')
      ? (idx + 1) % items.length
      : (idx - 1 + items.length) % items.length;
    items[next].focus();
    items[next].click();
  });

  /* --- Update generate button --- */
  function updateGenerateBtn() {
    var ready = selectedFile && selectedStyle;
    generateBtn.disabled = !ready;
    if (ready) {
      generateBtnText.textContent = 'Générer la simulation';
    }
  }

  /* --- Show/hide sections --- */
  function showLoading() {
    previewEmpty.hidden = true;
    simLoading.hidden = false;
    simResult.hidden = true;
    simError.hidden = true;
    generateBtn.disabled = true;
    generateBtnText.textContent = 'Génération en cours…';
    startLoadingProgress();
  }

  function showResult(beforeSrc, afterSrc) {
    resultBefore.src = beforeSrc;
    resultAfter.src = afterSrc;
    previewEmpty.hidden = true;
    simLoading.hidden = true;
    simResult.hidden = false;
    simError.hidden = true;
    stopLoadingProgress();
    generateBtn.disabled = false;
    generateBtnText.textContent = 'Générer la simulation';
    /* Reset slider to 50% */
    setSliderPosition(50);
    simResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showError(message) {
    simErrorMsg.textContent = message || 'Une erreur est survenue. Veuillez réessayer.';
    previewEmpty.hidden = true;
    simLoading.hidden = true;
    simResult.hidden = true;
    simError.hidden = false;
    stopLoadingProgress();
    generateBtn.disabled = false;
    generateBtnText.textContent = 'Générer la simulation';
  }

  /* --- Loading progress animation --- */
  var loadingSteps = [
    { pct: 10, text: 'Envoi de la photo…' },
    { pct: 25, text: 'Analyse du visage…' },
    { pct: 40, text: 'Application du style…' },
    { pct: 60, text: 'Génération de l\'image…' },
    { pct: 75, text: 'Affinage des détails…' },
    { pct: 88, text: 'Finalisation…' }
  ];
  var loadingStepIndex = 0;

  function startLoadingProgress() {
    loadingStepIndex = 0;
    loadingBar.style.width = '5%';
    loadingStep.textContent = 'Envoi de la photo…';

    loadingTimer = setInterval(function () {
      if (loadingStepIndex < loadingSteps.length) {
        var step = loadingSteps[loadingStepIndex];
        loadingBar.style.width = step.pct + '%';
        loadingStep.textContent = step.text;
        loadingStepIndex++;
      }
    }, 5000);
  }

  function stopLoadingProgress() {
    if (loadingTimer) {
      clearInterval(loadingTimer);
      loadingTimer = null;
    }
    loadingBar.style.width = '100%';
  }

  /* --- Generate simulation --- */
  generateBtn.addEventListener('click', function () {
    if (!selectedFile || !selectedStyle) return;

    showLoading();

    var formData = new FormData();
    formData.append('photo', selectedFile);
    formData.append('style', selectedStyle);
    formData.append('prompt', selectedPrompt);

    fetch('/api/simulate', {
      method: 'POST',
      body: formData
    })
    .then(function (res) {
      if (!res.ok) {
        return res.json().then(function (data) {
          throw new Error(data.error || 'Erreur serveur (' + res.status + ')');
        });
      }
      return res.json();
    })
    .then(function (data) {
      if (data.result) {
        resultImageUrl = data.result;
        showResult(previewImg.src, data.result);
      } else {
        throw new Error('Aucune image générée.');
      }
    })
    .catch(function (err) {
      showError(err.message);
    });
  });

  /* --- Retry --- */
  retryBtn.addEventListener('click', function () {
    simResult.hidden = true;
    previewEmpty.hidden = false;
    generateBtn.disabled = false;
    var allItems = styleList.querySelectorAll('.sim-style-item');
    allItems.forEach(function (b) {
      b.classList.remove('sim-style-item--selected');
      b.setAttribute('aria-checked', 'false');
    });
    selectedStyle = null;
    selectedPrompt = '';
    resultImageUrl = '';
    updateGenerateBtn();
    styleList.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  retryErrorBtn.addEventListener('click', function () {
    simError.hidden = true;
    previewEmpty.hidden = false;
    generateBtn.disabled = false;
    generateBtnText.textContent = 'Générer la simulation';
  });

  /* --- Download result --- */
  downloadBtn.addEventListener('click', function () {
    if (!resultImageUrl) return;
    var a = document.createElement('a');
    a.href = resultImageUrl;
    a.download = 'borabora-simulation-' + (selectedStyle || 'coiffure') + '.jpg';
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  /* --- Before/After comparison slider --- */
  function setSliderPosition(pct) {
    pct = Math.max(0, Math.min(100, pct));
    resultBefore.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
    compareBar.style.left = pct + '%';
    compareHandle.style.left = pct + '%';
  }

  var isDragging = false;

  function getSliderPct(e) {
    var rect = compareSlider.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return ((clientX - rect.left) / rect.width) * 100;
  }

  function onDragStart(e) {
    e.preventDefault();
    isDragging = true;
    setSliderPosition(getSliderPct(e));
  }

  function onDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    setSliderPosition(getSliderPct(e));
  }

  function onDragEnd() {
    isDragging = false;
  }

  compareSlider.addEventListener('mousedown', onDragStart);
  compareSlider.addEventListener('touchstart', onDragStart, { passive: false });
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchend', onDragEnd);

  /* Initialize slider at 50% */
  setSliderPosition(50);

})();
