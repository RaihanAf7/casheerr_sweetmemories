// ==========================================================================
// KONFIGURASI FIREBASE REALTIME DATABASE
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBS1lv6GildLilRzjXxaIyAZCO9XO2Dd-g",
    authDomain: "sweet-memories-kasir.firebaseapp.com",
    databaseURL: "https://sweet-memories-kasir-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sweet-memories-kasir",
    storageBucket: "sweet-memories-kasir.firebasestorage.app",
    messagingSenderId: "50808003358",
    appId: "1:50808003358:web:9eaccbcb444bf3c638470f",
    measurementId: "G-7CSJPB1RCD"
};

let db = null;
let auth = null;
let isAdmin = false;

try {
    if (typeof firebase !== "undefined") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        if (firebase.auth) {
            auth = firebase.auth();
        }
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
let btPrinterCharacteristic = null;

// Jumlah karakter per baris printer thermal (48 untuk kertas lebar 80mm, 32 untuk kertas 58mm)
const RECEIPT_LINE_WIDTH = 32;

let appSettings = {
    storeName: "Sweet Memories",
    slogan: "Dibuat dengan rasa, dikenang selamanya..",
    address: "Jl. Pantura No.6, Kalodran, Kec. Walantaka, Kota Serang, Banten 42183",
    phone: "0853-1955-8384",
    taxRate: 0,
    serviceFee: 0,
    receiptHeader: "Selamat Datang di Sweet Memories!",
    receiptFooter: "Terima kasih atas kunjungannya, datang kembali ya! ♥",
    autoPrint: true
};

const menuItems = [
    { id: 1, name: "Donat Jadoel", price: 3500, category: "makanan", img: "pict/img/Donat.png" },
    { id: 2, name: "Bomboloni", price: 4000, category: "makanan", img: "pict/img/Bomboloni.png" },
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
// CETAK LANGSUNG KE PRINTER THERMAL BLUETOOTH (ESC/POS)
// ==========================================================================
const connectBluetoothPrinter = async () => {
    if (!navigator.bluetooth) {
        throw new Error("Browser ini tidak mendukung Bluetooth langsung. Gunakan Google Chrome di Android/Windows.");
    }

    if (btPrinterCharacteristic && btPrinterCharacteristic.service && btPrinterCharacteristic.service.device.gatt.connected) {
        return btPrinterCharacteristic;
    }

    const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
            "000018f0-0000-1000-8000-00805f9b34fb",
            "0000ff00-0000-1000-8000-00805f9b34fb",
            "49535343-fe7d-4ae5-8fa9-9fafd205e455",
            "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
            "0000ae30-0000-1000-8000-00805f9b34fb"
        ]
    });

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();

    for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
                btPrinterCharacteristic = char;
                return char;
            }
        }
    }

    throw new Error("Port cetak Bluetooth printer tidak ditemukan.");
};

// Format baris kiri-kanan sesuai lebar kolom kertas thermal
const formatReceiptLine = (left, right, width = RECEIPT_LINE_WIDTH) => {
    const l = String(left || "");
    const r = String(right || "");
    if (l.length + r.length + 1 > width) {
        return l.slice(0, Math.max(0, width - r.length - 1)) + " " + r + "\n";
    }
    const spaceCount = width - l.length - r.length;
    return l + " ".repeat(spaceCount) + r + "\n";
};

