document.addEventListener('DOMContentLoaded', () => {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) { location.href = '/products.html'; return; }

  let qty = 1;
  let product = null;

  const categoryNames = {
    still: 'Still Water', sparkling: 'Sparkling', alkaline: 'Alkaline',
    mineral: 'Mineral', flavored: 'Flavored', bulk: 'Bulk'
  };

  fetch(`/api/products/${slug}`)
    .then(r => r.json())
    .then(p => {
      if (!p || p.error) { location.href = '/products.html'; return; }
      product = p;
      document.title = `${p.name} — Herowater`;

      // Breadcrumb
      document.getElementById('breadcrumbName').textContent = p.name;

      // Badge & name
      document.getElementById('productCategory').textContent = categoryNames[p.category] || p.category?.toUpperCase() || '';
      document.getElementById('productName').textContent = p.name;
      document.getElementById('productDesc').textContent = p.description || '';
      document.getElementById('productVolume').textContent = p.volume ? `Хэмжээ: ${p.volume}` : '';
      document.getElementById('productPrice').textContent = formatPrice(p.price);

      // Stock
      const stockEl = document.getElementById('productStock');
      const dot = stockEl.querySelector('.stock-dot');
      const label = stockEl.querySelector('span:last-child');
      if (p.stock > 0) {
        dot.classList.remove('out');
        label.textContent = `Нөөцөд байгаа (${p.stock})`;
        label.style.color = 'var(--success)';
      } else {
        dot.classList.add('out');
        label.textContent = 'Дууссан';
        label.style.color = 'var(--danger)';
        document.getElementById('addToCartBtn').disabled = true;
        document.getElementById('addToCartBtn').style.opacity = '0.5';
      }

      // Main image
      const imgEl = document.getElementById('productImg');
      if (p.images?.[0]) {
        imgEl.innerHTML = `<img src="${p.images[0]}" alt="${p.name}">`;
      } else {
        imgEl.innerHTML = `<div style="color:var(--text-muted);text-align:center;"><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg><p style="margin-top:12px;font-size:13px;">Зураг байхгүй</p></div>`;
      }

      // Thumbnails
      if (p.images?.length > 1) {
        const thumbsEl = document.getElementById('productThumbs');
        thumbsEl.innerHTML = p.images.map((img, i) =>
          `<div class="product-detail-thumb ${i === 0 ? 'active' : ''}" data-idx="${i}"><img src="${img}" alt=""></div>`
        ).join('');
        thumbsEl.addEventListener('click', (e) => {
          const thumb = e.target.closest('.product-detail-thumb');
          if (!thumb) return;
          const idx = Number(thumb.dataset.idx);
          imgEl.innerHTML = `<img src="${p.images[idx]}" alt="${p.name}">`;
          thumbsEl.querySelectorAll('.product-detail-thumb').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
        });
      }

      // Meta
      document.getElementById('metaCategory').textContent = categoryNames[p.category] || p.category || '-';
      document.getElementById('metaVolume').textContent = p.volume || '-';
      document.getElementById('metaPack').textContent = p.packSize > 1 ? `${p.packSize} ширхэг` : '1 ширхэг';

      document.getElementById('loading').style.display = 'none';
      document.getElementById('productDetail').style.display = 'block';

      // Load related products
      loadRelated(p.category, p._id);
    })
    .catch(() => { location.href = '/products.html'; });

  // Quantity controls
  document.getElementById('qtyMinus').addEventListener('click', () => {
    if (qty > 1) { qty--; document.getElementById('qtyNum').textContent = qty; }
  });
  document.getElementById('qtyPlus').addEventListener('click', () => {
    qty++; document.getElementById('qtyNum').textContent = qty;
  });

  // Add to cart
  document.getElementById('addToCartBtn').addEventListener('click', () => {
    if (!product) return;
    addToCart(product, qty);
    const btn = document.getElementById('addToCartBtn');
    const origHTML = btn.innerHTML;
    btn.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Нэмэгдлээ!';
    btn.style.background = 'var(--success)';
    setTimeout(() => { btn.innerHTML = origHTML; btn.style.background = ''; }, 1500);
  });

  function loadRelated(category, excludeId) {
    fetch(`/api/products?category=${category}`)
      .then(r => r.json())
      .then(data => {
        const related = (data.products || []).filter(p => p._id !== excludeId).slice(0, 4);
        if (!related.length) return;
        const grid = document.getElementById('relatedGrid');
        grid.innerHTML = related.map(p => `
          <a href="/product.html?slug=${p.slug}" class="product-card">
            <div class="product-card-img">
              ${p.images?.[0]
                ? `<img src="${p.images[0]}" alt="${p.name}">`
                : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1"><circle cx="12" cy="12" r="10"/></svg>`
              }
            </div>
            <h3>${p.name}</h3>
            <div class="volume">${p.volume || ''}</div>
            <div class="price">${formatPrice(p.price)}</div>
          </a>
        `).join('');
        document.getElementById('relatedSection').style.display = 'block';
      })
      .catch(() => {});
  }
});
