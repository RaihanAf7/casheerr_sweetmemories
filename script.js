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

// Data Menu Sampel (Tanpa Stok)
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

// Opsi Pilihan Tipe dan Harga Manik-Manik Custom
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

// DOM Elements
const appContainer = document.querySelector(".app-container");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const mobileSidebarToggle = document.getElementById("mobileSidebarToggle");
const menuGrid = document.getElementById("menuGrid");
const cartItemsContainer = document.getElementById("cartItems");
const subtotalEl = document.getElementById("subtotal");
const taxEl = document.getElementById("tax");
const grandTotalEl = document.getElementById("grandTotal");
const btnCheckout = document.getElementById("btnCheckout");
const btnHoldOrder = document.getElementById("btnHoldOrder");
const btnClearCart = document.getElementById("btnClearCart");
const searchInput = document.getElementById("searchInput");
const categoryContainer = document.getElementById("categoryContainer");
const dateDisplay = document.getElementById("dateDisplay");
const customerNameInput = document.getElementById("customerName");

// Modal Elements
const paymentModal = document.getElementById("paymentModal");
const btnCloseModal = document.getElementById("btnCloseModal");
const modalTotal = document.getElementById("modalTotal");
const cashAmountInput = document.getElementById("cashAmount");
const changeAmountEl = document.getElementById("changeAmount");
const btnConfirmPay = document.getElementById("btnConfirmPay");
const cashGroup = document.getElementById("cashGroup");
const qrisGroup = document.getElementById("qrisGroup");
const qrisImage = document.getElementById("qrisImage");

// Receipt Modal Elements
const receiptModal = document.getElementById("receiptModal");
const btnCloseReceiptModal = document.getElementById("btnCloseReceiptModal");
const btnPrintReceiptNow = document.getElementById("btnPrintReceiptNow");

// Modal Custom Bead Elements
const customBeadModal = document.getElementById("customBeadModal");
const btnCloseCustomModal = document.getElementById("btnCloseCustomModal");
const beadVariantTypeSelect = document.getElementById("beadVariantType");
const beadVariantPriceSelect = document.getElementById("beadVariantPrice");
const btnConfirmCustomBead = document.getElementById("btnConfirmCustomBead");

// Format Rupiah
const formatRupiah = (number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(number);

// Load Settings & LocalStorage History
const loadSettings = () => {
    const savedConfig = localStorage.getItem("sweet_memories_settings");
    if (savedConfig) appSettings = { ...appSettings, ...JSON.parse(savedConfig) };

    const savedHistory = localStorage.getItem("sweet_memories_transactions");
    if (savedHistory) {
        try {
            const parsed = JSON.parse(savedHistory);
            transactions = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            transactions = [];
        }
    }

    const savedPending = localStorage.getItem("sweet_memories_pending");
    if (savedPending) {
        try {
            const parsedPending = JSON.parse(savedPending);
            pendingOrders = Array.isArray(parsedPending) ? parsedPending : [];
        } catch (e) {
            pendingOrders = [];
        }
    }

    if (document.getElementById("cfgStoreName")) {
        document.getElementById("cfgStoreName").value = appSettings.storeName;
        document.getElementById("cfgSlogan").value = appSettings.slogan;
        document.getElementById("cfgAddress").value = appSettings.address;
        document.getElementById("cfgPhone").value = appSettings.phone;
        document.getElementById("cfgTaxRate").value = appSettings.taxRate;
        document.getElementById("cfgServiceFee").value = appSettings.serviceFee;
        document.getElementById("qrisImagePath").value = appSettings.qrisPath;
        document.getElementById("cfgQrisPreview").src = appSettings.qrisPath;
        document.getElementById("cfgReceiptHeader").value = appSettings.receiptHeader;
        document.getElementById("cfgReceiptFooter").value = appSettings.receiptFooter;
        document.getElementById("cfgAutoPrint").checked = appSettings.autoPrint;
    }

    const taxLabel = document.getElementById("taxLabel");
    if (taxLabel) taxLabel.textContent = `Pajak (${appSettings.taxRate}%)`;

    syncAllViews();
};

// Sinkronisasi Riwayat, Laporan & Pending
const syncAllViews = () => {
    updateHistoryTable();
    updateReportSummary();
    updatePendingUI();
};

// Realtime Clock
const startRealtimeClock = () => {
    const updateClock = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        dateDisplay.textContent = `${dateStr} - ${timeStr} WIB`;
    };
    updateClock();
    setInterval(updateClock, 1000);
};