// Bungkus teks panjang agar rapi menyesuaikan lebar kertas thermal
const wrapReceiptText = (text, width = RECEIPT_LINE_WIDTH) => {
    const words = String(text || "").split(/\s+/);
    let lines = [];
    let currentLine = "";

    words.forEach(word => {
        if ((currentLine + (currentLine ? " " : "") + word).length <= width) {
            currentLine += (currentLine ? " " : "") + word;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    });
    if (currentLine) lines.push(currentLine);
    return lines.join("\n") + "\n";
};

const buildEscPosReceipt = (trx, width = RECEIPT_LINE_WIDTH) => {
    const ESC = "\x1B";
    const GS = "\x1D";
    const INIT = ESC + "@";
    const CENTER = ESC + "a\x01";
    const LEFT = ESC + "a\x00";
    const BOLD_ON = ESC + "E\x01";
    const BOLD_OFF = ESC + "E\x00";
    const DOUBLE_HW = GS + "!\x11";
    const NORMAL_SIZE = GS + "!\x00";
    const CUT = GS + "V\x41\x03";

    const line = "-".repeat(width) + "\n";
    const dline = "=".repeat(width) + "\n";
    const rp = (n) => "Rp " + (Number(n) || 0).toLocaleString("id-ID");

    let text = INIT;
    text += CENTER + BOLD_ON + DOUBLE_HW + appSettings.storeName.toUpperCase() + "\n" + NORMAL_SIZE + BOLD_OFF;
    text += wrapReceiptText(appSettings.slogan, width);
    text += wrapReceiptText(appSettings.address, width);
    text += "Telp: " + appSettings.phone + "\n";
    text += LEFT + dline;

    text += formatReceiptLine("No. Trx", trx.id, width);
    text += formatReceiptLine("Waktu", `${trx.date} ${trx.time}`, width);
    text += formatReceiptLine("Pelanggan", trx.customer, width);
    text += formatReceiptLine("Tipe", trx.type, width);
    text += line;

    (trx.items || []).forEach(item => {
        text += BOLD_ON + item.name + BOLD_OFF + "\n";
        text += formatReceiptLine(`  ${item.qty} x ${rp(item.price)}`, rp(item.price * item.qty), width);
    });

    text += line;
    text += formatReceiptLine("Subtotal", rp(trx.subtotal ?? trx.total), width);
    text += formatReceiptLine(`Pajak (${appSettings.taxRate}%)`, rp(trx.tax ?? 0), width);
    text += BOLD_ON + formatReceiptLine("TOTAL BAYAR", rp(trx.total), width) + BOLD_OFF;
    text += formatReceiptLine("Metode", trx.method, width);
    text += formatReceiptLine("Tunai", rp(trx.paid ?? trx.total), width);
    text += BOLD_ON + formatReceiptLine("Kembalian", rp(trx.change ?? 0), width) + BOLD_OFF;
    text += dline;

    text += CENTER + BOLD_ON + wrapReceiptText(appSettings.receiptHeader, width) + BOLD_OFF;
    text += wrapReceiptText(appSettings.receiptFooter, width) + "\n\n\n";
    text += CUT;

    return text.replace(/[^\x00-\x7F]/g, "");
};

const printReceiptBluetooth = async (trx) => {
    if (!trx) return;
    try {
        const char = await connectBluetoothPrinter();
        const rawPayload = buildEscPosReceipt(trx);
        const encoder = new TextEncoder();
        const data = encoder.encode(rawPayload);

        const chunkSize = 100;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            if (char.properties.writeWithoutResponse) {
                await char.writeValueWithoutResponse(chunk);
            } else {
                await char.writeValue(chunk);
            }
            await new Promise(r => setTimeout(r, 25));
        }

        showWebAlert("Struk berhasil dicetak ke printer Bluetooth!", "Cetak Berhasil", "success");
    } catch (err) {
        showWebAlert("Gagal cetak Bluetooth: " + err.message, "Printer Bluetooth", "error");
    }
};

