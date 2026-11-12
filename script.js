// ==========================================================================
// KONFIGURASI FIREBASE REALTIME DATABASE
// ==========================================================================
const firebaseConfig = {
    databaseURL: "https://sweet-memories-kasir-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let db = null;
try {
    if (typeof firebase !== "undefined") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
    }
} catch (err) {
    console.warn("Firebase offline/skip:", err);
}

// State Management
let cart = [];
let transactions = [];
let pendingOrders = [];
let activeCategory = "all";
let searchQuery = "";
let currentOrderType = "Mahasiswa";
let currentReceiptData = null;
let selectedBeadProduct = null;

let appSettings = {
    storeName: "Sweet Memories",
    slogan: "Dibuat dengan rasa, dikenang selamanya..",
    address: "Jl. Pantura No.6, Kalodran, Kec. Walantaka, Kota Serang, Banten 42183",
    phone: "0853-1955-8384",
    taxRate: 0,
    serviceFee: 0,
    qrisPath: "pict/img/QRISBarcode.jpeg",
    receiptHeader: "Selamat Datang di Sweet Memories!",
    receiptFooter: "Terima kasih atas kunjungannya, datang kembali ya! ♥",
    autoPrint: true
};

const menuItems = [
    { id: 1, name: "Donat Jadoel", price: 3500, category: "makanan", img: "pict/img/Donat.png" },
    { id: 2, name: "Bomboloni", price: 4000, category: "makanan", img: "pict/img/bomboloni.png" },
    { id: 3, name: "Soda Gembira", price: 12000, category: "minuman", img: "pict/img/sodagembira.jpg" },
    { id: 4, name: "Mango Sticky Rice", price: 15000, category: "makanan", img: "pict/img/mangostr.jpg" },
    { id: 5, name: "Kue Sus", price: 3500, category: "makanan", img: "pict/img/kuesus.png" },
    { 
        id: 6, 
        name: "Manik - Manik", 
        price: 5000, 
        category: "aksesoris", 
        img: "pict/img/manikmanik.png",
        isCustom: true 
    }
];

const beadVariants = {
    "Gelang": [
        { name: "Gelang Simple", price: 10000 },
        { name: "Gelang Standard", price: 15000 },
        { name: "Gelang Premium / Charm", price: 20000 }
    ],
    "Kalung": [
        { name: "Kalung Choker", price: 18000 },
        { name: "Kalung Standard", price: 25000 },
        { name: "Kalung Layered / Full Pearl", price: 35000 }
    ],
    "Cincin": [
        { name: "Cincin Manik Polos", price: 5000 },
        { name: "Cincin Custom Bunga/Karakter", price: 8000 }
    ]
};

