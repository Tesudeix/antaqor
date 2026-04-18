document.addEventListener('DOMContentLoaded', () => {
  // Load featured products
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
              : `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>`
            }
          </div>
          <h3>${p.name}</h3>
          <div class="volume">${p.volume || ''} ${p.packSize > 1 ? `× ${p.packSize}` : ''}</div>
          <div class="price">${formatPrice(p.price)}</div>
        </a>
      `).join('');
    })
    .catch(() => {});
});