// Sidebar Toggle
if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        appContainer.classList.toggle("sidebar-collapsed");
    });
}

if (mobileSidebarToggle) {
    mobileSidebarToggle.addEventListener("click", () => {
        sidebar.classList.toggle("mobile-open");
    });
}

// Otomatis minimalkan sidebar icon-only di layar tablet (<= 1024px)
const autoAdjustLayout = () => {
    if (window.innerWidth <= 1024) {
        sidebar.classList.add("collapsed");
        appContainer.classList.add("sidebar-collapsed");
    } else {
        sidebar.classList.remove("collapsed");
        appContainer.classList.remove("sidebar-collapsed");
    }
};
window.addEventListener("resize", autoAdjustLayout);
autoAdjustLayout();

// Navigation Switcher
const switchToPage = (targetPage) => {
    document.querySelectorAll(".nav-link").forEach(l => {
        l.classList.toggle("active", l.dataset.page === targetPage);
    });
    document.querySelectorAll(".page-content").forEach(p => {
        p.classList.toggle("active", p.id === targetPage);
    });

    if (targetPage === "history-page" || targetPage === "report-page" || targetPage === "pending-page") {
        syncAllViews();
    }

    if (window.innerWidth <= 600) sidebar.classList.remove("mobile-open");
};

document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        switchToPage(link.dataset.page);
    });
});

// Render Menu Cards
const renderMenu = () => {
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

// Logika Klik Produk
const handleProductClick = (product) => {
    if (product.isCustom) {
        selectedBeadProduct = product;
        populateBeadPrices();
        if (customBeadModal) customBeadModal.classList.add("active");
    } else {
        addToCart(product);
    }
};

// Populate Dropdown Variasi Manik-Manik
const populateBeadPrices = () => {
    if (!beadVariantTypeSelect || !beadVariantPriceSelect) return;
    const selectedType = beadVariantTypeSelect.value;
    const options = beadVariants[selectedType] || [];
    
    beadVariantPriceSelect.innerHTML = "";
    options.forEach(opt => {
        const optionEl = document.createElement("option");
        optionEl.value = opt.price;
        optionEl.dataset.name = opt.name;
        optionEl.textContent = `${opt.name} - ${formatRupiah(opt.price)}`;
        beadVariantPriceSelect.appendChild(optionEl);
    });
};

if (beadVariantTypeSelect) {
    beadVariantTypeSelect.addEventListener("change", populateBeadPrices);
}

if (btnConfirmCustomBead) {
    btnConfirmCustomBead.addEventListener("click", () => {
        if (!selectedBeadProduct || !beadVariantPriceSelect) return;

        const selectedOption = beadVariantPriceSelect.options[beadVariantPriceSelect.selectedIndex];
        if (!selectedOption) return;

        const variantName = selectedOption.dataset.name;
        const variantPrice = parseFloat(selectedOption.value);

        const customProductItem = {
            id: `bead_${variantName.replace(/\s+/g, '_')}`,
            name: `${selectedBeadProduct.name} (${variantName})`,
            price: variantPrice,
            category: selectedBeadProduct.category,
            img: selectedBeadProduct.img
        };

        addToCart(customProductItem);
        if (customBeadModal) customBeadModal.classList.remove("active");
    });
}

if (btnCloseCustomModal) {
    btnCloseCustomModal.addEventListener("click", () => {
        if (customBeadModal) customBeadModal.classList.remove("active");
    });
}

// Cart Logic
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
        if (cart[index].qty <= 0) {
            cart.splice(index, 1);
        }
    }
    updateCartUI();
};