const formatRupiah = (number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(number || 0);

// ==========================================================================
// SINKRONISASI LOKAL + CLOUD FIREBASE
// ==========================================================================
const persistTransactions = () => {
    localStorage.setItem("sweet_memories_transactions", JSON.stringify(transactions));
    if (db) db.ref("sweet_memories/transactions").set(transactions);
};

const persistPending = () => {
    localStorage.setItem("sweet_memories_pending", JSON.stringify(pendingOrders));
    if (db) db.ref("sweet_memories/pendingOrders").set(pendingOrders);
};

const initRealtimeCloudSync = () => {
    if (!db) return;

    db.ref(".info/connected").on("value", (snap) => {
        const statusEl = document.getElementById("syncStatusText");
        if (!statusEl) return;
        if (snap.val() === true) {
            statusEl.innerHTML = `<i class="fa-solid fa-circle"></i> Cloud Sync`;
            statusEl.style.color = "var(--success-color)";
        } else {
            statusEl.innerHTML = `<i class="fa-solid fa-circle"></i> Lokal`;
            statusEl.style.color = "var(--text-secondary)";
        }
    });

    db.ref("sweet_memories/transactions").on("value", (snapshot) => {
        const cloudData = snapshot.val();
        transactions = cloudData ? (Array.isArray(cloudData) ? cloudData : Object.values(cloudData)) : [];
        localStorage.setItem("sweet_memories_transactions", JSON.stringify(transactions));
        syncAllViews();
    });

    db.ref("sweet_memories/pendingOrders").on("value", (snapshot) => {
        const cloudPending = snapshot.val();
        pendingOrders = cloudPending ? (Array.isArray(cloudPending) ? cloudPending : Object.values(cloudPending)) : [];
        localStorage.setItem("sweet_memories_pending", JSON.stringify(pendingOrders));
        updatePendingUI();
    });

    db.ref("sweet_memories/settings").on("value", (snapshot) => {
        const cloudSettings = snapshot.val();
        if (cloudSettings) {
            appSettings = { ...appSettings, ...cloudSettings };
            localStorage.setItem("sweet_memories_settings", JSON.stringify(appSettings));
            applySettingsToForm();
            updateCartUI();
        }
    });
};

const applySettingsToForm = () => {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal("cfgStoreName", appSettings.storeName);
    setVal("cfgSlogan", appSettings.slogan);
    setVal("cfgAddress", appSettings.address);
    setVal("cfgPhone", appSettings.phone);
    setVal("cfgTaxRate", appSettings.taxRate);
    setVal("cfgServiceFee", appSettings.serviceFee);
    setVal("qrisImagePath", appSettings.qrisPath);
    setVal("cfgReceiptHeader", appSettings.receiptHeader);
    setVal("cfgReceiptFooter", appSettings.receiptFooter);

    const qrisPrev = document.getElementById("cfgQrisPreview");
    if (qrisPrev) qrisPrev.src = appSettings.qrisPath;

    const autoPrintEl = document.getElementById("cfgAutoPrint");
    if (autoPrintEl) autoPrintEl.checked = appSettings.autoPrint;

    const taxLabel = document.getElementById("taxLabel");
    if (taxLabel) taxLabel.textContent = `Pajak (${appSettings.taxRate}%)`;
};

const loadSettings = () => {
    try {
        const savedConfig = localStorage.getItem("sweet_memories_settings");
        if (savedConfig) appSettings = { ...appSettings, ...JSON.parse(savedConfig) };
    } catch (e) {}

    try {
        const savedHistory = localStorage.getItem("sweet_memories_transactions");
        if (savedHistory) transactions = JSON.parse(savedHistory) || [];
    } catch (e) { transactions = []; }

    try {
        const savedPending = localStorage.getItem("sweet_memories_pending");
        if (savedPending) pendingOrders = JSON.parse(savedPending) || [];
    } catch (e) { pendingOrders = []; }

    applySettingsToForm();
    syncAllViews();
};

const syncAllViews = () => {
    updateHistoryTable();
    updateReportSummary();
    updatePendingUI();
};

const startRealtimeClock = () => {
    const dateDisplay = document.getElementById("dateDisplay");
    if (!dateDisplay) return;
    const updateClock = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        dateDisplay.textContent = `${dateStr} - ${timeStr} WIB`;
    };
    updateClock();
    setInterval(updateClock, 1000);
};

