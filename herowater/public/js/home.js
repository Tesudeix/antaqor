document.addEventListener('DOMContentLoaded', () => {
  // ─── Hero Slider ───
  const slider = document.getElementById('heroSlider');
  const dotsEl = document.getElementById('heroDots');
  let slides = [];
  let current = 0;
  let timer = null;

  function renderSlide(idx) {
    const slide = slides[idx];
    if (!slide) return;
    const bg = slider.querySelector('.hero-slider-bg');
    const title = slider.querySelector('.hero-slider-title');
    const subtitle = slider.querySelector('.hero-slider-subtitle');
    const ctaBtn = slider.querySelector('.hero-slider-cta');

    // Fade out
    slider.classList.remove('slide-visible');
    setTimeout(() => {
      // Set media
      if (slide.video) {
        bg.innerHTML = `<video src="${slide.video}" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;"></video>`;
      } else if (slide.image) {
        bg.innerHTML = `<img src="${slide.image}" alt="${slide.title || ''}" style="width:100%;height:100%;object-fit:cover;">`;
      } else {
        bg.innerHTML = '';
      }

      title.textContent = slide.title || '';
      subtitle.textContent = slide.subtitle || '';
      if (slide.ctaText && slide.ctaLink) {
        ctaBtn.textContent = slide.ctaText;
        ctaBtn.href = slide.ctaLink;
        ctaBtn.style.display = '';
      } else {
        ctaBtn.style.display = 'none';
      }

      // Update dots
      dotsEl.querySelectorAll('.hero-dot').forEach((d, i) => {
        d.classList.toggle('active', i === idx);
      });

      // Fade in
      slider.classList.add('slide-visible');
    }, 300);
  }

  function nextSlide() {
    current = (current + 1) % slides.length;
    renderSlide(current);
  }

  function startAutoplay() {
    if (timer) clearInterval(timer);
    timer = setInterval(nextSlide, 6000);
  }

  function goToSlide(idx) {
    current = idx;
    renderSlide(current);
    startAutoplay();
  }

  // Load slides from settings API
  fetch('/api/settings/public')
    .then(r => r.json())
    .then(data => {
      const settings = data.settings;
      const heroSections = (settings?.heroSections || []).filter(s => s.active).sort((a, b) => a.order - b.order);

      if (heroSections.length > 0) {
        slides = heroSections;
      } else {
        // Default slides
        slides = [
          { title: 'HEROWATER', subtitle: 'Цэвэр. Премиум. Усны шинэ стандарт.', ctaText: 'Захиалах', ctaLink: '/products.html' },
        ];
      }

      // Render dots
      if (slides.length > 1) {
        dotsEl.innerHTML = slides.map((_, i) =>
          `<button class="hero-dot ${i === 0 ? 'active' : ''}" onclick=""></button>`
        ).join('');
        dotsEl.querySelectorAll('.hero-dot').forEach((dot, i) => {
          dot.addEventListener('click', () => goToSlide(i));
        });
      }

      renderSlide(0);
      slider.classList.add('slide-visible');
      if (slides.length > 1) startAutoplay();
    })
    .catch(() => {
      // Fallback
      slider.querySelector('.hero-slider-title').textContent = 'HEROWATER';
      slider.querySelector('.hero-slider-subtitle').textContent = 'Цэвэр. Премиум. Усны шинэ стандарт.';
      slider.classList.add('slide-visible');
    });

  // Touch swipe
  let touchStartX = 0;
  slider.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
  slider.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) { current = (current + 1) % slides.length; }
      else { current = (current - 1 + slides.length) % slides.length; }
      renderSlide(current);
      startAutoplay();
    }
  });

  // ─── Featured Products ───
  fetch('/api/products?featured=true')
    .then(r => r.json())
    .then(data => {
      const grid = document.getElementById('featuredGrid');
      if (!grid || !data.products) return;
      grid.innerHTML = data.products.map(p => `
        <a href="/product.html?slug=${p.slug}" class="product-card">
          <div class="product-card-img">
            ${p.images?.[0]
              ? `<img src="${p.images[0]}" alt="${p.name}">`
              : `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1"><circle cx="12" cy="12" r="10"/></svg>`
            }
          </div>
          <h3>${p.name}</h3>
          <div class="volume">${p.volume || ''} ${p.packSize > 1 ? `&times; ${p.packSize}` : ''}</div>
          <div class="price">${formatPrice(p.price)}</div>
        </a>
      `).join('');
    })
    .catch(() => {});
});
