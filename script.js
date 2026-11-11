// State Management
let cart = [];
let transactions = [];
let activeCategory = "all";
let searchQuery = "";
let currentOrderType = "Mahasiswa";
let currentReceiptData = null;
let selectedBeadProduct = null;
let isAdminLoggedIn = false; // State Login Admin

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
    autoPrint: true,
    adminPin: "1234"
};

// Data Menu Sampel + Manajemen Stok Inventaris
let menuItems = [
    { id: 1, name: "Donat Jadoel", price: 3500, category: "makanan", img: "pict/img/Donat.png", stock: 25 },
    { id: 2, name: "Bomboloni", price: 4000, category: "makanan", img: "pict/img/bomboloni.png", stock: 20 },
    { id: 3, name: "Soda Gembira", price: 12000, category: "minuman", img: "pict/img/sodagembira.jpg", stock: 15 },
    { id: 4, name: "Mango Sticky Rice", price: 15000, category: "makanan", img: "pict/img/mangostr.jpg", stock: 10 },
    { id: 5, name: "Kue Sus", price: 3500, category: "makanan", img: "pict/img/kuesus.png", stock: 30 },
    { 
        id: 6, 
        name: "Manik - Manik", 
        price: 5000, 
        category: "aksesoris", 
        img: "pict/img/manikmanik.png",
        stock: 50,
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

// Login Elements
const loginModal = document.getElementById("loginModal");
const btnCloseLoginModal = document.getElementById("btnCloseLoginModal");
const cashierProfileBtn = document.getElementById("cashierProfileBtn");
const cashierNameLabel = document.getElementById("cashierNameLabel");
const cashierStatusLabel = document.getElementById("cashierStatusLabel");
const btnLoginSubmit = document.getElementById("btnLoginSubmit");
const adminPinInput = document.getElementById("adminPinInput");

// Format Rupiah
const formatRupiah = (number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(number);

// Load Settings & LocalStorage History
const loadSettings = () => {
    const savedConfig = localStorage.getItem("sweet_memories_settings");
    if (savedConfig) appSettings = { ...appSettings, ...JSON.parse(savedConfig) };

    const savedHistory = localStorage.getItem("sweet_memories_transactions");
    if (savedHistory) transactions = JSON.parse(savedHistory);

    const savedStock = localStorage.getItem("sweet_memories_stocks");
    if (savedStock) {
        const stocksMap = JSON.parse(savedStock);
        menuItems.forEach(item => {
            if (stocksMap[item.id] !== undefined) item.stock = stocksMap[item.id];
        });
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

    updateHistoryTable();
    updateReportSummary();
    renderStockManagementTable();
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

// Fitur Auth Admin / Kasir Login Modal
if (cashierProfileBtn) {
    cashierProfileBtn.addEventListener("click", () => {
        if (isAdminLoggedIn) {
            if (confirm("Apakah Anda ingin Logout dari Mode Admin Kasir?")) {
                isAdminLoggedIn = false;
                cashierNameLabel.textContent = "Kasir 1";
                cashierStatusLabel.innerHTML = `<i class="fa-solid fa-circle"></i> Mode Kasir`;
                cashierStatusLabel.style.color = "var(--success-color)";
                alert("Anda kembali ke Mode Kasir standar.");
            }
        } else {
            adminPinInput.value = "";
            loginModal.classList.add("active");
        }
    });
}

if (btnCloseLoginModal) {
    btnCloseLoginModal.addEventListener("click", () => loginModal.classList.remove("active"));
}

if (btnLoginSubmit) {
    btnLoginSubmit.addEventListener("click", () => {
        const inputPin = adminPinInput.value.trim();
        if (inputPin === appSettings.adminPin) {
            isAdminLoggedIn = true;
            cashierNameLabel.textContent = "Administrator";
            cashierStatusLabel.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Admin Mode`;
            cashierStatusLabel.style.color = "#217346";
            loginModal.classList.remove("active");
            alert("Login Admin Berhasil! Anda sekarang dapat mengelola stok & preferensi.");
        } else {
            alert("PIN Admin Salah! (Default PIN: 1234)");
        }
    });
}

// Navigation Switcher dengan Proteksi Akses Settings
document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetPage = link.dataset.page;

        if (targetPage === "settings-page" && !isAdminLoggedIn) {
            alert("Halaman Pengaturan & Stok terkunci! Silakan login via Profil Kasir di pojok kanan atas.");
            loginModal.classList.add("active");
            return;
        }

        document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
        document.querySelectorAll(".page-content").forEach(p => p.classList.remove("active"));
        link.classList.add("active");
        document.getElementById(targetPage).classList.add("active");

        if (window.innerWidth <= 768) sidebar.classList.remove("mobile-open");
    });
});

// Render Menu Cards & Badge Stok
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
        const isOutOfStock = item.stock <= 0;
        card.className = `menu-card ${isOutOfStock ? 'out-of-stock' : ''}`;
        
        card.innerHTML = `
            <span class="stock-badge ${isOutOfStock ? 'empty' : ''}">${isOutOfStock ? 'Habis' : 'Stok: ' + item.stock}</span>
            <img src="${item.img}" alt="${item.name}" class="menu-img" loading="lazy" onerror="this.onerror=null; this.src='pict/logo/LOGO.png';">
            <div class="menu-info">
                <h4>${item.name} ${item.isCustom ? '<small style="color:var(--accent-light);">(Custom)</small>' : ''}</h4>
                <div class="menu-price">${item.isCustom ? 'Mulai ' + formatRupiah(5000) : formatRupiah(item.price)}</div>
            </div>
        `;
        
        if (!isOutOfStock) {
            card.addEventListener("click", () => handleProductClick(item));
        }
        menuGrid.appendChild(card);
    });
};

// Logika Klik Produk (Produk Biasa vs Custom Manik-Manik)
const handleProductClick = (product) => {
    if (product.stock <= 0) {
        alert("Stok produk ini sedang habis!");
        return;
    }
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
            id: `bead_${Date.now()}`,
            originalId: selectedBeadProduct.id,
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
    const masterProduct = menuItems.find(m => m.id === (product.originalId || product.id));
    const currentInCart = cart.filter(i => (i.originalId || i.id) === (product.originalId || product.id))
                              .reduce((sum, item) => sum + item.qty, 0);
    
    if (masterProduct && (currentInCart + 1) > masterProduct.stock) {
        alert(`Jumlah melebihi stok yang tersedia (${masterProduct.stock} pcs)!`);
        return;
    }

    const existingIndex = cart.findIndex(item => item.id === product.id || item.name === product.name);
    if (existingIndex > -1) {
        cart[existingIndex].qty += 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    updateCartUI();
};

const updateQty = (id, delta) => {
    const index = cart.findIndex(item => item.id === id);
    if (index > -1) {
        if (delta > 0) {
            const item = cart[index];
            const masterProduct = menuItems.find(m => m.id === (item.originalId || item.id));
            if (masterProduct && (item.qty + 1) > masterProduct.stock) {
                alert(`Stok tidak mencukupi! Sisa: ${masterProduct.stock} pcs`);
                return;
            }
        }
        cart[index].qty += delta;
        if (cart[index].qty <= 0) cart.splice(index, 1);
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
                <button class="btn-qty" onclick="updateQty('${item.id}', -1)">-</button>
                <span>${item.qty}</span>
                <button class="btn-qty" onclick="updateQty('${item.id}', 1)">+</button>
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

// Konfirmasi & Proses Transaksi + Otomatis Potong Stok
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

    // Deduct Stok Inventaris
    cart.forEach(cartItem => {
        const targetId = cartItem.originalId || cartItem.id;
        const targetProduct = menuItems.find(m => m.id === targetId);
        if (targetProduct) {
            targetProduct.stock = Math.max(0, targetProduct.stock - cartItem.qty);
        }
    });

    // Simpan Map Stok ke LocalStorage
    const stocksMap = {};
    menuItems.forEach(m => stocksMap[m.id] = m.stock);
    localStorage.setItem("sweet_memories_stocks", JSON.stringify(stocksMap));

    const now = new Date();
    const transactionData = {
        id: "SM-" + Date.now().toString().slice(-4),
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString('id-ID'),
        customer: customer,
        type: currentOrderType,
        method: payMethod,
        items: [...cart],
        subtotal: subtotal,
        tax: tax,
        total: grandTotal,
        paid: paidAmount,
        change: changeAmount
    };

    transactions.unshift(transactionData);
    localStorage.setItem("sweet_memories_transactions", JSON.stringify(transactions));

    updateHistoryTable();
    updateReportSummary();
    renderStockManagementTable();
    renderMenu();

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
    if (!isAdminLoggedIn) {
        alert("Hanya Admin yang dapat menghapus riwayat transaksi!");
        loginModal.classList.add("active");
        return;
    }
    if (confirm(`Apakah Anda yakin ingin menghapus transaksi ${trxId}?`)) {
        transactions = transactions.filter(t => t.id !== trxId);
        localStorage.setItem("sweet_memories_transactions", JSON.stringify(transactions));
        updateHistoryTable();
        updateReportSummary();
    }
};

window.viewReceiptFromHistory = (trxId) => {
    const target = transactions.find(t => t.id === trxId);
    if (target) {
        showReceiptModal(target);
    }
};

// Tabel Kelola Stok di Pengaturan
const renderStockManagementTable = () => {
    const stockTbody = document.getElementById("stockTableBody");
    if (!stockTbody) return;
    stockTbody.innerHTML = "";

    menuItems.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.category}</td>
            <td><span class="stock-badge ${item.stock <= 0 ? 'empty' : ''}">${item.stock} pcs</span></td>
            <td>
                <input type="number" value="${item.stock}" min="0" class="input-meta" style="width: 100px; display: inline-block;" onchange="updateItemStock(${item.id}, this.value)">
            </td>
        `;
        stockTbody.appendChild(tr);
    });
};

window.updateItemStock = (id, newStock) => {
    const item = menuItems.find(m => m.id === id);
    if (item) {
        item.stock = parseInt(newStock) || 0;
        const stocksMap = {};
        menuItems.forEach(m => stocksMap[m.id] = m.stock);
        localStorage.setItem("sweet_memories_stocks", JSON.stringify(stocksMap));
        renderMenu();
    }
};

// Update Laporan Penjualan
const updateReportSummary = () => {
    let totalRevenue = 0;
    const itemSales = {};

    transactions.forEach(trx => {
        totalRevenue += trx.total;
        trx.items.forEach(item => {
            if (!itemSales[item.name]) {
                itemSales[item.name] = { category: item.category, qty: 0, revenue: 0 };
            }
            itemSales[item.name].qty += item.qty;
            itemSales[item.name].revenue += (item.price * item.qty);
        });
    });

    document.getElementById("statTotalRevenue").textContent = formatRupiah(totalRevenue);
    document.getElementById("statTotalOrders").textContent = transactions.length;

    let topProduct = "-";
    let maxQty = 0;
    for (const [name, data] of Object.entries(itemSales)) {
        if (data.qty > maxQty) {
            maxQty = data.qty;
            topProduct = name;
        }
    }
    document.getElementById("statTopProduct").textContent = topProduct;

    const reportTbody = document.getElementById("reportTableBody");
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

// Export CSV / Excel
document.getElementById("btnExportExcel").addEventListener("click", () => {
    if (transactions.length === 0) {
        alert("Belum ada data transaksi untuk di-export!");
        return;
    }

    let csvContent = "\uFEFFID Transaksi,Tanggal,Waktu,Pelanggan,Tipe,Metode,Total Bayar\n";
    transactions.forEach(trx => {
        const safeDate = `'${trx.date}`;
        const safeTime = `'${trx.time}`;
        csvContent += `${trx.id},${safeDate},${safeTime},"${trx.customer}",${trx.type},${trx.method},${trx.total}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Penjualan_SweetMemories_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    if (!isAdminLoggedIn) {
        alert("Hanya Admin yang dapat menyimpan perubahan sistem!");
        loginModal.classList.add("active");
        return;
    }
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
    alert("Pengaturan sistem & stok berhasil disimpan!");
});

document.getElementById("btnClearHistory").addEventListener("click", () => {
    if (!isAdminLoggedIn) {
        alert("Hanya Admin yang dapat menghapus riwayat!");
        loginModal.classList.add("active");
        return;
    }
    if (confirm("Apakah Anda yakin ingin menghapus seluruh riwayat transaksi? Data tidak dapat dikembalikan.")) {
        transactions = [];
        localStorage.removeItem("sweet_memories_transactions");
        updateHistoryTable();
        updateReportSummary();
        alert("Riwayat transaksi telah dibersihkan.");
    }
});

document.getElementById("btnBackupData").addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ settings: appSettings, transactions: transactions, stocks: menuItems.map(m=>({id:m.id, stock:m.stock})) }, null, 2));
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