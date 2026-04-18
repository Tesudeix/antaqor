const DELIVERY_THRESHOLD = 50000;
const DELIVERY_FEE = 5000;

document.addEventListener('DOMContentLoaded', () => {
  const cart = getCart();
  if (!cart.length) { location.href = '/cart.html'; return; }

  const subtotal = getCartTotal();
  const delivery = subtotal >= DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;

  const summary = document.getElementById('checkoutSummary');
  summary.innerHTML = `
    <div class="checkout-items">
      ${cart.map(i => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px;">
          <span>${i.name} × ${i.quantity}</span>
          <span>${formatPrice(i.price * i.quantity)}</span>
        </div>
      `).join('')}
    </div>
    <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;">
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;">
        <span>Дүн</span><span>${formatPrice(subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;">
        <span>Хүргэлт</span><span>${delivery === 0 ? 'Үнэгүй' : formatPrice(delivery)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;margin-top:8px;">
        <span>Нийт</span><span>${formatPrice(subtotal + delivery)}</span>
      </div>
    </div>
  `;

  document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('checkoutError');
    const btn = document.getElementById('submitBtn');
    errorEl.style.display = 'none';

    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    const address = document.getElementById('custAddress').value.trim();
    const note = document.getElementById('custNote').value.trim();
    const paymentMethod = document.getElementById('paymentMethod').value;

    if (!name || !phone || !address) {
      errorEl.textContent = 'Нэр, утас, хаяг заавал бөглөнө үү.';
      errorEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Илгээж байна...';

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name, phone, email, address },
          items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
          note,
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Алдаа гарлаа');

      // Clear cart and show success
      saveCart([]);
      document.getElementById('checkoutForm').style.display = 'none';
      document.getElementById('orderNumber').textContent = data.order.orderNumber;
      document.getElementById('checkoutSuccess').style.display = 'block';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Захиалга баталгаажуулах';
    }
  });
});
