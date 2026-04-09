/* ═══════════════════════════════════════════
   JoyBilliard — Transition Engine v3
   Step-by-step fade on enter, scroll bar
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Overlay ── */
  var overlay = document.createElement('div');
  overlay.className = 'joy-transition-overlay';
  document.body.appendChild(overlay);

  /* ──────────────────────────────────────
     BOTTOM BAR — always visible on mobile,
     hide/show on scroll for desktop only
     ────────────────────────────────────── */
  (function () {
    var bar = document.getElementById('bottomBar');
    if (!bar) return;
    var isDesktop = window.matchMedia('(min-width:1024px)');
    var lastY = window.scrollY;
    var hidden = false;
    var raf = false;

    window.addEventListener('scroll', function () {
      if (!isDesktop.matches) return; /* mobile: always visible */
      if (raf) return;
      raf = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        if (y - lastY > 8 && y > 80 && !hidden) {
          bar.classList.add('bar-hidden');
          hidden = true;
        } else if (lastY - y > 8 && hidden) {
          bar.classList.remove('bar-hidden');
          hidden = false;
        }
        lastY = y;
        raf = false;
      });
    }, { passive: true });
  })();

  /* ──────────────────────────────────────
     TAG ELEMENTS — walk DOM order, assign
     step numbers for stagger timing
     ────────────────────────────────────── */
  function tagForReveal() {
    /* Homepage handles its own reveal via showPage(),
       so skip auto-tagging when #realContent exists */
    if (document.getElementById('realContent')) return;

    var selectors = [
      /* about */
      '.about-hero',
      '.about-badge',
      '.about-heading',
      '.about-text',
      '.feature-card',
      /* contact */
      '.contact-list > .contact-row',
      '.contact-list > div',
      /* feedback */
      '.feedback-form .form-group',
      '.branch-selector',
      '.submit-btn',
      /* jobs */
      '.jobs-intro',
      '.section-label',
      '.position-card',
      '.apply-form .form-group',
      /* auth */
      '.auth-hero',
      '.auth-tabs',
      '.auth-form:not([hidden]) .auth-group',
      '.auth-form:not([hidden]) .auth-btn',
      '.auth-info'
    ];

    var step = 0;

    selectors.forEach(function (sel) {
      var els = document.querySelectorAll(sel);
      els.forEach(function (el) {
        if (el.closest('.bottom-bar') || el.closest('.page-header')) return;
        if (el.classList.contains('joy-fade')) return;
        /* skip hidden/display:none parents */
        if (el.offsetParent === null && el.style.display !== 'flex') return;
        step++;
        el.classList.add('joy-fade');
        el.setAttribute('data-step', Math.min(step, 14));
      });
    });

    /* Menu & scroll-deeper content */
    document.querySelectorAll('.menu-section, .set-card, .food-list').forEach(function (el) {
      if (!el.classList.contains('joy-scroll-in')) {
        el.classList.add('joy-scroll-in');
      }
    });
  }

  /* ──────────────────────────────────────
     PAGE ENTER — flip .show on all tagged
     ────────────────────────────────────── */
  function revealAll() {
    /* Homepage handles its own cascade via showPage() */
    if (document.getElementById('realContent')) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.querySelectorAll('.joy-fade').forEach(function (el) {
          el.classList.add('show');
        });
      });
    });
  }

  /* ──────────────────────────────────────
     SCROLL REVEAL
     ────────────────────────────────────── */
  function setupScroll() {
    var els = document.querySelectorAll('.joy-scroll-in');
    if (!els.length) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('show');
          obs.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });
    els.forEach(function (el) { obs.observe(el); });
  }

  /* ──────────────────────────────────────
     PAGE EXIT — fade to black, navigate
     ────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href) return;
    if (href.startsWith('http') && !href.includes(window.location.host)) return;
    if (/^(tel:|mailto:|#)/.test(href)) return;
    if (link.target === '_blank') return;

    var cur = window.location.pathname;
    var tgt = href.split('?')[0].split('#')[0];
    if (!tgt.startsWith('/')) tgt = '/' + tgt;
    if (tgt === cur || tgt === cur.replace(/\/$/, '')) return;

    e.preventDefault();
    overlay.classList.add('active');
    setTimeout(function () { window.location.href = href; }, 280);
  });

  /* ──────────────────────────────────────
     INIT
     ────────────────────────────────────── */
  function init() {
    tagForReveal();
    revealAll();
    setupScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      overlay.classList.remove('active');
      tagForReveal();
      revealAll();
      setupScroll();
    }
  });
})();
