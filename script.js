/**
 * ====================================================================
 * KHETKONNECT - BUYER MARKETPLACE CONTROLLER (buyer/script.js)
 * Connected to Shared Supabase Database & Backend
 * ====================================================================
 */

document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    /* ====================================================================
       1. SUPABASE CLIENT & DATA PERSISTENCE
       ==================================================================== */
    const SUPABASE_CONFIG = {
        url: (window.env && window.env.VITE_SUPABASE_URL) || "https://placeholder-project.supabase.co",
        anonKey: (window.env && window.env.VITE_SUPABASE_ANON_KEY) || "placeholder-anon-key"
    };

    let supabaseClient = null;
    let isSupabaseConfigured = false;

    if (window.supabase && SUPABASE_CONFIG.url && !SUPABASE_CONFIG.url.includes("placeholder-project")) {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            isSupabaseConfigured = true;
            console.log("🛒 Buyer Marketplace: Connected to Shared Supabase Backend");
        } catch (e) {
            console.warn("🛒 Buyer Marketplace: Supabase fallback", e);
        }
    }

    const LocalDB = {
        get(key, defaultValue) {
            try {
                const data = localStorage.getItem(`khetkonnect_${key}`);
                return data ? JSON.parse(data) : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(`khetkonnect_${key}`, JSON.stringify(value));
            } catch (e) {
                console.error("LocalDB save error:", e);
            }
        }
    };

    const DEFAULT_MARKET_PRODUCTS = [
        {
            id: "prod-1",
            farmer_name: "Ramesh Patil",
            name: "Fresh Vine Tomatoes",
            category: "vegetables",
            price: 40,
            quantity: 500,
            unit: "kg",
            location: "Nashik, Maharashtra",
            image_emoji: "🍅",
            is_verified: true,
            status: "available",
            description: "Naturally vine-ripened, 100% organic direct from Nashik farm cluster."
        },
        {
            id: "prod-2",
            farmer_name: "Kisan Vikas FPO",
            name: "Fresh Agra Potatoes",
            category: "vegetables",
            price: 28,
            quantity: 1200,
            unit: "kg",
            location: "Agra, Uttar Pradesh",
            image_emoji: "🥔",
            is_verified: true,
            status: "available",
            description: "High quality sorted table potatoes direct from FPO cold storage."
        },
        {
            id: "prod-3",
            farmer_name: "Himachal Orchard Cooperative",
            name: "Crisp Shimla Apples",
            category: "fruits",
            price: 110,
            quantity: 350,
            unit: "kg",
            location: "Shimla, Himachal Pradesh",
            image_emoji: "🍎",
            is_verified: true,
            status: "available",
            description: "Crisp Royal Delicious mountain apples picked fresh from high altitude orchards."
        },
        {
            id: "prod-4",
            farmer_name: "Mahanadi Farmers Collective",
            name: "Premium Basmati Rice",
            category: "grains",
            price: 58,
            quantity: 2000,
            unit: "kg",
            location: "Sambalpur, Odisha",
            image_emoji: "🌾",
            is_verified: true,
            status: "available",
            description: "Aromatic aged long grain rice harvested by certified farmer group."
        },
        {
            id: "prod-5",
            farmer_name: "Lasalgaon Mandi Farmer",
            name: "Red Nasik Onions",
            category: "vegetables",
            price: 34,
            quantity: 850,
            unit: "kg",
            location: "Lasalgaon, Maharashtra",
            image_emoji: "🧅",
            is_verified: true,
            status: "available",
            description: "Export-quality pungent red onions with long shelf life."
        },
        {
            id: "prod-6",
            farmer_name: "Ratnagiri Mango Growers",
            name: "Sweet Alphonso Mangoes",
            category: "fruits",
            price: 180,
            quantity: 220,
            unit: "kg",
            location: "Ratnagiri, Maharashtra",
            image_emoji: "🥭",
            is_verified: true,
            status: "available",
            description: "Naturally tree-ripened, 100% carbide-free authentic Alphonso mangoes."
        },
        {
            id: "prod-7",
            farmer_name: "Punjab Agro Green",
            name: "Organic Sharbati Wheat",
            category: "grains",
            price: 45,
            quantity: 1500,
            unit: "kg",
            location: "Ludhiana, Punjab",
            image_emoji: "🌾",
            is_verified: true,
            status: "available",
            description: "Sharbati golden wheat grains grown without chemical pesticides."
        },
        {
            id: "prod-8",
            farmer_name: "Mahabaleshwar Berry Farm",
            name: "Fresh Sweet Strawberries",
            category: "fruits",
            price: 160,
            quantity: 180,
            unit: "kg",
            location: "Mahabaleshwar, Maharashtra",
            image_emoji: "🍓",
            is_verified: true,
            status: "available",
            description: "Juicy, hand-picked sweet winter strawberries direct from farm."
        }
    ];

    // Current State
    let buyerUser = LocalDB.get("currentUser") || {
        id: "buyer-ananya-01",
        full_name: "Ananya Sharma",
        email: "ananya@khetkonnect.in",
        phone: "+91 9876543210",
        role: "buyer",
        city: "Mumbai, Maharashtra"
    };

    let allProducts = [];
    let cartItems = LocalDB.get("buyerCart", []);
    let favoritesList = LocalDB.get("buyerFavorites", []);

    /* ====================================================================
       2. LOAD PRODUCE FROM SHARED DATABASE
       ==================================================================== */
    const buyerProductsGrid = document.getElementById("buyerProductsGrid");
    const marketplaceSearchInput = document.getElementById("marketplaceSearchInput");
    const categoryChips = document.querySelectorAll(".chip");
    const sortSelect = document.getElementById("sortSelect");

    let currentCategory = "all";
    let currentSearchTerm = "";

    async function fetchMarketProducts() {
        if (isSupabaseConfigured && supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from("products")
                    .select("*")
                    .order("created_at", { ascending: false });

                if (!error && data && data.length > 0) {
                    allProducts = data;
                } else {
                    allProducts = LocalDB.get("products", DEFAULT_MARKET_PRODUCTS);
                }
            } catch (err) {
                console.warn("Supabase fetch error, using local data:", err);
                allProducts = LocalDB.get("products", DEFAULT_MARKET_PRODUCTS);
            }
        } else {
            allProducts = LocalDB.get("products", DEFAULT_MARKET_PRODUCTS);
        }

        updateCategoryCounts();
        renderProduceGrid();
    }

    function updateCategoryCounts() {
        const counts = { all: allProducts.length, vegetables: 0, fruits: 0, grains: 0, pulses: 0, spices: 0 };
        allProducts.forEach(p => {
            const cat = (p.category || "").toLowerCase();
            if (counts[cat] !== undefined) counts[cat]++;
        });

        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setTxt("cntAll", counts.all);
        setTxt("cntVeg", counts.vegetables);
        setTxt("cntFruit", counts.fruits);
        setTxt("cntGrain", counts.grains);
        setTxt("cntPulse", counts.pulses);
        setTxt("cntSpice", counts.spices);
    }

    function renderProduceGrid() {
        if (!buyerProductsGrid) return;

        let filtered = allProducts.filter(p => {
            const matchesCat = currentCategory === "all" || (p.category || "").toLowerCase() === currentCategory;
            const matchesSearch = !currentSearchTerm || 
                (p.name || "").toLowerCase().includes(currentSearchTerm) ||
                (p.location || "").toLowerCase().includes(currentSearchTerm) ||
                (p.farmer_name || "").toLowerCase().includes(currentSearchTerm);
            return matchesCat && matchesSearch;
        });

        // Sorting
        const sortVal = sortSelect ? sortSelect.value : "featured";
        if (sortVal === "price_low") filtered.sort((a, b) => (a.price || a.price_per_kg) - (b.price || b.price_per_kg));
        if (sortVal === "price_high") filtered.sort((a, b) => (b.price || b.price_per_kg) - (a.price || a.price_per_kg));
        if (sortVal === "stock") filtered.sort((a, b) => (b.quantity || b.stock_qty || 0) - (a.quantity || a.stock_qty || 0));

        if (filtered.length === 0) {
            buyerProductsGrid.innerHTML = `
                <div class="empty-state" style="grid-column: span 4; text-align: center; padding: 48px;">
                    <h3>🌾 No matching farm produce found</h3>
                    <p class="text-muted">Try adjusting your search terms or selecting a different category filter.</p>
                </div>
            `;
            return;
        }

        buyerProductsGrid.innerHTML = filtered.map(prod => {
            const price = prod.price !== undefined ? prod.price : (prod.price_per_kg || 0);
            const stock = prod.quantity !== undefined ? prod.quantity : (prod.stock_qty || 0);
            const isSoldOut = stock <= 0 || prod.status === "sold_out";
            const isFav = favoritesList.includes(prod.id);
            const emoji = prod.image_emoji || "🌾";

            return `
                <div class="produce-card" data-id="${prod.id}">
                    <button class="fav-heart-btn ${isFav ? 'favorited' : ''}" data-id="${prod.id}" title="Save to Favorites">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    <div class="produce-emoji-wrap">${emoji}</div>
                    <div class="farmer-tag">👨‍🌾 ${prod.farmer_name || 'Verified Farmer'} ✓</div>
                    <h3 class="produce-name">${prod.name}</h3>
                    <p class="produce-loc">📍 ${prod.location || 'Direct Farm Gate'}</p>
                    <div class="produce-price-row">
                        <span class="produce-price">₹${price}</span>
                        <span class="produce-unit">/ ${prod.unit || 'kg'}</span>
                    </div>
                    <div class="stock-tag">
                        ${isSoldOut ? '<span class="sold-out">❌ Sold Out</span>' : `<span class="in-stock">● ${stock} ${prod.unit || 'kg'} in stock</span>`}
                    </div>
                    <button class="add-cart-btn" data-id="${prod.id}" ${isSoldOut ? 'disabled' : ''}>
                        ${isSoldOut ? 'Out of Stock' : '🛒 Add to Cart'}
                    </button>
                </div>
            `;
        }).join("");

        // Attach buttons
        document.querySelectorAll(".fav-heart-btn").forEach(btn => {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                toggleFavorite(this.getAttribute("data-id"));
            });
        });

        document.querySelectorAll(".add-cart-btn").forEach(btn => {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                addToCart(this.getAttribute("data-id"));
            });
        });
    }

    if (marketplaceSearchInput) {
        marketplaceSearchInput.addEventListener("input", function () {
            currentSearchTerm = this.value.trim().toLowerCase();
            renderProduceGrid();
        });
    }

    categoryChips.forEach(chip => {
        chip.addEventListener("click", function () {
            categoryChips.forEach(c => c.classList.remove("active"));
            this.classList.add("active");
            currentCategory = this.getAttribute("data-category");
            renderProduceGrid();
        });
    });

    if (sortSelect) sortSelect.addEventListener("change", renderProduceGrid);

    /* ====================================================================
       3. FAVORITES / WISHLIST
       ==================================================================== */
    const favBadge = document.getElementById("favBadge");
    const navFavoritesBtn = document.getElementById("navFavoritesBtn");
    const favoritesModal = document.getElementById("favoritesModal");
    const closeFavBtn = document.getElementById("closeFavBtn");
    const favoritesContainer = document.getElementById("favoritesContainer");

    function updateFavUI() {
        if (favBadge) favBadge.textContent = favoritesList.length;
        LocalDB.set("buyerFavorites", favoritesList);
    }

    async function toggleFavorite(productId) {
        const index = favoritesList.indexOf(productId);
        if (index > -1) {
            favoritesList.splice(index, 1);
            showToast("Removed from wishlist.");
            if (isSupabaseConfigured && supabaseClient && buyerUser) {
                try {
                    await supabaseClient.from("favorites").delete().match({ buyer_id: buyerUser.id, product_id: productId });
                } catch (e) {}
            }
        } else {
            favoritesList.push(productId);
            showToast("❤️ Saved to your favorites!");
            if (isSupabaseConfigured && supabaseClient && buyerUser) {
                try {
                    await supabaseClient.from("favorites").insert([{ buyer_id: buyerUser.id, product_id: productId }]);
                } catch (e) {}
            }
        }
        updateFavUI();
        renderProduceGrid();
    }

    if (navFavoritesBtn) {
        navFavoritesBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (favoritesModal) favoritesModal.style.display = "flex";
            renderFavoritesList();
        });
    }

    function renderFavoritesList() {
        if (!favoritesContainer) return;
        const favProducts = allProducts.filter(p => favoritesList.includes(p.id));
        if (favProducts.length === 0) {
            favoritesContainer.innerHTML = `<p class="text-muted" style="text-align:center; padding: 20px;">No saved favorites yet.</p>`;
            return;
        }
        favoritesContainer.innerHTML = favProducts.map(p => `
            <div class="cart-item-row">
                <div class="cart-item-info">
                    <span class="cart-item-emoji">${p.image_emoji || '🌾'}</span>
                    <div>
                        <strong>${p.name}</strong>
                        <div class="text-xs text-muted">₹${p.price || p.price_per_kg} / ${p.unit || 'kg'} • ${p.farmer_name}</div>
                    </div>
                </div>
                <button class="btn-primary btn-sm" onclick="window.buyerAddToCart('${p.id}')">Add to Cart</button>
            </div>
        `).join("");
    }

    if (closeFavBtn) closeFavBtn.addEventListener("click", () => { if (favoritesModal) favoritesModal.style.display = "none"; });

    /* ====================================================================
       4. CART & CHECKOUT (Synchronized with Supabase)
       ==================================================================== */
    const buyerCartBtn = document.getElementById("buyerCartBtn");
    const cartModal = document.getElementById("cartModal");
    const closeCartBtn = document.getElementById("closeCartBtn");
    const cartCountBadge = document.getElementById("cartCountBadge");
    const cartItemsContainer = document.getElementById("cartItemsContainer");
    const cartSubtotal = document.getElementById("cartSubtotal");
    const cartGrandTotal = document.getElementById("cartGrandTotal");
    const checkoutForm = document.getElementById("checkoutForm");

    function updateCartUI() {
        const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCountBadge) cartCountBadge.textContent = totalCount;
        LocalDB.set("buyerCart", cartItems);
    }

    function addToCart(productId) {
        const prod = allProducts.find(p => p.id === productId);
        if (!prod) return;

        const existing = cartItems.find(item => item.product_id === productId);
        if (existing) {
            existing.quantity += 1;
        } else {
            cartItems.push({
                product_id: prod.id,
                name: prod.name,
                price: prod.price !== undefined ? prod.price : (prod.price_per_kg || 0),
                unit: prod.unit || "kg",
                image_emoji: prod.image_emoji || "🌾",
                farmer_id: prod.farmer_id || null,
                farmer_name: prod.farmer_name || "Verified Farmer",
                quantity: 1
            });
        }

        updateCartUI();
        showToast(`🛒 Added ${prod.name} to your cart!`);
    }

    window.buyerAddToCart = addToCart;

    if (buyerCartBtn) {
        buyerCartBtn.addEventListener("click", function () {
            if (cartModal) cartModal.style.display = "flex";
            renderCartModal();
        });
    }

    if (closeCartBtn) closeCartBtn.addEventListener("click", () => { if (cartModal) cartModal.style.display = "none"; });

    function renderCartModal() {
        if (!cartItemsContainer) return;

        if (cartItems.length === 0) {
            cartItemsContainer.innerHTML = `<p class="text-muted" style="text-align: center; padding: 24px;">Your harvest cart is empty. Add fresh produce from the marketplace!</p>`;
            if (cartSubtotal) cartSubtotal.textContent = "₹0";
            if (cartGrandTotal) cartGrandTotal.textContent = "₹0";
            return;
        }

        let subtotal = 0;
        cartItemsContainer.innerHTML = cartItems.map((item, idx) => {
            const lineTotal = item.price * item.quantity;
            subtotal += lineTotal;

            return `
                <div class="cart-item-row">
                    <div class="cart-item-info">
                        <span class="cart-item-emoji">${item.image_emoji}</span>
                        <div>
                            <strong>${item.name}</strong>
                            <div class="text-xs text-muted">₹${item.price} / ${item.unit}</div>
                        </div>
                    </div>
                    <div class="cart-qty-ctrl">
                        <button class="qty-btn" data-idx="${idx}" data-action="dec">-</button>
                        <span style="font-weight: 700; width: 24px; text-align: center;">${item.quantity}</span>
                        <button class="qty-btn" data-idx="${idx}" data-action="inc">+</button>
                    </div>
                    <strong>₹${lineTotal}</strong>
                </div>
            `;
        }).join("");

        const deliveryFee = 40;
        const grandTotal = subtotal + deliveryFee;

        if (cartSubtotal) cartSubtotal.textContent = `₹${subtotal}`;
        if (cartGrandTotal) cartGrandTotal.textContent = `₹${grandTotal}`;

        // Quantity handlers
        document.querySelectorAll(".qty-btn").forEach(btn => {
            btn.addEventListener("click", function () {
                const idx = parseInt(this.getAttribute("data-idx"));
                const action = this.getAttribute("data-action");
                if (action === "inc") {
                    cartItems[idx].quantity += 1;
                } else if (action === "dec") {
                    cartItems[idx].quantity -= 1;
                    if (cartItems[idx].quantity <= 0) cartItems.splice(idx, 1);
                }
                updateCartUI();
                renderCartModal();
            });
        });
    }

    // CHECKOUT & PLACE ORDER TRANSACTION
    if (checkoutForm) {
        checkoutForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            if (cartItems.length === 0) {
                showToast("Cart is empty!");
                return;
            }

            const buyerName = document.getElementById("buyerFullName").value.trim();
            const buyerPhone = document.getElementById("buyerPhone").value.trim();
            const buyerAddress = document.getElementById("buyerAddress").value.trim();

            const subtotal = cartItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
            const grandTotal = subtotal + 40;
            const orderId = "ORD-" + Math.floor(1000 + Math.random() * 9000);

            const newOrder = {
                id: orderId,
                buyer_id: buyerUser ? buyerUser.id : null,
                buyer_name: buyerName,
                buyer_phone: buyerPhone,
                delivery_location: buyerAddress,
                delivery_address: buyerAddress,
                total_amount: grandTotal,
                status: "pending",
                items: [...cartItems],
                created_at: new Date().toISOString()
            };

            showToast("Processing order through Supabase backend...");

            // 1. Send Order to Supabase
            if (isSupabaseConfigured && supabaseClient) {
                try {
                    // Call database place_order or direct table insert
                    const { data, error } = await supabaseClient.from("orders").insert([newOrder]).select();
                    if (error) throw error;

                    // Insert Order Items
                    const orderItemsPayload = cartItems.map(it => ({
                        order_id: newOrder.id,
                        product_id: it.product_id,
                        farmer_id: it.farmer_id,
                        quantity: it.quantity,
                        price_at_purchase: it.price,
                        subtotal: it.price * it.quantity
                    }));
                    await supabaseClient.from("order_items").insert(orderItemsPayload);

                    showToast(`✅ Order #${orderId} confirmed via Supabase!`);
                } catch (err) {
                    console.warn("Supabase place_order fallback, saving locally:", err);
                    saveOrderLocally(newOrder);
                    showToast(`✅ Order #${orderId} placed successfully!`);
                }
            } else {
                saveOrderLocally(newOrder);
                showToast(`✅ Order #${orderId} placed successfully!`);
            }

            // 2. Decrement inventory on shared products
            allProducts = allProducts.map(prod => {
                const purchased = cartItems.find(it => it.product_id === prod.id);
                if (purchased) {
                    const currentStock = prod.quantity !== undefined ? prod.quantity : (prod.stock_qty || 0);
                    const newStock = Math.max(0, currentStock - purchased.quantity);
                    prod.quantity = newStock;
                    prod.stock_qty = newStock;
                    if (newStock === 0) prod.status = "sold_out";
                }
                return prod;
            });
            LocalDB.set("products", allProducts);

            // 3. Clear Cart
            cartItems = [];
            updateCartUI();

            if (cartModal) cartModal.style.display = "none";
            fetchMarketProducts();
            updateOrdersBadge();

            // Open My Orders
            setTimeout(() => {
                if (ordersModal) ordersModal.style.display = "flex";
                renderOrdersList();
            }, 600);
        });
    }

    function saveOrderLocally(order) {
        const orders = LocalDB.get("orders", []);
        orders.unshift(order);
        LocalDB.set("orders", orders);
    }

    /* ====================================================================
       5. MY ORDERS & TRACKING
       ==================================================================== */
    const navOrdersBtn = document.getElementById("navOrdersBtn");
    const ordersBadge = document.getElementById("ordersBadge");
    const ordersModal = document.getElementById("ordersModal");
    const closeOrdersBtn = document.getElementById("closeOrdersBtn");
    const buyerOrdersList = document.getElementById("buyerOrdersList");

    function updateOrdersBadge() {
        const orders = LocalDB.get("orders", []);
        if (ordersBadge) ordersBadge.textContent = orders.length;
    }

    if (navOrdersBtn) {
        navOrdersBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (ordersModal) ordersModal.style.display = "flex";
            renderOrdersList();
        });
    }

    if (closeOrdersBtn) closeOrdersBtn.addEventListener("click", () => { if (ordersModal) ordersModal.style.display = "none"; });

    async function renderOrdersList() {
        if (!buyerOrdersList) return;

        let orders = [];
        if (isSupabaseConfigured && supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from("orders").select("*").order("created_at", { ascending: false });
                if (!error && data) orders = data;
                else orders = LocalDB.get("orders", []);
            } catch (e) {
                orders = LocalDB.get("orders", []);
            }
        } else {
            orders = LocalDB.get("orders", []);
        }

        updateOrdersBadge();

        if (orders.length === 0) {
            buyerOrdersList.innerHTML = `<p class="text-muted" style="text-align: center; padding: 24px;">You have no active or past orders yet.</p>`;
            return;
        }

        buyerOrdersList.innerHTML = orders.map(ord => {
            const items = ord.items || [];
            const itemsSummary = items.map(it => `${it.name} (Qty: ${it.quantity})`).join(", ") || "Fresh Produce";
            const dateStr = new Date(ord.created_at || Date.now()).toLocaleDateString();
            const status = ord.status || "pending";

            return `
                <div class="b-order-card">
                    <div class="b-order-header">
                        <div>
                            <strong>Order #${ord.id}</strong>
                            <span class="text-xs text-muted" style="margin-left: 8px;">${dateStr}</span>
                        </div>
                        <span class="status-badge status-${status}">${status.replace(/_/g, " ")}</span>
                    </div>
                    <p class="text-xs text-muted" style="margin-bottom: 6px;"><strong>Items:</strong> ${itemsSummary}</p>
                    <div style="display: flex; justify-content: space-between; font-size: 13px;">
                        <span>Deliver to: <strong>${ord.delivery_location || ord.delivery_address || 'Address provided'}</strong></span>
                        <strong style="color: var(--primary);">₹${ord.total_amount}</strong>
                    </div>
                </div>
            `;
        }).join("");
    }

    /* ====================================================================
       6. BUYER VOICE SEARCH
       ==================================================================== */
    const buyerVoiceBtn = document.getElementById("buyerVoiceBtn");
    const buyerVoiceModal = document.getElementById("buyerVoiceModal");
    const stopBuyerVoiceBtn = document.getElementById("stopBuyerVoiceBtn");
    const buyerVoiceText = document.getElementById("buyerVoiceText");

    let voiceSearchRec = null;
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        voiceSearchRec = new SpeechRec();
        voiceSearchRec.continuous = false;
        voiceSearchRec.interimResults = false;

        voiceSearchRec.onresult = function (event) {
            const transcript = event.results[0][0].transcript.toLowerCase();
            if (buyerVoiceText) buyerVoiceText.textContent = `Heard: "${transcript}"`;
            handleBuyerVoice(transcript);
        };

        voiceSearchRec.onend = () => { if (buyerVoiceModal) buyerVoiceModal.style.display = "none"; };
    }

    function handleBuyerVoice(cmd) {
        showToast(`Searching for "${cmd}"...`);
        if (cmd.includes("cart")) {
            if (buyerCartBtn) buyerCartBtn.click();
        } else if (cmd.includes("order")) {
            if (navOrdersBtn) navOrdersBtn.click();
        } else if (cmd.includes("fruit")) {
            const chip = document.querySelector('.chip[data-category="fruits"]');
            if (chip) chip.click();
        } else if (cmd.includes("veg")) {
            const chip = document.querySelector('.chip[data-category="vegetables"]');
            if (chip) chip.click();
        } else {
            if (marketplaceSearchInput) {
                marketplaceSearchInput.value = cmd.replace("search", "").trim();
                currentSearchTerm = marketplaceSearchInput.value.toLowerCase();
                renderProduceGrid();
            }
        }
    }

    if (buyerVoiceBtn) {
        buyerVoiceBtn.addEventListener("click", function () {
            if (!voiceSearchRec) {
                showToast("Voice recognition not supported.");
                return;
            }
            if (buyerVoiceModal) buyerVoiceModal.style.display = "flex";
            try { voiceSearchRec.start(); } catch (e) {}
        });
    }

    if (stopBuyerVoiceBtn) {
        stopBuyerVoiceBtn.addEventListener("click", () => {
            if (voiceSearchRec) voiceSearchRec.stop();
            if (buyerVoiceModal) buyerVoiceModal.style.display = "none";
        });
    }

    /* ====================================================================
       7. BUYER AUTHENTICATION
       ==================================================================== */
    const buyerAuthModal = document.getElementById("buyerAuthModal");
    const buyerLoginBtn = document.getElementById("buyerLoginBtn");
    const buyerSignupBtn = document.getElementById("buyerSignupBtn");
    const closeBuyerAuthBtn = document.getElementById("closeBuyerAuthBtn");
    const buyerLoginPane = document.getElementById("buyerLoginPane");
    const buyerSignupPane = document.getElementById("buyerSignupPane");
    const switchBSignup = document.getElementById("switchBSignup");
    const switchBLogin = document.getElementById("switchBLogin");
    const bLoginForm = document.getElementById("bLoginForm");
    const bSignupForm = document.getElementById("bSignupForm");

    if (buyerLoginBtn) buyerLoginBtn.addEventListener("click", () => {
        if (buyerAuthModal) buyerAuthModal.style.display = "flex";
        if (buyerLoginPane) buyerLoginPane.classList.remove("hidden");
        if (buyerSignupPane) buyerSignupPane.classList.add("hidden");
    });

    if (buyerSignupBtn) buyerSignupBtn.addEventListener("click", () => {
        if (buyerAuthModal) buyerAuthModal.style.display = "flex";
        if (buyerSignupPane) buyerSignupPane.classList.remove("hidden");
        if (buyerLoginPane) buyerLoginPane.classList.add("hidden");
    });

    if (closeBuyerAuthBtn) closeBuyerAuthBtn.addEventListener("click", () => {
        if (buyerAuthModal) buyerAuthModal.style.display = "none";
    });

    if (switchBSignup) switchBSignup.addEventListener("click", (e) => {
        e.preventDefault();
        if (buyerSignupPane) buyerSignupPane.classList.remove("hidden");
        if (buyerLoginPane) buyerLoginPane.classList.add("hidden");
    });

    if (switchBLogin) switchBLogin.addEventListener("click", (e) => {
        e.preventDefault();
        if (buyerLoginPane) buyerLoginPane.classList.remove("hidden");
        if (buyerSignupPane) buyerSignupPane.classList.add("hidden");
    });

    if (bLoginForm) {
        bLoginForm.addEventListener("submit", function (e) {
            e.preventDefault();
            const email = document.getElementById("bLoginEmail").value.trim();
            buyerUser = {
                id: "buyer-" + Date.now(),
                full_name: email.split("@")[0],
                email: email,
                role: "buyer"
            };
            LocalDB.set("currentUser", buyerUser);
            showToast(`Welcome back, ${buyerUser.full_name}!`);
            if (buyerAuthModal) buyerAuthModal.style.display = "none";
            updateBuyerProfileUI();
        });
    }

    if (bSignupForm) {
        bSignupForm.addEventListener("submit", function (e) {
            e.preventDefault();
            const name = document.getElementById("bSignupName").value.trim();
            const email = document.getElementById("bSignupEmail").value.trim();
            const phone = document.getElementById("bSignupPhone").value.trim();
            const city = document.getElementById("bSignupCity").value.trim();

            buyerUser = {
                id: "buyer-" + Date.now(),
                full_name: name,
                email: email,
                phone: phone,
                city: city,
                role: "buyer"
            };
            LocalDB.set("currentUser", buyerUser);
            showToast(`Welcome to KhetKonnect, ${name}!`);
            if (buyerAuthModal) buyerAuthModal.style.display = "none";
            updateBuyerProfileUI();
        });
    }

    function updateBuyerProfileUI() {
        const nameDisp = document.getElementById("buyerNameDisp");
        const badge = document.getElementById("buyerProfileBadge");
        const authContainer = document.getElementById("buyerAuthContainer");
        const buyerFullName = document.getElementById("buyerFullName");
        const buyerPhone = document.getElementById("buyerPhone");

        if (buyerUser) {
            if (nameDisp) nameDisp.textContent = buyerUser.full_name;
            if (badge) badge.classList.remove("hidden");
            if (authContainer) authContainer.classList.add("hidden");
            if (buyerFullName) buyerFullName.value = buyerUser.full_name || "";
            if (buyerPhone) buyerPhone.value = buyerUser.phone || "";
        }
    }

    const buyerMenuBtn = document.getElementById("buyerMenuBtn");
    const buyerDropdown = document.getElementById("buyerDropdown");
    const buyerLogoutBtn = document.getElementById("buyerLogoutBtn");

    if (buyerMenuBtn && buyerDropdown) {
        buyerMenuBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            buyerDropdown.classList.toggle("hidden");
        });
        document.addEventListener("click", () => {
            if (buyerDropdown) buyerDropdown.classList.add("hidden");
        });
    }

    if (buyerLogoutBtn) {
        buyerLogoutBtn.addEventListener("click", function () {
            buyerUser = null;
            LocalDB.set("currentUser", null);
            showToast("Logged out.");
            location.reload();
        });
    }

    /* ====================================================================
       8. TOAST NOTIFICATION
       ==================================================================== */
    function showToast(msg) {
        const toast = document.getElementById("toastNotification");
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.remove("hidden");
        setTimeout(() => toast.classList.add("hidden"), 3000);
    }

    // Initialize
    fetchMarketProducts();
    updateFavUI();
    updateCartUI();
    updateOrdersBadge();
    updateBuyerProfileUI();
});