const updateCartUI = () => {
    cartItemsContainer.innerHTML = "";
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="cart-empty">
                <i class="fa-solid fa-basket-shopping"></i>
                <p>Belum ada item dipilih</p>
            </div>`;
        subtotalEl.textContent = "Rp 0";
        taxEl.textContent = "Rp 0";
        grandTotalEl.textContent = "Rp 0";
        btnCheckout.disabled = true;
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

    subtotalEl.textContent = formatRupiah(subtotal);
    taxEl.textContent = formatRupiah(tax);
    grandTotalEl.textContent = formatRupiah(grandTotal);
    btnCheckout.disabled = false;
    if (btnHoldOrder) btnHoldOrder.disabled = false;
};

// ==========================================================================
// FITUR ANTREAN / PESANAN PENDING (HOLD & RESUME)
// ==========================================================================
if (btnHoldOrder) {
    btnHoldOrder.addEventListener("click", () => {
        if (cart.length === 0) return;

        const now = new Date();
        const customer = customerNameInput.value.trim() || `Antrean #${pendingOrders.length + 1}`;
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const tax = subtotal * (appSettings.taxRate / 100);
        const grandTotal = subtotal + tax + appSettings.serviceFee;

        const pendingData = {
            id: "PEND-" + Date.now().toString().slice(-4),
            time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            customer: customer,
            type: currentOrderType,
            items: cart.map(item => ({ ...item })),
            total: grandTotal
        };

        pendingOrders.unshift(pendingData);
        localStorage.setItem("sweet_memories_pending", JSON.stringify(pendingOrders));

        cart = [];
        customerNameInput.value = "";
        updateCartUI();
        updatePendingUI();
    });
}