// ==========================================================================
// CUSTOM POP-UP NOTIFIKASI & KONFIRMASI DI DALAM WEB (AUTO-INJECT HTML)
// ==========================================================================
const ensureWebAlertModal = () => {
    let modal = document.getElementById("webAlertModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.className = "modal-overlay";
        modal.id = "webAlertModal";
        modal.innerHTML = `
            <div class="modal-card web-alert-card">
                <div class="web-alert-icon" id="webAlertIcon">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
                <h3 id="webAlertTitle">Berhasil</h3>
                <p id="webAlertMessage">Pesan notifikasi</p>
                <div class="web-alert-actions" id="webAlertActions">
                    <button type="button" class="btn-secondary" id="btnWebAlertCancel" style="display: none;">Batal</button>
                    <button type="button" class="btn-confirm" id="btnWebAlertOk" style="margin-top: 0;">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    return modal;
};

const showWebAlert = (message, title = "Informasi", type = "info") => {
    const modal = ensureWebAlertModal();

    const iconEl = document.getElementById("webAlertIcon");
    const titleEl = document.getElementById("webAlertTitle");
    const msgEl = document.getElementById("webAlertMessage");
    const btnCancel = document.getElementById("btnWebAlertCancel");
    const btnOk = document.getElementById("btnWebAlertOk");

    titleEl.textContent = title;
    msgEl.textContent = message;
    btnCancel.style.display = "none";
    btnOk.textContent = "OK";

    iconEl.className = "web-alert-icon";
    if (type === "success") {
        iconEl.classList.add("success");
        iconEl.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
    } else if (type === "error") {
        iconEl.classList.add("error");
        iconEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i>`;
    } else {
        iconEl.innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
    }

    modal.classList.add("active");
    btnOk.onclick = () => modal.classList.remove("active");
};

const showWebConfirm = (message, title = "Konfirmasi", onConfirm) => {
    const modal = ensureWebAlertModal();

    const iconEl = document.getElementById("webAlertIcon");
    const titleEl = document.getElementById("webAlertTitle");
    const msgEl = document.getElementById("webAlertMessage");
    const btnCancel = document.getElementById("btnWebAlertCancel");
    const btnOk = document.getElementById("btnWebAlertOk");

    titleEl.textContent = title;
    msgEl.textContent = message;
    btnCancel.style.display = "inline-block";
    btnOk.textContent = "Ya, Lanjutkan";

    iconEl.className = "web-alert-icon error";
    iconEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>`;

    modal.classList.add("active");

    btnCancel.onclick = () => modal.classList.remove("active");
    btnOk.onclick = () => {
        modal.classList.remove("active");
        if (typeof onConfirm === "function") onConfirm();
    };
};

// ==========================================================================
// COPYRIGHT FOOTER DI SIDEBAR
// ==========================================================================
const renderSidebarCopyright = () => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || document.getElementById("sidebarCopyright")) return;
    const footer = document.createElement("div");
    footer.className = "sidebar-copyright";
    footer.id = "sidebarCopyright";
    footer.innerHTML = `
        <strong>&copy; Copyright 2026 by Raihan.</strong>
        <small>Teknologi &amp; Media Informasi</small>
    `;
    sidebar.appendChild(footer);
};

// ==========================================================================
// KONTROL AKSES ADMIN (TOLAK LAPORAN PENJUALAN & PENGATURAN DI MODE TAMU)
// ==========================================================================
const updateAdminUI = () => {
    const btnAuth = document.getElementById("btnAdminAuth");
    if (btnAuth) {
        if (isAdmin) {
            btnAuth.innerHTML = `<i class="fa-solid fa-lock-open"></i> Admin Aktif (Logout)`;
            btnAuth.style.background = "var(--success-color)";
            btnAuth.style.color = "#fff";
        } else {
            btnAuth.innerHTML = `<i class="fa-solid fa-lock"></i> Mode Tamu (Login)`;
            btnAuth.style.background = "";
            btnAuth.style.color = "";
        }
    }

    // Sembunyikan menu Laporan Penjualan dan Pengaturan dari sidebar saat Mode Tamu
    const restrictedNavs = [
        '.nav-link[data-page="report-page"]',
        '.nav-link[data-page="settings-page"]'
    ];
    restrictedNavs.forEach(selector => {
        const navEl = document.querySelector(selector);
        if (navEl) navEl.style.display = isAdmin ? "" : "none";
    });

    // Jika sedang di halaman Laporan Penjualan atau Pengaturan lalu logout ke Mode Tamu, arahkan ke Menu Utama
    const reportPage = document.getElementById("report-page");
    const settingsPage = document.getElementById("settings-page");
    if (!isAdmin && ((reportPage && reportPage.classList.contains("active")) || (settingsPage && settingsPage.classList.contains("active")))) {
        switchToPage("menu-page");
    }

    const cartSection = document.getElementById("cartSection");
    if (cartSection) cartSection.style.display = "";

    const mobileCartToggle = document.getElementById("mobileCartToggle");
    if (mobileCartToggle) mobileCartToggle.style.display = "";

    const btnHoldOrder = document.getElementById("btnHoldOrder");
    const btnCheckout = document.getElementById("btnCheckout");
    const actionsRow = document.querySelector(".cart-actions-row");

    if (isAdmin) {
        if (actionsRow) actionsRow.style.gridTemplateColumns = "auto 1fr";
        if (btnHoldOrder) btnHoldOrder.style.display = "";
        if (btnCheckout) {
            btnCheckout.innerHTML = `Bayar Sekarang <i class="fa-solid fa-arrow-right"></i>`;
        }
    } else {
        if (actionsRow) actionsRow.style.gridTemplateColumns = "1fr";
        if (btnHoldOrder) btnHoldOrder.style.display = "none";
        if (btnCheckout) {
            btnCheckout.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Pesan (Masuk Pending)`;
        }
    }

    const adminOnlySelectors = [
        "#btnSaveSettings",
        "#btnClearHistory",
        ".btn-delete-trx",
        ".btn-resume-pending"
    ];

    adminOnlySelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.display = isAdmin ? "" : "none";
        });
    });

    document.querySelectorAll("#settings-page input").forEach(input => {
        input.disabled = !isAdmin;
    });
};

