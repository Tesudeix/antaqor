document.addEventListener('DOMContentLoaded', () => {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) { location.href = '/products.html'; return; }

  let qty = 1;
  let product = null;

  fetch(`/api/products/${slug}`)
    .then(r => r.json())
    .then(p => {
      if (!p || p.error) { location.href = '/products.html'; return; }
      product = p;
      document.title = `${p.name} — Herowater`;

      document.getElementById('productName').textContent = p.name;
      document.getElementById('productCategory').textContent = p.category?.toUpperCase() || '';
      document.getElementById('productDesc').textContent = p.description || '';
      document.getElementById('productVolume').textContent = `${p.volume || ''} ${p.packSize > 1 ? `× ${p.packSize}` : ''}`;
      document.getElementById('productPrice').textContent = formatPrice(p.price);
      document.getElementById('productStock').textContent = p.stock > 0 ? `${p.stock} ширхэг нөөцөд` : 'Дууссан';
      document.getElementById('productStock').style.color = p.stock > 0 ? 'var(--success)' : 'var(--danger)';

      const imgEl = document.getElementById('productImg');
      if (p.images?.[0]) {
        imgEl.innerHTML = `<img src="${p.images[0]}" alt="${p.name}">`;
      } else {
        imgEl.innerHTML = `<svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>`;
      }

      document.getElementById('loading').style.display = 'none';
      document.getElementById('productDetail').style.display = 'block';
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
    btn.textContent = 'Нэмэгдлээ ✓';
    btn.style.background = 'var(--success)';
    setTimeout(() => { btn.textContent = 'Сагсанд нэмэх'; btn.style.background = ''; }, 1500);
  });
});
