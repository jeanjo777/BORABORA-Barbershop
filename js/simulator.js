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
  var previewEmpty = document.getElementById('previewEmpty');
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

  /* --- Style selection --- */
  var styleItems = styleList.querySelectorAll('.sim-style-item');

  styleItems.forEach(function (btn) {
    btn.addEventListener('click', function () {
      styleItems.forEach(function (b) { b.classList.remove('sim-style-item--selected'); });
      btn.classList.add('sim-style-item--selected');
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
    previewEmpty.hidden = true;
    simLoading.hidden = false;
    simResult.hidden = true;
    simError.hidden = true;
    generateBtn.disabled = true;
  }

  function showResult(beforeSrc, afterSrc) {
    resultBefore.src = beforeSrc;
    resultAfter.src = afterSrc;
    previewEmpty.hidden = true;
    simLoading.hidden = true;
    simResult.hidden = false;
    simError.hidden = true;
    simResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showError(message) {
    simErrorMsg.textContent = message || 'Une erreur est survenue. Veuillez réessayer.';
    previewEmpty.hidden = true;
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
    previewEmpty.hidden = false;
    generateBtn.disabled = false;
    styleItems.forEach(function (b) { b.classList.remove('sim-style-item--selected'); });
    selectedStyle = null;
    selectedPrompt = '';
    updateGenerateBtn();
    styleList.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  retryErrorBtn.addEventListener('click', function () {
    simError.hidden = true;
    previewEmpty.hidden = false;
    generateBtn.disabled = false;
  });

})();