const updatePendingUI = () => {
    const badge = document.getElementById("pendingBadge");
    if (badge) {
        if (pendingOrders.length > 0) {
            badge.style.display = "inline-block";
            badge.textContent = pendingOrders.length;
        } else {
            badge.style.display = "none";
        }
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
        const itemsListHTML = order.items.map(i => `
            <li>
                <span>${i.qty}x ${i.name}</span>
                <span>${formatRupiah(i.price * i.qty)}</span>
            </li>
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
                <ul class="pending-items-list" style="margin-top: 10px;">
                    ${itemsListHTML}
                </ul>
            </div>
            <div class="pending-card-footer">
                <div class="pending-total-row">
                    <span>Total Sementara</span>
                    <span>${formatRupiah(order.total)}</span>
                </div>
                <div class="pending-btn-group">
                    <button type="button" class="btn-resume-pending" onclick="resumePendingOrder('${order.id}')">
                        <i class="fa-solid fa-cart-arrow-down"></i> Lanjutkan ke Kasir
                    </button>
                    <button type="button" class="btn-delete-trx" onclick="deletePendingOrder('${order.id}')" title="Batalkan Antrean">
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

    if (cart.length > 0) {
        const confirmReplace = confirm("Keranjang kasir saat ini masih berisi pesanan. Ganti dengan pesanan antrean ini?");
        if (!confirmReplace) return;
    }

    cart = target.items.map(item => ({ ...item }));
    customerNameInput.value = target.customer.startsWith("Antrean #") ? "" : target.customer;
    currentOrderType = target.type;

    document.querySelectorAll(".type-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.type === currentOrderType);
    });

    pendingOrders = pendingOrders.filter(p => p.id !== pendingId);
    localStorage.setItem("sweet_memories_pending", JSON.stringify(pendingOrders));

    updateCartUI();
    updatePendingUI();
    switchToPage("menu-page");
};

window.deletePendingOrder = (pendingId) => {
    if (confirm("Hapus pesanan pending ini dari antrean?")) {
        pendingOrders = pendingOrders.filter(p => p.id !== pendingId);
        localStorage.setItem("sweet_memories_pending", JSON.stringify(pendingOrders));
        updatePendingUI();
    }
};

// Switch Metode Pembayaran (Cash & QRIS)
document.querySelectorAll('input[name="payMethod"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('active'));
        e.target.closest('.pay-method').classList.add('active');
        
        btnConfirmPay.style.display = 'block';

        if (e.target.value === 'QRIS') {
            cashGroup.style.display = 'none';
            qrisGroup.style.display = 'block';
            if (qrisImage) qrisImage.src = appSettings.qrisPath;
        } else {
            cashGroup.style.display = 'flex';
            qrisGroup.style.display = 'none';
        }
    });
});

// Konfirmasi & Proses Transaksi
btnConfirmPay.addEventListener("click", () => {
    const customer = customerNameInput.value.trim() || "-";
    const payMethod = document.querySelector('input[name="payMethod"]:checked').value;
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const tax = subtotal * (appSettings.taxRate / 100);
    const grandTotal = subtotal + tax + appSettings.serviceFee;
    
    let paidAmount = grandTotal;
    let changeAmount = 0;

    if (payMethod === "Cash") {
        paidAmount = parseFloat(cashAmountInput.value) || 0;
        if (paidAmount < grandTotal) {
            alert("Jumlah uang tunai yang diterima kurang!");
            return;
        }
        changeAmount = paidAmount - grandTotal;
    }

    const now = new Date();
    const transactionData = {
        id: "SM-" + Date.now().toString().slice(-4),
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString('id-ID'),
        customer: customer,
        type: currentOrderType,
        method: payMethod,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: Number(item.price) || 0,
            qty: Number(item.qty) || 1,
            category: item.category || "umum"
        })),
        subtotal: subtotal,
        tax: tax,
        total: grandTotal,
        paid: paidAmount,
        change: changeAmount
    };

    transactions.unshift(transactionData);
    localStorage.setItem("sweet_memories_transactions", JSON.stringify(transactions));

    syncAllViews();

    cart = [];
    customerNameInput.value = "";
    updateCartUI();
    paymentModal.classList.remove("active");

    showReceiptModal(transactionData);

    if (appSettings.autoPrint) {
        setTimeout(() => { window.print(); }, 400);
    }
});

// Modal Preview Struk Kasir
const showReceiptModal = (trx) => {
    currentReceiptData = trx;
    document.getElementById("rcStoreName").textContent = appSettings.storeName.toUpperCase();
    document.getElementById("rcStoreTagline").textContent = appSettings.slogan;
    document.getElementById("rcStoreAddress").textContent = appSettings.address;
    document.getElementById("rcStorePhone").textContent = "Telp: " + appSettings.phone;
    
    document.getElementById("rcTrxId").textContent = trx.id;

    const currentPrintDate = new Date();
    const printDateStr = currentPrintDate.toLocaleDateString('id-ID');
    const printTimeStr = currentPrintDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    document.getElementById("rcDateTime").textContent = `${printDateStr} ${printTimeStr}`;

    document.getElementById("rcCustomer").textContent = trx.customer;
    document.getElementById("rcOrderType").textContent = trx.type;

    const itemsContainer = document.getElementById("rcItemsList");
    itemsContainer.innerHTML = "";
    if (Array.isArray(trx.items)) {
        trx.items.forEach(item => {
            const itemRow = document.createElement("div");
            itemRow.className = "rc-item";
            itemRow.innerHTML = `
                <div class="rc-item-title">${item.name}</div>
                <div class="rc-item-calc">
                    <span>${item.qty} x ${formatRupiah(item.price)}</span>
                    <span>${formatRupiah(item.price * item.qty)}</span>
                </div>
            `;
            itemsContainer.appendChild(itemRow);
        });
    }

    document.getElementById("rcSubtotal").textContent = formatRupiah(trx.subtotal || trx.total);
    document.getElementById("rcTaxPercent").textContent = appSettings.taxRate;
    document.getElementById("rcTax").textContent = formatRupiah(trx.tax || 0);
    document.getElementById("rcGrandTotal").textContent = formatRupiah(trx.total);
    document.getElementById("rcPayMethod").textContent = trx.method;
    document.getElementById("rcPaid").textContent = formatRupiah(trx.paid || trx.total);
    document.getElementById("rcChange").textContent = formatRupiah(trx.change || 0);

    document.getElementById("rcFooterHeader").textContent = appSettings.receiptHeader;
    document.getElementById("rcFooterMessage").innerHTML = appSettings.receiptFooter.replace(/\n/g, "<br>");

    receiptModal.classList.add("active");
};

btnPrintReceiptNow.addEventListener("click", () => {
    window.print();
});

btnCloseReceiptModal.addEventListener("click", () => {
    receiptModal.classList.remove("active");
});

// Update Tabel Riwayat & Fitur Hapus
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
                    <button class="btn-print-trx" onclick="viewReceiptFromHistory('${trx.id}')" title="Cetak Struk">
                        <i class="fa-solid fa-print"></i> Cetak
                    </button>
                    <button class="btn-delete-trx" onclick="deleteTransaction('${trx.id}')" title="Hapus Transaksi">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// Hapus Transaksi
window.deleteTransaction = (trxId) => {
    if (confirm(`Apakah Anda yakin ingin menghapus transaksi ${trxId}?`)) {
        transactions = transactions.filter(t => t.id !== trxId);
        localStorage.setItem("sweet_memories_transactions", JSON.stringify(transactions));
        syncAllViews();
    }
};

window.viewReceiptFromHistory = (trxId) => {
    const target = transactions.find(t => t.id === trxId);
    if (target) {
        showReceiptModal(target);
    }
};

// Update Laporan Penjualan
const updateReportSummary = () => {
    let totalRevenue = 0;
    const itemSales = {};

    transactions.forEach(trx => {
        const trxTotal = Number(trx.total) || 0;
        totalRevenue += trxTotal;

        if (Array.isArray(trx.items) && trx.items.length > 0) {
            trx.items.forEach(item => {
                const itemName = item.name || "Produk Tanpa Nama";
                const itemQty = Number(item.qty) || 1;
                const itemPrice = Number(item.price) || 0;
                const itemCat = item.category || "umum";

                if (!itemSales[itemName]) {
                    itemSales[itemName] = { category: itemCat, qty: 0, revenue: 0 };
                }
                itemSales[itemName].qty += itemQty;
                itemSales[itemName].revenue += (itemPrice * itemQty);
            });
        } else {
            const fallbackName = `Transaksi (${trx.id})`;
            if (!itemSales[fallbackName]) {
                itemSales[fallbackName] = { category: "-", qty: 1, revenue: 0 };
            }
            itemSales[fallbackName].revenue += trxTotal;
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
        if (data.qty > maxQty) {
            maxQty = data.qty;
            topProduct = name;
        }
    }
    if (topEl) topEl.textContent = topProduct;

    if (!reportTbody) return;
    reportTbody.innerHTML = "";

    if (Object.keys(itemSales).length === 0) {
        reportTbody.innerHTML = `<tr><td colspan="4" class="text-center">Belum ada data penjualan.</td></tr>`;
        return;
    }

    for (const [name, data] of Object.entries(itemSales)) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${name}</strong></td>
            <td>${data.category}</td>
            <td>${data.qty} pcs</td>
            <td>${formatRupiah(data.revenue)}</td>
        `;
        reportTbody.appendChild(tr);
    }
};

// Export Excel
document.getElementById("btnExportExcel").addEventListener("click", () => {
    if (transactions.length === 0) {
        alert("Belum ada data transaksi untuk di-export!");
        return;
    }

    let tableHTML = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:x="urn:schemas-microsoft-com:office:excel" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <style>
                table { border-collapse: collapse; font-family: Arial, sans-serif; width: 100%; }
                th { background-color: #4A2E2B; color: #FFFFFF; font-weight: bold; padding: 10px 14px; border: 1px solid #3E2421; text-align: left; }
                td { padding: 8px 14px; border: 1px solid #D9CFC7; text-align: left; mso-number-format:"\\@"; }
            </style>
        </head>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>ID Transaksi</th>
                        <th>Waktu</th>
                        <th>Pelanggan</th>
                        <th>Tipe</th>
                        <th>Metode</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
    `;

    transactions.forEach(trx => {
        tableHTML += `
            <tr>
                <td><strong>${trx.id}</strong></td>
                <td>${trx.time} (${trx.date})</td>
                <td>${trx.customer}</td>
                <td>${trx.type}</td>
                <td>${trx.method}</td>
                <td>${formatRupiah(trx.total)}</td>
            </tr>
        `;
    });

    tableHTML += `
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Laporan_Penjualan_SweetMemories_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});

// Settings Events
document.querySelectorAll(".setting-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".setting-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".setting-panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.tab).classList.add("active");
    });
});

