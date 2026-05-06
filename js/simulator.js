/* ============================================
   BORA-BORA BARBERSHOP — Simulateur de Coiffure
   ============================================ */

(function () {
  'use strict';

  /* --- Elements --- */
  var photoInput = document.getElementById('photoInput');
  var uploadPlaceholder = document.getElementById('uploadPlaceholder');
  var uploadPreview = document.getElementById('uploadPreview');
  var previewImg = document.getElementById('previewImg');
  var changePhoto = document.getElementById('changePhoto');
  var styleGrid = document.getElementById('styleGrid');
  var generateBtn = document.getElementById('generateBtn');
  var simLoading = document.getElementById('simLoading');
  var simResult = document.getElementById('simResult');
  var simError = document.getElementById('simError');
  var simErrorMsg = document.getElementById('simErrorMsg');
  var resultBefore = document.getElementById('resultBefore');
  var resultAfter = document.getElementById('resultAfter');
  var retryBtn = document.getElementById('retryBtn');
  var retryErrorBtn = document.getElementById('retryErrorBtn');

  /* --- State --- */
  var selectedFile = null;
  var selectedStyle = null;
  var selectedPrompt = '';

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
  photoInput.addEventListener('change', function (e) {
    var file = e.target.files[0];
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
      updateGenerateBtn();
    };
    reader.readAsDataURL(file);
  });

  changePhoto.addEventListener('click', function () {
    selectedFile = null;
    previewImg.src = 'data:,';
    uploadPreview.hidden = true;
    uploadPlaceholder.hidden = false;
    photoInput.style.display = '';
    photoInput.value = '';
    updateGenerateBtn();
  });

  /* --- Drag and drop --- */
  var uploadZone = document.getElementById('uploadZone');

  uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadPlaceholder.style.borderColor = 'var(--color-accent)';
  });

  uploadZone.addEventListener('dragleave', function () {
    uploadPlaceholder.style.borderColor = '';
  });

  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadPlaceholder.style.borderColor = '';
    var file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      var dt = new DataTransfer();
      dt.items.add(file);
      photoInput.files = dt.files;
      photoInput.dispatchEvent(new Event('change'));
    }
  });

  /* --- Style selection --- */
  var styleButtons = styleGrid.querySelectorAll('.sim-style');

  styleButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      styleButtons.forEach(function (b) { b.classList.remove('sim-style--selected'); });
      btn.classList.add('sim-style--selected');
      selectedStyle = btn.getAttribute('data-style');
      selectedPrompt = btn.getAttribute('data-prompt');
      updateGenerateBtn();
    });
  });

  /* --- Update generate button --- */
  function updateGenerateBtn() {
    generateBtn.disabled = !(selectedFile && selectedStyle);
  }

  /* --- Show/hide sections --- */
  function showLoading() {
    simLoading.hidden = false;
    simResult.hidden = true;
    simError.hidden = true;
    generateBtn.disabled = true;
  }

  function showResult(beforeSrc, afterSrc) {
    resultBefore.src = beforeSrc;
    resultAfter.src = afterSrc;
    simLoading.hidden = true;
    simResult.hidden = false;
    simError.hidden = true;
    simResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showError(message) {
    simErrorMsg.textContent = message || 'Une erreur est survenue. Veuillez réessayer.';
    simLoading.hidden = true;
    simResult.hidden = true;
    simError.hidden = false;
    generateBtn.disabled = false;
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
    generateBtn.disabled = false;
    styleButtons.forEach(function (b) { b.classList.remove('sim-style--selected'); });
    selectedStyle = null;
    selectedPrompt = '';
    updateGenerateBtn();
    document.getElementById('step-style').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  retryErrorBtn.addEventListener('click', function () {
    simError.hidden = true;
    generateBtn.disabled = false;
  });

})();
