const DELIVERY_THRESHOLD = 50000;
const DELIVERY_FEE = 5000;

function renderCart() {
  const cart = getCart();
  const emptyEl = document.getElementById('cartEmpty');
  const contentEl = document.getElementById('cartContent');
  const itemsEl = document.getElementById('cartItems');

  if (!cart.length) {
    emptyEl.style.display = 'block';
    contentEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  contentEl.style.display = 'block';

  itemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.image
          ? `<img src="${item.image}" alt="${item.name}">`
          : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1"><circle cx="12" cy="12" r="10"/></svg>`
        }
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-volume">${item.volume || ''}</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="changeQty('${item.productId}', -1)">−</button>
        <span class="qty-num">${item.quantity}</span>
        <button class="qty-btn" onclick="changeQty('${item.productId}', 1)">+</button>
      </div>
      <div class="cart-item-price">${formatPrice(item.price * item.quantity)}</div>
      <button onclick="removeItem('${item.productId}')" style="color:var(--text-muted);font-size:18px;padding:8px;">✕</button>
    </div>
  `).join('');

  const subtotal = getCartTotal();
  const delivery = subtotal >= DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  document.getElementById('cartSubtotal').textContent = formatPrice(subtotal);
  document.getElementById('cartDelivery').textContent = delivery === 0 ? 'Үнэгүй' : formatPrice(delivery);
  document.getElementById('cartTotal').textContent = formatPrice(subtotal + delivery);
}

function changeQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.productId === productId);
  if (item) {
    item.quantity = Math.max(1, item.quantity + delta);
    saveCart(cart);
    renderCart();
  }
}

function removeItem(productId) {
  removeFromCart(productId);
  renderCart();
}

document.addEventListener('DOMContentLoaded', renderCart);
