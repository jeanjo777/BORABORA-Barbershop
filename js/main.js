/* ============================================
   BORA-BORA BARBERSHOP — Interactions
   ============================================ */

(function () {
  'use strict';

  /* --- Navigation scroll effect --- */
  var nav = document.getElementById('nav');

  function handleNavScroll() {
    if (window.scrollY > 60) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }
  }

  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

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

  /* --- Hero parallax --- */
  var heroImage = document.querySelector('.hero__image');
  var heroSection = document.querySelector('.hero');

  if (heroImage && heroSection && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var heroHeight = 0;
    var ticking = false;

    function updateParallax() {
      if (window.scrollY < heroHeight) {
        heroImage.style.transform = 'translateY(' + (window.scrollY * 0.35) + 'px) scale(1.08)';
      }
      ticking = false;
    }

    function onScrollParallax() {
      heroHeight = heroSection.offsetHeight;
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScrollParallax, { passive: true });
    heroImage.style.willChange = 'transform';
    heroImage.style.transform = 'translateY(0) scale(1.08)';
  }

  /* --- Scroll reveal --- */
  var revealTargets = document.querySelectorAll(
    '.about__grid, .service-card, .gallery__placeholder-item, .hours__grid, .contact__grid, .section-label, .section-title'
  );

  revealTargets.forEach(function (el) {
    el.classList.add('reveal');
  });

  var revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal--visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  revealTargets.forEach(function (el) {
    revealObserver.observe(el);
  });

  /* --- Animated counters --- */
  var counters = document.querySelectorAll('[data-count]');

  var counterObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(function (el) {
    counterObserver.observe(el);
  });

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    var duration = 1500;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
    }

    requestAnimationFrame(step);
  }

  /* --- Contact form (frontend-only feedback) --- */
  var form = document.getElementById('contactForm');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = form.querySelector('#name').value.trim();
      var phone = form.querySelector('#phone').value.trim();
      var service = form.querySelector('#service').value;

      if (!name || !phone || !service) {
        showFormMessage('Veuillez remplir tous les champs obligatoires.', 'error');
        return;
      }

      showFormMessage(
        'Merci ' + name + ' ! Votre demande a bien été envoyée. Nous vous recontacterons rapidement.',
        'success'
      );
      form.reset();
    });
  }

  function showFormMessage(text, type) {
    var existing = form.querySelector('.form__message');
    if (existing) existing.remove();

    var msg = document.createElement('div');
    msg.className = 'form__message';
    msg.textContent = text;
    msg.style.padding = '12px 16px';
    msg.style.borderRadius = '4px';
    msg.style.fontSize = '0.875rem';
    msg.style.marginTop = '8px';

    if (type === 'success') {
      msg.style.backgroundColor = 'rgba(46, 204, 64, 0.15)';
      msg.style.color = '#2ecc40';
      msg.style.border = '1px solid rgba(46, 204, 64, 0.3)';
      msg.setAttribute('role', 'status');
    } else {
      msg.style.backgroundColor = 'rgba(220, 80, 80, 0.15)';
      msg.style.color = '#dc5050';
      msg.style.border = '1px solid rgba(220, 80, 80, 0.3)';
      msg.setAttribute('role', 'alert');
    }

    form.appendChild(msg);

    setTimeout(function () {
      msg.remove();
    }, 6000);
  }

  /* --- Gallery lightbox --- */
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var galleryItems = document.querySelectorAll('.gallery__item img, .gallery__placeholder-item img');
  var galleryImages = [];
  var currentIndex = 0;

  galleryItems.forEach(function (img, i) {
    galleryImages.push(img.src);
    img.parentElement.addEventListener('click', function () {
      currentIndex = i;
      openLightbox(img.src, img.alt);
    });
  });

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('lightbox--open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('lightbox--open');
    document.body.style.overflow = '';
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
    lightboxImg.src = galleryImages[currentIndex];
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % galleryImages.length;
    lightboxImg.src = galleryImages[currentIndex];
  }

  lightbox.querySelector('.lightbox__close').addEventListener('click', closeLightbox);
  lightbox.querySelector('.lightbox__nav--prev').addEventListener('click', function (e) {
    e.stopPropagation();
    showPrev();
  });
  lightbox.querySelector('.lightbox__nav--next').addEventListener('click', function (e) {
    e.stopPropagation();
    showNext();
  });

  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('lightbox--open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  });

  /* --- Lightbox swipe gestures --- */
  var touchStartX = 0;
  var touchEndX = 0;
  var SWIPE_THRESHOLD = 50;

  lightbox.addEventListener('touchstart', function (e) {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  lightbox.addEventListener('touchend', function (e) {
    touchEndX = e.changedTouches[0].screenX;
    var diff = touchStartX - touchEndX;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      if (diff > 0) {
        showNext();
      } else {
        showPrev();
      }
    }
  });

  /* --- Active nav link on scroll --- */
  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('.nav__link:not(.nav__link--cta)');

  var sectionObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.getAttribute('id');
          navLinks.forEach(function (link) {
            if (link.getAttribute('href') === '#' + id) {
              link.classList.add('nav__link--active');
            } else {
              link.classList.remove('nav__link--active');
            }
          });
        }
      });
    },
    { threshold: 0.3, rootMargin: '-' + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72) + 'px 0px -40% 0px' }
  );

  sections.forEach(function (section) {
    sectionObserver.observe(section);
  });

  /* --- Back to top button --- */
  var backToTop = document.getElementById('backToTop');

  function handleBackToTop() {
    if (window.scrollY > 600) {
      backToTop.classList.add('back-to-top--visible');
    } else {
      backToTop.classList.remove('back-to-top--visible');
    }
  }

  window.addEventListener('scroll', handleBackToTop, { passive: true });
  handleBackToTop();

  backToTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* --- Lazy-load Google Maps iframe --- */
  var mapFrame = document.getElementById('mapFrame');
  if (mapFrame && mapFrame.dataset.src) {
    var mapObserver = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) {
          mapFrame.src = mapFrame.dataset.src;
          mapObserver.unobserve(mapFrame);
        }
      },
      { rootMargin: '200px 0px' }
    );
    mapObserver.observe(mapFrame);
  }

  /* --- Staggered gallery reveal --- */
  var galleryRevealItems = document.querySelectorAll('.gallery__item');
  var galleryObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var index = Array.prototype.indexOf.call(galleryRevealItems, entry.target);
          var visibleBefore = 0;
          for (var i = 0; i < index; i++) {
            if (galleryRevealItems[i].classList.contains('reveal--visible')) visibleBefore++;
          }
          var delay = Math.min((index - visibleBefore) * 80, 400);
          entry.target.style.transitionDelay = delay + 'ms';
          entry.target.classList.add('reveal--visible');
          galleryObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -20px 0px' }
  );

  galleryRevealItems.forEach(function (el) {
    el.classList.add('reveal');
    galleryObserver.observe(el);
  });

  /* --- Smooth scroll for anchors --- */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

})();