// ==========================================================================
// SINKRONISASI LOKAL + CLOUD FIREBASE
// ==========================================================================
const persistTransactions = () => {
    if (!isAdmin) return;
    localStorage.setItem("sweet_memories_transactions", JSON.stringify(transactions));
    if (db) db.ref("sweet_memories/transactions").set(transactions);
};

const persistPending = () => {
    localStorage.setItem("sweet_memories_pending", JSON.stringify(pendingOrders));
    if (db) {
        db.ref("sweet_memories/pendingOrders").set(pendingOrders);
    }
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
    setVal("cfgReceiptHeader", appSettings.receiptHeader);
    setVal("cfgReceiptFooter", appSettings.receiptFooter);

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
    updateAdminUI();
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
    updateAdminUI();
};

window.resumePendingOrder = (pendingId) => {
    if (!isAdmin) return;
    const target = pendingOrders.find(p => p.id === pendingId);
    if (!target) return;

    const proceedResume = () => {
        cart = (target.items || []).map(item => ({ ...item }));
        const custInput = document.getElementById("customerName");
        if (custInput) custInput.value = (target.customer.startsWith("Antrean #") || target.customer.startsWith("Tamu #")) ? "" : target.customer;
        currentOrderType = target.type;

        document.querySelectorAll(".type-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.type === currentOrderType));
        pendingOrders = pendingOrders.filter(p => p.id !== pendingId);
        persistPending();
        updateCartUI();
        updatePendingUI();
        switchToPage("menu-page");
    };

    if (cart.length > 0) {
        showWebConfirm("Keranjang kasir masih berisi pesanan. Ganti dengan pesanan antrean ini?", "Ganti Keranjang", proceedResume);
    } else {
        proceedResume();
    }
};

window.deletePendingOrder = (pendingId) => {
    if (!isAdmin) return;
    showWebConfirm("Hapus pesanan pending ini dari antrean?", "Hapus Antrean", () => {
        pendingOrders = pendingOrders.filter(p => p.id !== pendingId);
        persistPending();
        updatePendingUI();
    });
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
    updateAdminUI();
};

window.deleteTransaction = (trxId) => {
    if (!isAdmin) return;
    showWebConfirm(`Apakah Anda yakin ingin menghapus transaksi ${trxId}?`, "Hapus Transaksi", () => {
        transactions = transactions.filter(t => t.id !== trxId);
        persistTransactions();
        syncAllViews();
    });
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
// NAVIGASI & EVENT LISTENERS
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
    // Tolak akses Laporan Penjualan dan Pengaturan jika Mode Tamu
    if ((targetPage === "settings-page" || targetPage === "report-page") && !isAdmin) {
        showWebAlert("Akses ditolak! Halaman ini hanya dapat dibuka oleh Admin.", "Akses Ditolak", "error");
        return;
    }

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

    if (auth) {
        auth.onAuthStateChanged((user) => {
            isAdmin = !!user;
            updateAdminUI();
            syncAllViews();
        });
    }

    on("btnAdminAuth", "click", () => {
        if (isAdmin && auth) {
            showWebConfirm("Keluar dari mode Admin? Web akan kembali ke Mode Tamu.", "Logout Admin", () => {
                auth.signOut();
            });
        } else {
            const lm = document.getElementById("adminLoginModal");
            const errEl = document.getElementById("loginErrorMsg");
            if (errEl) errEl.style.display = "none";
            if (lm) lm.classList.add("active");
        }
    });

    on("btnCloseLoginModal", "click", () => {
        const lm = document.getElementById("adminLoginModal");
        if (lm) lm.classList.remove("active");
    });

    on("btnSubmitAdminLogin", "click", () => {
        if (!auth) return;
        const email = document.getElementById("adminEmail").value.trim();
        const pass = document.getElementById("adminPassword").value;
        const errEl = document.getElementById("loginErrorMsg");

        auth.signInWithEmailAndPassword(email, pass)
            .then(() => {
                document.getElementById("adminLoginModal").classList.remove("active");
                document.getElementById("adminPassword").value = "";
            })
            .catch(() => {
                if (errEl) {
                    errEl.textContent = "Email atau password Admin salah!";
                    errEl.style.display = "block";
                }
            });
    });

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

    on("btnClearCart", "click", () => {
        cart = [];
        updateCartUI();
    });

    const submitOrderToPending = () => {
        if (cart.length === 0) return;
        const now = new Date();
        const custInput = document.getElementById("customerName");
        const customer = (custInput && custInput.value.trim()) || (isAdmin ? `Antrean #${pendingOrders.length + 1}` : `Tamu #${pendingOrders.length + 1}`);
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const total = subtotal + (subtotal * (appSettings.taxRate / 100)) + appSettings.serviceFee;

        const newOrder = {
            id: "PEND-" + Date.now().toString().slice(-4),
            time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            customer,
            type: currentOrderType,
            items: cart.map(i => ({ ...i })),
            total
        };

        if (db) {
            db.ref("sweet_memories/pendingOrders").push(newOrder)
                .then(() => {
                    cart = [];
                    if (custInput) custInput.value = "";
                    updateCartUI();
                    if (window.innerWidth <= 768) closeMobileDrawers();
                    if (!isAdmin) {
                        showWebAlert("Pesanan berhasil dikirim ke Antrean Pending! Silakan konfirmasi ke kasir.", "Pesanan Terkirim", "success");
                        switchToPage("pending-page");
                    } else {
                        showWebAlert("Pesanan berhasil disimpan ke Antrean Pending.", "Antrean Tersimpan", "success");
                    }
                })
                .catch((err) => {
                    showWebAlert("Gagal mengirim pesanan ke server: " + err.message, "Gagal Mengirim", "error");
                });
        } else {
            pendingOrders.unshift(newOrder);
            localStorage.setItem("sweet_memories_pending", JSON.stringify(pendingOrders));
            cart = [];
            if (custInput) custInput.value = "";
            updateCartUI();
            updatePendingUI();
            if (!isAdmin) {
                showWebAlert("Pesanan berhasil dikirim ke Antrean Pending! Silakan konfirmasi ke kasir.", "Pesanan Terkirim", "success");
                switchToPage("pending-page");
            }
        }
    };

    on("btnHoldOrder", "click", () => {
        if (!isAdmin || cart.length === 0) return;
        submitOrderToPending();
    });

    on("btnCheckout", "click", () => {
        if (cart.length === 0) return;
        if (!isAdmin) {
            submitOrderToPending();
            return;
        }
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
                if (qrisImage) qrisImage.src = "pict/img/QRISBarcode.jpeg";
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
        if (!isAdmin) return;
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
            if (paidAmount < grandTotal) {
                showWebAlert("Jumlah uang tunai yang diterima kurang!", "Pembayaran Gagal", "error");
                return;
            }
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
        if (appSettings.autoPrint) {
            if (btPrinterCharacteristic && btPrinterCharacteristic.service && btPrinterCharacteristic.service.device.gatt.connected) {
                printReceiptBluetooth(trx);
            } else {
                setTimeout(() => window.print(), 400);
            }
        }
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

    on("btnPrintBluetooth80", "click", () => {
        if (currentReceiptData) printReceiptBluetooth(currentReceiptData);
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

    on("btnSaveSettings", "click", () => {
        if (!isAdmin) return;
        const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
        appSettings.storeName = getVal("cfgStoreName");
        appSettings.slogan = getVal("cfgSlogan");
        appSettings.address = getVal("cfgAddress");
        appSettings.phone = getVal("cfgPhone");
        appSettings.taxRate = parseFloat(getVal("cfgTaxRate")) || 0;
        appSettings.serviceFee = parseFloat(getVal("cfgServiceFee")) || 0;
        appSettings.receiptHeader = getVal("cfgReceiptHeader");
        appSettings.receiptFooter = getVal("cfgReceiptFooter");
        const ap = document.getElementById("cfgAutoPrint");
        appSettings.autoPrint = ap ? ap.checked : true;

        localStorage.setItem("sweet_memories_settings", JSON.stringify(appSettings));
        if (db) db.ref("sweet_memories/settings").set(appSettings);
        applySettingsToForm();
        updateCartUI();
        showWebAlert("Pengaturan sistem berhasil disimpan!", "Berhasil Disimpan", "success");
    });

    on("btnClearHistory", "click", () => {
        if (!isAdmin) return;
        showWebConfirm("Hapus seluruh riwayat transaksi di semua perangkat?", "Hapus Semua Riwayat", () => {
            transactions = [];
            persistTransactions();
            syncAllViews();
        });
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
        if (transactions.length === 0) {
            showWebAlert("Belum ada data transaksi untuk di-export!", "Data Kosong", "info");
            return;
        }

        const formatRpClean = (num) => "Rp " + (Number(num) || 0).toLocaleString("id-ID");

        let totalOmsetKeseluruhan = 0;
        let totalItemTerjual = 0;

        const rowsHTML = transactions.map((t, index) => {
            const itemsList = Array.isArray(t.items) ? t.items : [];
            const detailPesanan = itemsList.length > 0
                ? itemsList.map(i => `• ${i.name} (${i.qty}x @ ${formatRpClean(i.price)})`).join("<br>")
                : "-";
            const qtyTotalTrx = itemsList.reduce((sum, i) => sum + (Number(i.qty) || 1), 0);

            totalOmsetKeseluruhan += Number(t.total) || 0;
            totalItemTerjual += qtyTotalTrx;

            const rowBg = index % 2 === 1 ? "#FFFDF7" : "#FFFFFF";

            return `
                <tr style="background-color: ${rowBg};">
                    <td style="text-align: center;">${index + 1}</td>
                    <td style="text-align: center; font-weight: bold;">${t.id}</td>
                    <td style="text-align: center;">${t.date} ${t.time}</td>
                    <td>${t.customer}</td>
                    <td style="text-align: center;">${t.type}</td>
                    <td style="line-height: 1.5;">${detailPesanan}</td>
                    <td style="text-align: center; font-weight: bold;">${qtyTotalTrx} pcs</td>
                    <td style="text-align: center;">${t.method}</td>
                    <td style="text-align: right;">${formatRpClean(t.subtotal ?? t.total)}</td>
                    <td style="text-align: right;">${formatRpClean(t.tax ?? 0)}</td>
                    <td style="text-align: right; font-weight: bold; color: #3E2421;">${formatRpClean(t.total)}</td>
                    <td style="text-align: right;">${formatRpClean(t.paid ?? t.total)}</td>
                    <td style="text-align: right;">${formatRpClean(t.change ?? 0)}</td>
                </tr>
            `;
        }).join("");

        const printDate = new Date().toLocaleString("id-ID", {
            dateStyle: "full",
            timeStyle: "short"
        });

        const excelTemplate = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office"
                  xmlns:x="urn:schemas-microsoft-com:office:excel"
                  xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="UTF-8">
                <!--[if gte mso 9]>
                <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                            <x:ExcelWorksheet>
                                <x:Name>Laporan Penjualan</x:Name>
                                <x:WorksheetOptions>
                                    <x:DisplayGridlines/>
                                </x:WorksheetOptions>
                            </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
                    table { border-collapse: collapse; width: 100%; }
                    .title-box { font-size: 15pt; font-weight: bold; color: #3E2421; padding: 6px 0; }
                    .sub-box { font-size: 10pt; color: #555555; padding-bottom: 10px; }
                    th {
                        background-color: #FFD54F;
                        color: #2B1A17;
                        font-weight: bold;
                        border: 1px solid #8C6D1F;
                        padding: 12px 14px;
                        text-align: center;
                        vertical-align: middle;
                        font-size: 11pt;
                    }
                    td {
                        border: 1px solid #CFC6BC;
                        padding: 10px 14px;
                        vertical-align: top;
                        mso-number-format: "\\@";
                    }
                    .total-footer td {
                        background-color: #FFF3CD;
                        font-weight: bold;
                        border: 1px solid #8C6D1F;
                        padding: 11px 14px;
                        font-size: 11pt;
                    }
                </style>
            </head>
            <body>
                <table>
                    <tr>
                        <td colspan="13" style="border: none; padding: 4px 0;" class="title-box">
                            LAPORAN PENJUALAN - ${appSettings.storeName.toUpperCase()}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="13" style="border: none; padding: 0 0 12px 0;" class="sub-box">
                            ${appSettings.address} | Telp: ${appSettings.phone} &bull; Dicetak pada: ${printDate} WIB
                        </td>
                    </tr>
                    <thead>
                        <tr>
                            <th style="width: 45px;">No</th>
                            <th style="width: 100px;">ID Transaksi</th>
                            <th style="width: 145px;">Tanggal &amp; Waktu</th>
                            <th style="width: 165px;">Nama Pelanggan</th>
                            <th style="width: 125px;">Tipe Pelanggan</th>
                            <th style="width: 310px;">Detail Pesanan (Menu &amp; Jumlah)</th>
                            <th style="width: 95px;">Total Qty</th>
                            <th style="width: 95px;">Metode</th>
                            <th style="width: 120px;">Subtotal</th>
                            <th style="width: 100px;">Pajak</th>
                            <th style="width: 130px;">Total Bayar</th>
                            <th style="width: 130px;">Uang Diterima</th>
                            <th style="width: 120px;">Kembalian</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                    </tbody>
                    <tfoot>
                        <tr class="total-footer">
                            <td colspan="6" style="text-align: right;">GRAND TOTAL (${transactions.length} Transaksi)</td>
                            <td style="text-align: center;">${totalItemTerjual} pcs</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right;">${formatRpClean(totalOmsetKeseluruhan)}</td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob(["\uFEFF" + excelTemplate], {
            type: "application/vnd.ms-excel;charset=utf-8;"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Laporan_SweetMemories_${new Date().toISOString().slice(0, 10)}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
};

// Jalankan setelah DOM siap sepenuhnya
document.addEventListener("DOMContentLoaded", () => {
    renderSidebarCopyright();
    initEventListeners();
    loadSettings();
    initRealtimeCloudSync();
    startRealtimeClock();
    renderMenu();
    updateAdminUI();
});
