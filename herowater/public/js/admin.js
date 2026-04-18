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
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-label">Бүтээгдэхүүн</span>
          <div class="stat-card-icon blue"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div>
        </div>
        <div class="big-num">${stats.totalProducts || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-label">Нийт захиалга</span>
          <div class="stat-card-icon purple"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg></div>
        </div>
        <div class="big-num">${stats.totalOrders || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-label">Нийт орлого</span>
          <div class="stat-card-icon green"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
        </div>
        <div class="big-num">${formatPrice(stats.totalRevenue || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-label">Хүлээгдэж буй</span>
          <div class="stat-card-icon orange"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
        </div>
        <div class="big-num">${stats.pendingOrders || 0}</div>
      </div>
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
    if (!products.length) {
      el.innerHTML = '<div class="empty-state"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg><p>Бүтээгдэхүүн нэмнэ үү</p></div>';
      return;
    }
    el.innerHTML = `<table class="admin-table">
      <thead><tr><th>Бүтээгдэхүүн</th><th>Ангилал</th><th>Үнэ</th><th>Нөөц</th><th>Онцлох</th><th style="width:120px;"></th></tr></thead>
      <tbody>${products.map(p => `
        <tr>
          <td style="font-weight:600;">${p.name}</td>
          <td><span style="padding:3px 10px;border-radius:100px;font-size:12px;font-weight:500;background:var(--surface);color:var(--text-secondary);">${p.category}</span></td>
          <td style="font-weight:600;">${formatPrice(p.price)}</td>
          <td>${p.stock > 10
            ? `<span style="color:var(--success);">${p.stock}</span>`
            : p.stock > 0
              ? `<span style="color:var(--warning);">${p.stock}</span>`
              : `<span style="color:var(--danger);">0</span>`
          }</td>
          <td>${p.featured ? '<span style="color:var(--accent);">&#9733;</span>' : '<span style="color:var(--border);">&#9734;</span>'}</td>
          <td>
            <button onclick="editProduct('${p._id}')" class="table-action edit">Засах</button>
            <button onclick="deleteProduct('${p._id}')" class="table-action delete">Устгах</button>
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
  if (!confirm('Энэ бүтээгдэхүүнийг устгах уу?')) return;
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

// Close modal on overlay click
document.getElementById('productModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('productModal')) closeProductModal();
});

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
    loadDashboard();
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

const statusLabels = {
  pending: 'Хүлээгдэж буй',
  confirmed: 'Баталгаажсан',
  processing: 'Бэлтгэж буй',
  delivering: 'Хүргэж буй',
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан'
};

function renderOrdersTable(orders, el, showActions = false) {
  if (!orders.length) {
    el.innerHTML = '<div class="empty-state"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>Захиалга байхгүй</p></div>';
    return;
  }
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>Дугаар</th><th>Захиалагч</th><th>Утас</th><th>Дүн</th><th>Төлөв</th>${showActions ? '<th>Өөрчлөх</th>' : ''}</tr></thead>
    <tbody>${orders.map(o => `
      <tr>
        <td style="font-weight:600;font-family:monospace;">${o.orderNumber}</td>
        <td>${o.customer?.name || '-'}</td>
        <td style="color:var(--text-secondary);">${o.customer?.phone || '-'}</td>
        <td style="font-weight:600;">${formatPrice(o.total)}</td>
        <td><span class="status-badge status-${o.status}">${statusLabels[o.status] || o.status}</span></td>
        ${showActions ? `<td>
          <select class="status-select" onchange="updateOrderStatus('${o._id}', this.value)">
            ${Object.entries(statusLabels).map(([k, v]) =>
              `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`
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