if (document.getElementById("qrisImagePath")) {
    document.getElementById("qrisImagePath").addEventListener("input", (e) => {
        document.getElementById("cfgQrisPreview").src = e.target.value;
    });
}

document.getElementById("btnSaveSettings").addEventListener("click", () => {
    appSettings.storeName = document.getElementById("cfgStoreName").value;
    appSettings.slogan = document.getElementById("cfgSlogan").value;
    appSettings.address = document.getElementById("cfgAddress").value;
    appSettings.phone = document.getElementById("cfgPhone").value;
    appSettings.taxRate = parseFloat(document.getElementById("cfgTaxRate").value) || 0;
    appSettings.serviceFee = parseFloat(document.getElementById("cfgServiceFee").value) || 0;
    appSettings.qrisPath = document.getElementById("qrisImagePath").value;
    appSettings.receiptHeader = document.getElementById("cfgReceiptHeader").value;
    appSettings.receiptFooter = document.getElementById("cfgReceiptFooter").value;
    appSettings.autoPrint = document.getElementById("cfgAutoPrint").checked;

    localStorage.setItem("sweet_memories_settings", JSON.stringify(appSettings));
    loadSettings();
    updateCartUI();
    alert("Pengaturan sistem berhasil disimpan!");
});

document.getElementById("btnClearHistory").addEventListener("click", () => {
    if (confirm("Apakah Anda yakin ingin menghapus seluruh riwayat transaksi? Data tidak dapat dikembalikan.")) {
        transactions = [];
        localStorage.removeItem("sweet_memories_transactions");
        syncAllViews();
        alert("Riwayat transaksi telah dibersihkan.");
    }
});

