document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('productsGrid');
  const tabs = document.getElementById('categoryTabs');
  let allProducts = [];

  function renderProducts(products) {
    if (!grid) return;
    if (!products.length) {
      grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:60px 0;">Бүтээгдэхүүн олдсонгүй</p>';
      return;
    }
    grid.innerHTML = products.map(p => `
      <a href="/product.html?slug=${p.slug}" class="product-card">
        <div class="product-card-img">
          ${p.images?.[0]
            ? `<img src="${p.images[0]}" alt="${p.name}">`
            : `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>`
          }
        </div>
        <h3>${p.name}</h3>
        <div class="volume">${p.volume || ''} ${p.packSize > 1 ? `× ${p.packSize}` : ''}</div>
        <div class="price">${formatPrice(p.price)}</div>
      </a>
    `).join('');
  }

  // Fetch all products
  fetch('/api/products')
    .then(r => r.json())
    .then(data => {
      allProducts = data.products || [];
      renderProducts(allProducts);
    })
    .catch(() => {
      if (grid) grid.innerHTML = '<p style="color:var(--danger);text-align:center;padding:60px 0;">Алдаа гарлаа</p>';
    });

  // Category filter
  if (tabs) {
    tabs.addEventListener('click', e => {
      const btn = e.target.closest('.category-tab');
      if (!btn) return;
      tabs.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      if (cat === 'all') {
        renderProducts(allProducts);
      } else {
        renderProducts(allProducts.filter(p => p.category === cat));
      }
    });
  }
});