// ==========================================================================
// RENDER MENU & PRODUK
// ==========================================================================
const renderMenu = () => {
    const menuGrid = document.getElementById("menuGrid");
    if (!menuGrid) return;
    menuGrid.innerHTML = "";

    const filteredMenu = menuItems.filter(item => {
        const matchesCategory = activeCategory === "all" || item.category === activeCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    if (filteredMenu.length === 0) {
        menuGrid.innerHTML = `<p class="text-center" style="grid-column: 1/-1; margin-top: 40px;">Menu tidak ditemukan</p>`;
        return;
    }

    filteredMenu.forEach(item => {
        const card = document.createElement("div");
        card.className = "menu-card";
        card.innerHTML = `
            <img src="${item.img}" alt="${item.name}" class="menu-img" loading="lazy" onerror="this.onerror=null; this.src='pict/logo/LOGO.png';">
            <div class="menu-info">
                <h4>${item.name} ${item.isCustom ? '<small style="color:var(--accent-light);">(Custom)</small>' : ''}</h4>
                <div class="menu-price">${item.isCustom ? 'Mulai ' + formatRupiah(5000) : formatRupiah(item.price)}</div>
            </div>
        `;
        card.addEventListener("click", () => handleProductClick(item));
        menuGrid.appendChild(card);
    });
};

const handleProductClick = (product) => {
    if (product.isCustom) {
        selectedBeadProduct = product;
        populateBeadPrices();
        const modal = document.getElementById("customBeadModal");
        if (modal) modal.classList.add("active");
    } else {
        addToCart(product);
    }
};

const populateBeadPrices = () => {
    const typeSel = document.getElementById("beadVariantType");
    const priceSel = document.getElementById("beadVariantPrice");
    if (!typeSel || !priceSel) return;
    const options = beadVariants[typeSel.value] || [];
    priceSel.innerHTML = "";
    options.forEach(opt => {
        const optionEl = document.createElement("option");
        optionEl.value = opt.price;
        optionEl.dataset.name = opt.name;
        optionEl.textContent = `${opt.name} - ${formatRupiah(opt.price)}`;
        priceSel.appendChild(optionEl);
    });
};

// ==========================================================================
// KERANJANG & PERHITUNGAN
// ==========================================================================
const addToCart = (product) => {
    const existingIndex = cart.findIndex(item => String(item.id) === String(product.id) || item.name === product.name);
    if (existingIndex > -1) {
        cart[existingIndex].qty += 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    updateCartUI();
};

window.updateQty = (id, delta) => {
    const index = cart.findIndex(item => String(item.id) === String(id));
    if (index > -1) {
        cart[index].qty += delta;
        if (cart[index].qty <= 0) cart.splice(index, 1);
    }
    updateCartUI();
};

const updateCartUI = () => {
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    const mobileCartCount = document.getElementById("mobileCartCount");
    if (mobileCartCount) mobileCartCount.textContent = totalQty;

    const cartItemsContainer = document.getElementById("cartItems");
    const subtotalEl = document.getElementById("subtotal");
    const taxEl = document.getElementById("tax");
    const grandTotalEl = document.getElementById("grandTotal");
    const btnCheckout = document.getElementById("btnCheckout");
    const btnHoldOrder = document.getElementById("btnHoldOrder");

    if (!cartItemsContainer) return;
    cartItemsContainer.innerHTML = "";

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="cart-empty">
                <i class="fa-solid fa-basket-shopping"></i>
                <p>Belum ada item dipilih</p>
            </div>`;
        if (subtotalEl) subtotalEl.textContent = "Rp 0";
        if (taxEl) taxEl.textContent = "Rp 0";
        if (grandTotalEl) grandTotalEl.textContent = "Rp 0";
        if (btnCheckout) btnCheckout.disabled = true;
        if (btnHoldOrder) btnHoldOrder.disabled = true;
        return;
    }

    let subtotal = 0;
    cart.forEach(item => {
        subtotal += item.price * item.qty;
        const itemEl = document.createElement("div");
        itemEl.className = "cart-item";
        itemEl.innerHTML = `
            <div class="cart-item-info">
                <h5>${item.name}</h5>
                <small>${formatRupiah(item.price * item.qty)}</small>
            </div>
            <div class="cart-item-controls">
                <button type="button" class="btn-qty" onclick="updateQty('${item.id}', -1)">-</button>
                <span>${item.qty}</span>
                <button type="button" class="btn-qty" onclick="updateQty('${item.id}', 1)">+</button>
            </div>
        `;
        cartItemsContainer.appendChild(itemEl);
    });

    const tax = subtotal * (appSettings.taxRate / 100);
    const grandTotal = subtotal + tax + appSettings.serviceFee;

    if (subtotalEl) subtotalEl.textContent = formatRupiah(subtotal);
    if (taxEl) taxEl.textContent = formatRupiah(tax);
    if (grandTotalEl) grandTotalEl.textContent = formatRupiah(grandTotal);
    if (btnCheckout) btnCheckout.disabled = false;
    if (btnHoldOrder) btnHoldOrder.disabled = false;
};

// ==========================================================================
// ANTREAN PENDING, RIWAYAT & LAPORAN
// ==========================================================================
const updatePendingUI = () => {
    const badge = document.getElementById("pendingBadge");
    if (badge) {
        badge.style.display = pendingOrders.length > 0 ? "inline-block" : "none";
        badge.textContent = pendingOrders.length;
    }

    const grid = document.getElementById("pendingOrdersGrid");
    if (!grid) return;

    if (pendingOrders.length === 0) {
        grid.innerHTML = `
            <div class="table-card text-center" style="grid-column: 1 / -1; padding: 32px;">
                <i class="fa-solid fa-mug-saucer" style="font-size: 2rem; opacity: 0.4; margin-bottom: 8px;"></i>
                <p>Tidak ada antrean pesanan pending saat ini.</p>
            </div>`;
        return;
    }

    grid.innerHTML = "";
    pendingOrders.forEach(order => {
        const itemsListHTML = (order.items || []).map(i => `
            <li><span>${i.qty}x ${i.name}</span><span>${formatRupiah(i.price * i.qty)}</span></li>
        `).join("");

        const card = document.createElement("div");
        card.className = "pending-card";
        card.innerHTML = `
            <div>
                <div class="pending-card-header">
                    <div>
                        <h4>${order.customer}</h4>
                        <small style="color: var(--text-secondary);"><i class="fa-regular fa-clock"></i> ${order.time} • ${order.id}</small>
                    </div>
                    <span class="pending-badge-type">${order.type}</span>
                </div>
                <ul class="pending-items-list" style="margin-top: 10px;">${itemsListHTML}</ul>
            </div>
            <div class="pending-card-footer">
                <div class="pending-total-row"><span>Total Sementara</span><span>${formatRupiah(order.total)}</span></div>
                <div class="pending-btn-group">
                    <button type="button" class="btn-resume-pending" onclick="resumePendingOrder('${order.id}')">
                        <i class="fa-solid fa-cart-arrow-down"></i> Lanjutkan ke Kasir
                    </button>
                    <button type="button" class="btn-delete-trx" onclick="deletePendingOrder('${order.id}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
};

window.resumePendingOrder = (pendingId) => {
    const target = pendingOrders.find(p => p.id === pendingId);
    if (!target) return;
    if (cart.length > 0 && !confirm("Keranjang kasir masih berisi pesanan. Ganti dengan pesanan antrean ini?")) return;

    cart = (target.items || []).map(item => ({ ...item }));
    const custInput = document.getElementById("customerName");
    if (custInput) custInput.value = target.customer.startsWith("Antrean #") ? "" : target.customer;
    currentOrderType = target.type;

    document.querySelectorAll(".type-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.type === currentOrderType));
    pendingOrders = pendingOrders.filter(p => p.id !== pendingId);
    persistPending();
    updateCartUI();
    updatePendingUI();
    switchToPage("menu-page");
};

window.deletePendingOrder = (pendingId) => {
    if (confirm("Hapus pesanan pending ini dari antrean?")) {
        pendingOrders = pendingOrders.filter(p => p.id !== pendingId);
        persistPending();
        updatePendingUI();
    }
};

const updateHistoryTable = () => {
    const tbody = document.getElementById("historyTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center">Belum ada riwayat transaksi.</td></tr>`;
        return;
    }

    transactions.forEach(trx => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${trx.id}</strong></td>
            <td>${trx.time} (${trx.date})</td>
            <td>${trx.customer}</td>
            <td>${trx.type}</td>
            <td>${trx.method}</td>
            <td>${formatRupiah(trx.total)}</td>
            <td>
                <div class="btn-action-group">
                    <button class="btn-print-trx" onclick="viewReceiptFromHistory('${trx.id}')"><i class="fa-solid fa-print"></i> Cetak</button>
                    <button class="btn-delete-trx" onclick="deleteTransaction('${trx.id}')"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.deleteTransaction = (trxId) => {
    if (confirm(`Apakah Anda yakin ingin menghapus transaksi ${trxId}?`)) {
        transactions = transactions.filter(t => t.id !== trxId);
        persistTransactions();
        syncAllViews();
    }
};

window.viewReceiptFromHistory = (trxId) => {
    const target = transactions.find(t => t.id === trxId);
    if (target) showReceiptModal(target);
};

const updateReportSummary = () => {
    let totalRevenue = 0;
    const itemSales = {};

    transactions.forEach(trx => {
        const trxTotal = Number(trx.total) || 0;
        totalRevenue += trxTotal;
        if (Array.isArray(trx.items)) {
            trx.items.forEach(item => {
                const name = item.name || "Produk";
                const qty = Number(item.qty) || 1;
                const price = Number(item.price) || 0;
                if (!itemSales[name]) itemSales[name] = { category: item.category || "umum", qty: 0, revenue: 0 };
                itemSales[name].qty += qty;
                itemSales[name].revenue += (price * qty);
            });
        }
    });

    const revEl = document.getElementById("statTotalRevenue");
    const ordEl = document.getElementById("statTotalOrders");
    const topEl = document.getElementById("statTopProduct");
    const reportTbody = document.getElementById("reportTableBody");

    if (revEl) revEl.textContent = formatRupiah(totalRevenue);
    if (ordEl) ordEl.textContent = transactions.length;

    let topProduct = "-";
    let maxQty = 0;
    for (const [name, data] of Object.entries(itemSales)) {
        if (data.qty > maxQty) { maxQty = data.qty; topProduct = name; }
    }
    if (topEl) topEl.textContent = topProduct;

    if (!reportTbody) return;
    reportTbody.innerHTML = Object.keys(itemSales).length === 0
        ? `<tr><td colspan="4" class="text-center">Belum ada data penjualan.</td></tr>`
        : Object.entries(itemSales).map(([name, d]) => `<tr><td><strong>${name}</strong></td><td>${d.category}</td><td>${d.qty} pcs</td><td>${formatRupiah(d.revenue)}</td></tr>`).join("");
};

const showReceiptModal = (trx) => {
    currentReceiptData = trx;
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText("rcStoreName", appSettings.storeName.toUpperCase());
    setText("rcStoreTagline", appSettings.slogan);
    setText("rcStoreAddress", appSettings.address);
    setText("rcStorePhone", "Telp: " + appSettings.phone);
    setText("rcTrxId", trx.id);

    const now = new Date();
    setText("rcDateTime", `${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`);
    setText("rcCustomer", trx.customer);
    setText("rcOrderType", trx.type);

    const itemsContainer = document.getElementById("rcItemsList");
    if (itemsContainer) {
        itemsContainer.innerHTML = (trx.items || []).map(item => `
            <div class="rc-item">
                <div class="rc-item-title">${item.name}</div>
                <div class="rc-item-calc"><span>${item.qty} x ${formatRupiah(item.price)}</span><span>${formatRupiah(item.price * item.qty)}</span></div>
            </div>
        `).join("");
    }

    setText("rcSubtotal", formatRupiah(trx.subtotal || trx.total));
    setText("rcTaxPercent", appSettings.taxRate);
    setText("rcTax", formatRupiah(trx.tax || 0));
    setText("rcGrandTotal", formatRupiah(trx.total));
    setText("rcPayMethod", trx.method);
    setText("rcPaid", formatRupiah(trx.paid || trx.total));
    setText("rcChange", formatRupiah(trx.change || 0));
    setText("rcFooterHeader", appSettings.receiptHeader);

    const footerMsg = document.getElementById("rcFooterMessage");
    if (footerMsg) footerMsg.innerHTML = appSettings.receiptFooter.replace(/\n/g, "<br>");

    const rModal = document.getElementById("receiptModal");
    if (rModal) rModal.classList.add("active");
};

// ==========================================================================
// NAVIGASI & EVENT LISTENERS (SEMUA AMAN DENGAN PENGECEKAN)
// ==========================================================================
const closeMobileDrawers = () => {
    const sb = document.getElementById("sidebar");
    const cs = document.getElementById("cartSection");
    const bd = document.getElementById("mobileBackdrop");
    if (sb) sb.classList.remove("mobile-open");
    if (cs) cs.classList.remove("mobile-cart-open");
    if (bd) bd.classList.remove("active");
};

const switchToPage = (targetPage) => {
    document.querySelectorAll(".nav-link").forEach(l => l.classList.toggle("active", l.dataset.page === targetPage));
    document.querySelectorAll(".page-content").forEach(p => p.classList.toggle("active", p.id === targetPage));
    if (["history-page", "report-page", "pending-page"].includes(targetPage)) syncAllViews();
    if (window.innerWidth <= 768) closeMobileDrawers();
};

const initEventListeners = () => {
    const appContainer = document.querySelector(".app-container");
    const sidebar = document.getElementById("sidebar");
    const cartSection = document.getElementById("cartSection");
    const mobileBackdrop = document.getElementById("mobileBackdrop");

    const on = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };

    on("sidebarToggle", "click", () => {
        if (sidebar) sidebar.classList.toggle("collapsed");
        if (appContainer) appContainer.classList.toggle("sidebar-collapsed");
    });

    on("mobileSidebarToggle", "click", () => {
        if (sidebar) sidebar.classList.add("mobile-open");
        if (mobileBackdrop) mobileBackdrop.classList.add("active");
    });

    on("mobileCartToggle", "click", () => {
        if (cartSection) cartSection.classList.add("mobile-cart-open");
        if (mobileBackdrop) mobileBackdrop.classList.add("active");
    });

    on("mobileCloseCart", "click", closeMobileDrawers);
    on("mobileBackdrop", "click", closeMobileDrawers);

    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            switchToPage(link.dataset.page);
        });
    });

    on("categoryContainer", "click", (e) => {
        const btn = e.target.closest(".cat-btn");
        if (!btn) return;
        document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeCategory = btn.dataset.category;
        renderMenu();
    });

    on("searchInput", "input", (e) => {
        searchQuery = e.target.value;
        renderMenu();
    });

    on("btnClearCart", "click", () => { cart = []; updateCartUI(); });

    on("btnHoldOrder", "click", () => {
        if (cart.length === 0) return;
        const now = new Date();
        const custInput = document.getElementById("customerName");
        const customer = (custInput && custInput.value.trim()) || `Antrean #${pendingOrders.length + 1}`;
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const total = subtotal + (subtotal * (appSettings.taxRate / 100)) + appSettings.serviceFee;

        pendingOrders.unshift({
            id: "PEND-" + Date.now().toString().slice(-4),
            time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            customer,
            type: currentOrderType,
            items: cart.map(i => ({ ...i })),
            total
        });
        persistPending();
        cart = [];
        if (custInput) custInput.value = "";
        updateCartUI();
        updatePendingUI();
        if (window.innerWidth <= 768) closeMobileDrawers();
    });

    on("btnCheckout", "click", () => {
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const grandTotal = subtotal + (subtotal * (appSettings.taxRate / 100)) + appSettings.serviceFee;
        const modalTotal = document.getElementById("modalTotal");
        const cashAmountInput = document.getElementById("cashAmount");
        const changeAmountEl = document.getElementById("changeAmount");
        const paymentModal = document.getElementById("paymentModal");

        if (modalTotal) modalTotal.textContent = formatRupiah(grandTotal);
        if (cashAmountInput) cashAmountInput.value = "";
        if (changeAmountEl) changeAmountEl.textContent = "Rp 0";

        const cashRadio = document.querySelector('input[name="payMethod"][value="Cash"]');
        if (cashRadio) { cashRadio.checked = true; cashRadio.dispatchEvent(new Event('change')); }
        if (paymentModal) paymentModal.classList.add("active");
    });

    on("btnCloseModal", "click", () => {
        const pm = document.getElementById("paymentModal");
        if (pm) pm.classList.remove("active");
    });

    document.querySelectorAll('input[name="payMethod"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('active'));
            e.target.closest('.pay-method').classList.add('active');
            const cashGroup = document.getElementById("cashGroup");
            const qrisGroup = document.getElementById("qrisGroup");
            const qrisImage = document.getElementById("qrisImage");
            if (e.target.value === 'QRIS') {
                if (cashGroup) cashGroup.style.display = 'none';
                if (qrisGroup) qrisGroup.style.display = 'block';
                if (qrisImage) qrisImage.src = appSettings.qrisPath;
            } else {
                if (cashGroup) cashGroup.style.display = 'flex';
                if (qrisGroup) qrisGroup.style.display = 'none';
            }
        });
    });

    on("cashAmount", "input", (e) => {
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const grandTotal = subtotal + (subtotal * (appSettings.taxRate / 100)) + appSettings.serviceFee;
        const change = (parseFloat(e.target.value) || 0) - grandTotal;
        const changeEl = document.getElementById("changeAmount");
        if (changeEl) changeEl.textContent = change >= 0 ? formatRupiah(change) : "Uang Kurang";
    });

    document.querySelectorAll(".btn-quick").forEach(btn => {
        btn.addEventListener("click", () => {
            const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
            const grandTotal = subtotal + (subtotal * (appSettings.taxRate / 100)) + appSettings.serviceFee;
            const cashInput = document.getElementById("cashAmount");
            if (cashInput) {
                cashInput.value = btn.dataset.val === "exact" ? grandTotal : btn.dataset.val;
                cashInput.dispatchEvent(new Event("input"));
            }
        });
    });

    on("btnConfirmPay", "click", () => {
        const custInput = document.getElementById("customerName");
        const customer = (custInput && custInput.value.trim()) || "-";
        const payRadio = document.querySelector('input[name="payMethod"]:checked');
        const payMethod = payRadio ? payRadio.value : "Cash";
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const tax = subtotal * (appSettings.taxRate / 100);
        const grandTotal = subtotal + tax + appSettings.serviceFee;

        let paidAmount = grandTotal;
        let changeAmount = 0;

        if (payMethod === "Cash") {
            const cashInput = document.getElementById("cashAmount");
            paidAmount = (cashInput && parseFloat(cashInput.value)) || 0;
            if (paidAmount < grandTotal) { alert("Jumlah uang tunai yang diterima kurang!"); return; }
            changeAmount = paidAmount - grandTotal;
        }

        const now = new Date();
        const trx = {
            id: "SM-" + Date.now().toString().slice(-4),
            time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            date: now.toLocaleDateString('id-ID'),
            customer,
            type: currentOrderType,
            method: payMethod,
            items: cart.map(item => ({ id: item.id, name: item.name, price: Number(item.price), qty: Number(item.qty), category: item.category })),
            subtotal,
            tax,
            total: grandTotal,
            paid: paidAmount,
            change: changeAmount
        };

        transactions.unshift(trx);
        persistTransactions();
        syncAllViews();

        cart = [];
        if (custInput) custInput.value = "";
        updateCartUI();

        const pm = document.getElementById("paymentModal");
        if (pm) pm.classList.remove("active");
        if (window.innerWidth <= 768) closeMobileDrawers();

        showReceiptModal(trx);
        if (appSettings.autoPrint) setTimeout(() => window.print(), 400);
    });

    on("beadVariantType", "change", populateBeadPrices);
    on("btnCloseCustomModal", "click", () => {
        const cm = document.getElementById("customBeadModal");
        if (cm) cm.classList.remove("active");
    });

    on("btnConfirmCustomBead", "click", () => {
        const priceSel = document.getElementById("beadVariantPrice");
        if (!selectedBeadProduct || !priceSel) return;
        const opt = priceSel.options[priceSel.selectedIndex];
        if (!opt) return;
        addToCart({
            id: `bead_${opt.dataset.name.replace(/\s+/g, '_')}`,
            name: `${selectedBeadProduct.name} (${opt.dataset.name})`,
            price: parseFloat(opt.value),
            category: selectedBeadProduct.category,
            img: selectedBeadProduct.img
        });
        const cm = document.getElementById("customBeadModal");
        if (cm) cm.classList.remove("active");
    });

    on("btnPrintReceiptNow", "click", () => window.print());
    on("btnCloseReceiptModal", "click", () => {
        const rm = document.getElementById("receiptModal");
        if (rm) rm.classList.remove("active");
    });

    document.querySelectorAll(".type-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            currentOrderType = e.target.dataset.type;
        });
    });

    document.querySelectorAll(".setting-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".setting-tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".setting-panel").forEach(p => p.classList.remove("active"));
            tab.classList.add("active");
            const panel = document.getElementById(tab.dataset.tab);
            if (panel) panel.classList.add("active");
        });
    });

    on("qrisImagePath", "input", (e) => {
        const prev = document.getElementById("cfgQrisPreview");
        if (prev) prev.src = e.target.value;
    });

    on("btnSaveSettings", "click", () => {
        const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
        appSettings.storeName = getVal("cfgStoreName");
        appSettings.slogan = getVal("cfgSlogan");
        appSettings.address = getVal("cfgAddress");
        appSettings.phone = getVal("cfgPhone");
        appSettings.taxRate = parseFloat(getVal("cfgTaxRate")) || 0;
        appSettings.serviceFee = parseFloat(getVal("cfgServiceFee")) || 0;
        appSettings.qrisPath = getVal("qrisImagePath");
        appSettings.receiptHeader = getVal("cfgReceiptHeader");
        appSettings.receiptFooter = getVal("cfgReceiptFooter");
        const ap = document.getElementById("cfgAutoPrint");
        appSettings.autoPrint = ap ? ap.checked : true;

        localStorage.setItem("sweet_memories_settings", JSON.stringify(appSettings));
        if (db) db.ref("sweet_memories/settings").set(appSettings);
        applySettingsToForm();
        updateCartUI();
        alert("Pengaturan sistem berhasil disimpan!");
    });

    on("btnClearHistory", "click", () => {
        if (confirm("Hapus seluruh riwayat transaksi di semua perangkat?")) {
            transactions = [];
            persistTransactions();
            syncAllViews();
        }
    });

    on("btnBackupData", "click", () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ settings: appSettings, transactions, pendingOrders }, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = `Backup_Kasir_SweetMemories_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    });

    on("btnExportExcel", "click", () => {
        if (transactions.length === 0) { alert("Belum ada data transaksi!"); return; }
        let rows = transactions.map(t => `<tr><td>${t.id}</td><td>${t.time} (${t.date})</td><td>${t.customer}</td><td>${t.type}</td><td>${t.method}</td><td>${formatRupiah(t.total)}</td></tr>`).join("");
        let html = `<table><thead><tr><th>ID</th><th>Waktu</th><th>Pelanggan</th><th>Tipe</th><th>Metode</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Laporan_SweetMemories_${new Date().toISOString().slice(0, 10)}.xls`;
        a.click();
    });
};

// Jalankan setelah DOM siap sepenuhnya
document.addEventListener("DOMContentLoaded", () => {
    initEventListeners();
    loadSettings();
    initRealtimeCloudSync();
    startRealtimeClock();
    renderMenu();
});