document.getElementById("btnBackupData").addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ settings: appSettings, transactions: transactions, pendingOrders: pendingOrders }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Backup_Kasir_SweetMemories_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
});

// Category & Search Filters
categoryContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeCategory = btn.dataset.category;
    renderMenu();
});

searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderMenu();
});

btnClearCart.addEventListener("click", () => {
    cart = [];
    updateCartUI();
});

btnCheckout.addEventListener("click", () => {
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const tax = subtotal * (appSettings.taxRate / 100);
    const grandTotal = subtotal + tax + appSettings.serviceFee;
    modalTotal.textContent = formatRupiah(grandTotal);
    cashAmountInput.value = "";
    changeAmountEl.textContent = "Rp 0";
    
    const cashRadio = document.querySelector('input[name="payMethod"][value="Cash"]');
    if (cashRadio) {
        cashRadio.checked = true;
        cashRadio.dispatchEvent(new Event('change'));
    }

    paymentModal.classList.add("active");
});

btnCloseModal.addEventListener("click", () => {
    paymentModal.classList.remove("active");
});

cashAmountInput.addEventListener("input", () => {
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const tax = subtotal * (appSettings.taxRate / 100);
    const grandTotal = subtotal + tax + appSettings.serviceFee;
    const cash = parseFloat(cashAmountInput.value) || 0;
    const change = cash - grandTotal;
    changeAmountEl.textContent = change >= 0 ? formatRupiah(change) : "Uang Kurang";
});

document.querySelectorAll(".btn-quick").forEach(btn => {
    btn.addEventListener("click", () => {
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const tax = subtotal * (appSettings.taxRate / 100);
        const grandTotal = subtotal + tax + appSettings.serviceFee;
        cashAmountInput.value = btn.dataset.val === "exact" ? grandTotal : btn.dataset.val;
        cashAmountInput.dispatchEvent(new Event("input"));
    });
});

document.querySelectorAll(".type-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        currentOrderType = e.target.dataset.type;
    });
});

// Inisialisasi Aplikasi Kasir
loadSettings();
startRealtimeClock();
renderMenu();