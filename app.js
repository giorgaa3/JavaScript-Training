const LS_KEY = "smart_inventory_v1";

const $ = (id) => document.getElementById(id);

const els = {
  tbody: $("tbody"),
  empty: $("empty"),
  statCount: $("statCount"),
  statValue: $("statValue"),
  statLow: $("statLow"),
  q: $("q"),
  categoryFilter: $("categoryFilter"),
  stockFilter: $("stockFilter"),
  sortBy: $("sortBy"),
  btnAdd: $("btnAdd"),
  modal: $("modal"),
  btnClose: $("btnClose"),
  btnCancel: $("btnCancel"),
  btnSeed: $("btnSeed"),
  form: $("form"),
  id: $("id"),
  name: $("name"),
  sku: $("sku"),
  category: $("category"),
  price: $("price"),
  stock: $("stock"),
  threshold: $("threshold"),
  modalTitle: $("modalTitle"),
};

function nowISO() {
  return new Date().toISOString();
}

function money(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

let items = load();

function seedDemo() {
  items = [
    { id: crypto.randomUUID(), name: "Surgical Mask", sku: "AVT-001", category: "Consumables", price: 0.12, stock: 220, threshold: 30, updatedAt: nowISO() },
    { id: crypto.randomUUID(), name: "Latex Gloves (M)", sku: "AVT-014", category: "Consumables", price: 0.08, stock: 55, threshold: 40, updatedAt: nowISO() },
    { id: crypto.randomUUID(), name: "IV Cannula 20G", sku: "ANM-020", category: "IV", price: 0.34, stock: 4, threshold: 10, updatedAt: nowISO() },
    { id: crypto.randomUUID(), name: "Syringe 5ml", sku: "ANM-105", category: "Consumables", price: 0.06, stock: 12, threshold: 20, updatedAt: nowISO() },
    { id: crypto.randomUUID(), name: "Gauze Pads", sku: "ANM-300", category: "Wound Care", price: 0.09, stock: 6, threshold: 10, updatedAt: nowISO() },
  ];
  save(items);
  render();
}

function openModal(mode, item = null) {
  els.modal.classList.remove("hidden");
  els.modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  if (mode === "add") {
    els.modalTitle.textContent = "Add Product";
    els.form.reset();
    els.id.value = "";
    els.threshold.value = "";
  } else {
    els.modalTitle.textContent = "Edit Product";
    els.id.value = item.id;
    els.name.value = item.name;
    els.sku.value = item.sku;
    els.category.value = item.category;
    els.price.value = item.price;
    els.stock.value = item.stock;
    els.threshold.value = item.threshold ?? "";
  }

  setTimeout(() => els.name.focus(), 0);
}

function closeModal() {
  els.modal.classList.add("hidden");
  els.modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function upsertFromForm(e) {
  e.preventDefault();

  const id = els.id.value || crypto.randomUUID();
  const name = els.name.value.trim();
  const sku = els.sku.value.trim();
  const category = els.category.value.trim();
  const price = Number(els.price.value);
  const stock = Number(els.stock.value);
  const thresholdRaw = els.threshold.value.trim();
  const threshold = thresholdRaw === "" ? 5 : Number(thresholdRaw);

  if (!name || !sku || !category || Number.isNaN(price) || Number.isNaN(stock) || Number.isNaN(threshold)) {
    alert("Please fill all required fields correctly.");
    return;
  }

  const idx = items.findIndex((x) => x.id === id);
  const obj = { id, name, sku, category, price, stock, threshold, updatedAt: nowISO() };

  if (idx >= 0) items[idx] = obj;
  else items.unshift(obj);

  save(items);
  closeModal();
  render();
}

function delItem(id) {
  const item = items.find((x) => x.id === id);
  if (!item) return;
  const ok = confirm(`Delete "${item.name}"?`);
  if (!ok) return;

  items = items.filter((x) => x.id !== id);
  save(items);
  render();
}

function uniqueCategories(list) {
  return Array.from(new Set(list.map((x) => x.category))).sort((a, b) => a.localeCompare(b));
}

function applyFilters(list) {
  const q = els.q.value.trim().toLowerCase();
  const cat = els.categoryFilter.value;
  const stockFilter = els.stockFilter.value;

  let out = list;

  if (q) {
    out = out.filter((x) =>
      x.name.toLowerCase().includes(q) ||
      x.sku.toLowerCase().includes(q)
    );
  }

  if (cat) out = out.filter((x) => x.category === cat);

  if (stockFilter) {
    out = out.filter((x) => {
      const isLow = x.stock <= (x.threshold ?? 5);
      return stockFilter === "low" ? isLow : !isLow;
    });
  }

  return out;
}

function applySort(list) {
  const key = els.sortBy.value;

  const copy = [...list];
  const cmp = {
    updatedAt_desc: (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""),
    name_asc: (a, b) => a.name.localeCompare(b.name),
    price_desc: (a, b) => b.price - a.price,
    stock_asc: (a, b) => a.stock - b.stock,
  }[key];

  return cmp ? copy.sort(cmp) : copy;
}

function renderStats(listAll) {
  const totalCount = listAll.length;
  const totalValue = listAll.reduce((sum, x) => sum + x.price * x.stock, 0);
  const lowCount = listAll.filter((x) => x.stock <= (x.threshold ?? 5)).length;

  els.statCount.textContent = String(totalCount);
  els.statValue.textContent = money(totalValue);
  els.statLow.textContent = String(lowCount);
}

function renderCategoryOptions(listAll) {
  const cats = uniqueCategories(listAll);
  const current = els.categoryFilter.value;

  els.categoryFilter.innerHTML = `<option value="">All</option>` + cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  // keep selection if still exists
  if (cats.includes(current)) els.categoryFilter.value = current;
}

function escapeHtml(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function rowTemplate(item) {
  const value = item.price * item.stock;
  const isLow = item.stock <= (item.threshold ?? 5);
  return `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.sku)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td class="right">${money(item.price)}</td>
      <td class="right">
        <span class="badge ${isLow ? "low" : ""}">
          <span class="dot"></span>
          ${item.stock}
        </span>
      </td>
      <td class="right">${money(value)}</td>
      <td class="right">
        <button class="btn" data-action="edit" data-id="${item.id}">Edit</button>
        <button class="btn" data-action="del" data-id="${item.id}" style="border-color: rgba(255,92,122,.45);">Delete</button>
      </td>
    </tr>
  `;
}

function render() {
  renderStats(items);
  renderCategoryOptions(items);

  const filtered = applySort(applyFilters(items));
  els.tbody.innerHTML = filtered.map(rowTemplate).join("");

  els.empty.classList.toggle("hidden", filtered.length !== 0);

  // wire row actions (event delegation)
  els.tbody.onclick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");
    const item = items.find((x) => x.id === id);

    if (action === "edit" && item) openModal("edit", item);
    if (action === "del") delItem(id);
  };
}

// UI events
els.btnAdd.onclick = () => openModal("add");
els.btnClose.onclick = closeModal;
els.btnCancel.onclick = closeModal;
els.modal.onclick = (e) => { if (e.target === els.modal) closeModal(); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !els.modal.classList.contains("hidden")) closeModal(); });

els.form.addEventListener("submit", upsertFromForm);
els.btnSeed.onclick = seedDemo;

// Filters
[els.q, els.categoryFilter, els.stockFilter, els.sortBy].forEach((el) => el.addEventListener("input", render));
[els.categoryFilter, els.stockFilter, els.sortBy].forEach((el) => el.addEventListener("change", render));

render();
