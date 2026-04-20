const DELIVERY_THRESHOLD = 50000;
const DELIVERY_FEE = 5000;

const BANK_INFO = {
  bank: 'Худалдаа хөгжил банк',
  account: '426086874',
  name: 'Отгондаваа Сэргэлэн',
};

document.addEventListener('DOMContentLoaded', () => {
  const cart = getCart();
  if (!cart.length) { location.href = '/cart.html'; return; }

  const subtotal = getCartTotal();
  const delivery = subtotal >= DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = subtotal + delivery;

  const summary = document.getElementById('checkoutSummary');
  summary.innerHTML = `
    <div class="checkout-items">
      ${cart.map(i => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px;">
          <span style="color:var(--text);">${i.name} <span style="color:var(--text-muted);">&times; ${i.quantity}</span></span>
          <span style="font-weight:600;">${formatPrice(i.price * i.quantity)}</span>
        </div>
      `).join('')}
    </div>
    <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;">
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;">
        <span>Дүн</span><span>${formatPrice(subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;">
        <span>Хүргэлт</span><span>${delivery === 0 ? '<span style="color:var(--success);font-weight:600;">Үнэгүй</span>' : formatPrice(delivery)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
        <span>Нийт</span><span style="color:var(--accent);">${formatPrice(total)}</span>
      </div>
    </div>
  `;

  // Show/hide bank info based on payment method
  const paymentSelect = document.getElementById('paymentMethod');
  const bankInfoEl = document.getElementById('bankInfo');

  function updateBankInfo() {
    if (paymentSelect.value === 'bank') {
      bankInfoEl.style.display = 'block';
      document.getElementById('bankTotal').textContent = formatPrice(total);
    } else {
      bankInfoEl.style.display = 'none';
    }
  }
  paymentSelect.addEventListener('change', updateBankInfo);
  updateBankInfo();

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
      document.getElementById('successTotal').textContent = formatPrice(total);

      // Show bank info on success if bank transfer selected
      if (paymentMethod === 'bank') {
        document.getElementById('successBankInfo').style.display = 'block';
        document.getElementById('successBankTotal').textContent = formatPrice(total);
      }

      document.getElementById('checkoutSuccess').style.display = 'block';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Захиалга баталгаажуулах';
    }
  });
});
