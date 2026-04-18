const TOKEN_KEY = 'herowater_token';
const token = localStorage.getItem(TOKEN_KEY);
if (!token) location.href = '/login.html';

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  location.href = '/login.html';
}

// Check auth
fetch('/api/auth/me', { headers }).then(r => {
  if (!r.ok) { logout(); return; }
  return r.json();
}).then(u => {
  if (u) document.getElementById('adminName').textContent = u.name;
}).catch(() => logout());

// Sidebar navigation
document.querySelectorAll('.admin-sidebar a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.admin-sidebar a').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`sec-${link.dataset.section}`).classList.add('active');
  });
});

// ─── Dashboard ───
async function loadDashboard() {
  try {
    const res = await fetch('/api/admin/stats', { headers });
    const stats = await res.json();
    document.getElementById('statsGrid').innerHTML = `
      <div class="admin-card"><h3>Бүтээгдэхүүн</h3><div class="big-num">${stats.totalProducts || 0}</div></div>
      <div class="admin-card"><h3>Захиалга</h3><div class="big-num">${stats.totalOrders || 0}</div></div>
      <div class="admin-card"><h3>Орлого</h3><div class="big-num">${formatPrice(stats.totalRevenue || 0)}</div></div>
      <div class="admin-card"><h3>Хүлээгдэж буй</h3><div class="big-num">${stats.pendingOrders || 0}</div></div>
    `;

    const ordersRes = await fetch('/api/admin/orders?limit=5', { headers });
    const ordersData = await ordersRes.json();
    renderOrdersTable(ordersData.orders || [], document.getElementById('recentOrders'));
  } catch {}
}

// ─── Products ───
async function loadProducts() {
  try {
    const res = await fetch('/api/admin/products', { headers });
    const data = await res.json();
    const products = data.products || data || [];
    const el = document.getElementById('productsTable');
    if (!products.length) { el.innerHTML = '<p style="color:var(--text-muted)">Бүтээгдэхүүн байхгүй</p>'; return; }
    el.innerHTML = `<table class="admin-table">
      <thead><tr><th>Нэр</th><th>Ангилал</th><th>Үнэ</th><th>Нөөц</th><th></th></tr></thead>
      <tbody>${products.map(p => `
        <tr>
          <td>${p.name}</td>
          <td>${p.category}</td>
          <td>${formatPrice(p.price)}</td>
          <td>${p.stock}</td>
          <td>
            <button onclick="editProduct('${p._id}')" style="color:var(--accent);font-size:13px;padding:4px 8px;">Засах</button>
            <button onclick="deleteProduct('${p._id}')" style="color:var(--danger);font-size:13px;padding:4px 8px;">Устгах</button>
          </td>
        </tr>
      `).join('')}</tbody>
    </table>`;
  } catch {}
}

let allProducts = [];
async function editProduct(id) {
  try {
    const res = await fetch('/api/admin/products', { headers });
    const data = await res.json();
    allProducts = data.products || data || [];
    const p = allProducts.find(x => x._id === id);
    if (!p) return;
    document.getElementById('pf_id').value = p._id;
    document.getElementById('pf_name').value = p.name;
    document.getElementById('pf_category').value = p.category;
    document.getElementById('pf_price').value = p.price;
    document.getElementById('pf_volume').value = p.volume || '';
    document.getElementById('pf_packSize').value = p.packSize || 1;
    document.getElementById('pf_stock').value = p.stock;
    document.getElementById('pf_description').value = p.description || '';
    document.getElementById('pf_image').value = p.images?.[0] || '';
    document.getElementById('pf_featured').checked = p.featured;
    document.getElementById('productModalTitle').textContent = 'Бүтээгдэхүүн засах';
    document.getElementById('productModal').classList.add('open');
  } catch {}
}

async function deleteProduct(id) {
  if (!confirm('Устгах уу?')) return;
  try {
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE', headers });
    loadProducts();
  } catch {}
}

function openProductModal() {
  document.getElementById('productForm').reset();
  document.getElementById('pf_id').value = '';
  document.getElementById('productModalTitle').textContent = 'Бүтээгдэхүүн нэмэх';
  document.getElementById('productModal').classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
}

document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('pf_id').value;
  const body = {
    name: document.getElementById('pf_name').value.trim(),
    category: document.getElementById('pf_category').value,
    price: Number(document.getElementById('pf_price').value),
    volume: document.getElementById('pf_volume').value.trim(),
    packSize: Number(document.getElementById('pf_packSize').value) || 1,
    stock: Number(document.getElementById('pf_stock').value),
    description: document.getElementById('pf_description').value.trim(),
    images: document.getElementById('pf_image').value.trim() ? [document.getElementById('pf_image').value.trim()] : [],
    featured: document.getElementById('pf_featured').checked,
  };

  try {
    const url = id ? `/api/admin/products/${id}` : '/api/admin/products';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Алдаа'); return; }
    closeProductModal();
    loadProducts();
  } catch { alert('Алдаа гарлаа'); }
});

// ─── Orders ───
async function loadOrders() {
  try {
    const res = await fetch('/api/admin/orders', { headers });
    const data = await res.json();
    renderOrdersTable(data.orders || [], document.getElementById('ordersTable'), true);
  } catch {}
}

function renderOrdersTable(orders, el, showActions = false) {
  if (!orders.length) { el.innerHTML = '<p style="color:var(--text-muted)">Захиалга байхгүй</p>'; return; }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>Дугаар</th><th>Нэр</th><th>Дүн</th><th>Төлөв</th>${showActions ? '<th></th>' : ''}</tr></thead>
    <tbody>${orders.map(o => `
      <tr>
        <td style="font-weight:600;">${o.orderNumber}</td>
        <td>${o.customer?.name || '-'}</td>
        <td>${formatPrice(o.total)}</td>
        <td><span class="status-badge status-${o.status}">${o.status}</span></td>
        ${showActions ? `<td>
          <select onchange="updateOrderStatus('${o._id}', this.value)" style="padding:6px 10px;font-size:12px;">
            ${['pending','confirmed','processing','delivering','delivered','cancelled'].map(s =>
              `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </td>` : ''}
      </tr>
    `).join('')}</tbody>
  </table>`;
}

async function updateOrderStatus(id, status) {
  try {
    await fetch(`/api/admin/orders/${id}`, {
      method: 'PUT', headers, body: JSON.stringify({ status }),
    });
    loadOrders();
    loadDashboard();
  } catch {}
}

// Load initial data
loadDashboard();
loadProducts();
loadOrders();
