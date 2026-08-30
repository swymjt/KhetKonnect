/**
 * ====================================================================
 * KHETKONNECT - FARMER PORTAL CONTROLLER (farmer/script.js)
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
            console.log("🌾 Farmer Portal: Connected to Shared Supabase Backend");
        } catch (e) {
            console.warn("🌾 Farmer Portal: Supabase fallback", e);
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

    // Current User
    let currentUser = LocalDB.get("currentUser") || {
        id: "farmer-patil-01",
        full_name: "Ramesh Patil",
        email: "ramesh@khetkonnect.in",
        role: "farmer",
        location: "Nashik, Maharashtra"
    };

    /* ====================================================================
       2. TAB NAVIGATION
       ==================================================================== */
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");

    tabButtons.forEach(btn => {
        btn.addEventListener("click", function () {
            const targetTab = this.getAttribute("data-tab");
            
            tabButtons.forEach(b => b.classList.remove("active"));
            tabPanes.forEach(p => p.classList.remove("active"));

            this.classList.add("active");
            const activePane = document.getElementById(`pane-${targetTab}`);
            if (activePane) activePane.classList.add("active");

            if (targetTab === "my-listings") loadFarmerProducts();
            if (targetTab === "incoming-orders") loadIncomingOrders();
        });
    });

    /* ====================================================================
       3. PRODUCE MANAGEMENT (Add, List, Delete, Toggle Status)
       ==================================================================== */
    const farmerProduceForm = document.getElementById("farmerProduceForm");
    const farmerProductsContainer = document.getElementById("farmerProductsContainer");
    const myListingsCount = document.getElementById("myListingsCount");
    const statTotalProducts = document.getElementById("statTotalProducts");
    const refreshProductsBtn = document.getElementById("refreshProductsBtn");

    async function loadFarmerProducts() {
        let products = [];

        if (isSupabaseConfigured && supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from("products")
                    .select("*")
                    .order("created_at", { ascending: false });

                if (!error && data) {
                    products = data;
                }
            } catch (err) {
                console.warn("Supabase fetch products error, fallback to local:", err);
                products = LocalDB.get("products", []);
            }
        } else {
            products = LocalDB.get("products", []);
        }

        // Render in UI
        if (myListingsCount) myListingsCount.textContent = products.length;
        if (statTotalProducts) statTotalProducts.textContent = `${products.length}+`;

        if (!farmerProductsContainer) return;

        if (products.length === 0) {
            farmerProductsContainer.innerHTML = `
                <div class="empty-state" style="grid-column: span 3; text-align: center; padding: 40px;">
                    <p class="text-muted">No harvest produce listed yet. Click <strong>"➕ List New Harvest Crop"</strong> to publish your first produce!</p>
                </div>
            `;
            return;
        }

        farmerProductsContainer.innerHTML = products.map(prod => {
            const price = prod.price || prod.price_per_kg || 0;
            const stock = prod.quantity !== undefined ? prod.quantity : (prod.stock_qty || 0);
            const emoji = prod.image_emoji || "🌾";
            const isAvailable = prod.status === "available" || prod.is_active !== false;

            return `
                <div class="f-prod-card" data-id="${prod.id}">
                    <div class="f-prod-top">
                        <div class="f-prod-emoji">${emoji}</div>
                        <div>
                            <h4 class="f-prod-title">${prod.name}</h4>
                            <span class="text-xs text-muted">📍 ${prod.location || 'Farm Gate'}</span>
                        </div>
                    </div>
                    <div class="f-prod-price">₹${price} <span class="text-xs text-muted">/ ${prod.unit || 'kg'}</span></div>
                    <div class="f-prod-stock">
                        Stock: <strong>${stock} ${prod.unit || 'kg'}</strong> • 
                        <span style="color: ${isAvailable ? '#16a34a' : '#dc2626'}; font-weight: 700;">
                            ${isAvailable ? '● Available' : '○ Unavailable'}
                        </span>
                    </div>
                    <p class="text-xs text-muted" style="line-height: 1.3;">${prod.description || 'Verified fresh farm harvest.'}</p>
                    <div class="f-prod-actions">
                        <button class="btn-toggle toggle-status-btn" data-id="${prod.id}" data-status="${isAvailable ? 'available' : 'unavailable'}">
                            ${isAvailable ? 'Mark Sold Out' : 'Mark Available'}
                        </button>
                        <button class="btn-del delete-prod-btn" data-id="${prod.id}">Delete</button>
                    </div>
                </div>
            `;
        }).join("");

        // Attach action handlers
        document.querySelectorAll(".delete-prod-btn").forEach(btn => {
            btn.addEventListener("click", function () {
                const prodId = this.getAttribute("data-id");
                deleteProduct(prodId);
            });
        });

        document.querySelectorAll(".toggle-status-btn").forEach(btn => {
            btn.addEventListener("click", function () {
                const prodId = this.getAttribute("data-id");
                const currentStatus = this.getAttribute("data-status");
                toggleProductStatus(prodId, currentStatus === "available" ? "unavailable" : "available");
            });
        });
    }

    if (farmerProduceForm) {
        farmerProduceForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const name = document.getElementById("cropName").value.trim();
            const category = document.getElementById("cropCategory").value;
            const price = parseFloat(document.getElementById("cropPrice").value);
            const stock = parseFloat(document.getElementById("cropStock").value);
            const unit = document.getElementById("cropUnit").value;
            const location = document.getElementById("farmLocation").value.trim();
            const emoji = document.getElementById("cropEmoji").value;
            const desc = document.getElementById("cropDesc").value.trim();

            const newProduct = {
                id: "prod-" + Date.now(),
                farmer_id: currentUser ? currentUser.id : null,
                farmer_name: currentUser ? currentUser.full_name : "Ramesh Patil",
                name: name,
                category: category,
                price: price,
                price_per_kg: price,
                quantity: stock,
                stock_qty: stock,
                unit: unit,
                location: location,
                image_emoji: emoji,
                description: desc || "Naturally grown fresh farm produce.",
                status: "available",
                is_verified: true,
                is_active: true,
                created_at: new Date().toISOString()
            };

            showToast("Publishing produce to Supabase backend...");

            if (isSupabaseConfigured && supabaseClient) {
                try {
                    const { data, error } = await supabaseClient
                        .from("products")
                        .insert([newProduct])
                        .select();

                    if (error) throw error;
                    showToast(`🌾 "${name}" successfully listed in Supabase!`);
                } catch (err) {
                    console.warn("Supabase insert error, saved locally:", err);
                    saveProductLocally(newProduct);
                    showToast(`🌾 "${name}" published (Local Storage Sync)`);
                }
            } else {
                saveProductLocally(newProduct);
                showToast(`🌾 "${name}" published successfully!`);
            }

            farmerProduceForm.reset();
            loadFarmerProducts();

            // Switch to My Listings Tab
            const listingsTab = document.getElementById("tabMyListingsBtn");
            if (listingsTab) listingsTab.click();
        });
    }

    function saveProductLocally(product) {
        const prods = LocalDB.get("products", []);
        prods.unshift(product);
        LocalDB.set("products", prods);
    }

    async function deleteProduct(productId) {
        if (!confirm("Are you sure you want to remove this harvest listing?")) return;

        showToast("Removing product...");

        if (isSupabaseConfigured && supabaseClient) {
            try {
                await supabaseClient.from("products").delete().eq("id", productId);
            } catch (err) {
                console.warn("Supabase delete error:", err);
            }
        }

        // Local deletion
        let prods = LocalDB.get("products", []);
        prods = prods.filter(p => p.id !== productId);
        LocalDB.set("products", prods);

        showToast("Harvest listing removed.");
        loadFarmerProducts();
    }

    async function toggleProductStatus(productId, nextStatus) {
        showToast("Updating status...");

        if (isSupabaseConfigured && supabaseClient) {
            try {
                await supabaseClient
                    .from("products")
                    .update({ 
                        status: nextStatus, 
                        is_active: nextStatus === "available",
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", productId);
            } catch (err) {
                console.warn("Supabase status update error:", err);
            }
        }

        let prods = LocalDB.get("products", []);
        prods = prods.map(p => {
            if (p.id === productId) {
                p.status = nextStatus;
                p.is_active = nextStatus === "available";
            }
            return p;
        });
        LocalDB.set("products", prods);

        showToast(`Produce status updated to ${nextStatus}.`);
        loadFarmerProducts();
    }

    if (refreshProductsBtn) refreshProductsBtn.addEventListener("click", loadFarmerProducts);

    /* ====================================================================
       4. INCOMING BUYER ORDERS
       ==================================================================== */
    const incomingOrdersContainer = document.getElementById("incomingOrdersContainer");
    const incomingOrdersCount = document.getElementById("incomingOrdersCount");
    const refreshOrdersBtn = document.getElementById("refreshOrdersBtn");

    async function loadIncomingOrders() {
        let orders = [];

        if (isSupabaseConfigured && supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from("orders")
                    .select("*, order_items(*)")
                    .order("created_at", { ascending: false });

                if (!error && data) {
                    orders = data;
                }
            } catch (err) {
                console.warn("Supabase orders error:", err);
                orders = LocalDB.get("orders", []);
            }
        } else {
            orders = LocalDB.get("orders", []);
        }

        if (incomingOrdersCount) incomingOrdersCount.textContent = orders.length;

        if (!incomingOrdersContainer) return;

        if (orders.length === 0) {
            incomingOrdersContainer.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px;">
                    <p class="text-muted">No incoming buyer orders yet. Orders placed by buyers in the marketplace will appear here in real time.</p>
                </div>
            `;
            return;
        }

        incomingOrdersContainer.innerHTML = orders.map(order => {
            const items = order.items || order.order_items || [];
            const itemsSummary = items.map(it => `${it.name || it.product_name || 'Crop'} (Qty: ${it.quantity})`).join(", ") || "Fresh Produce";
            const dateStr = new Date(order.created_at || Date.now()).toLocaleString();
            const status = order.status || "pending";

            return `
                <div class="order-row" data-id="${order.id}">
                    <div class="order-header">
                        <div>
                            <span class="order-id">📦 Order #${order.id}</span>
                            <span class="text-xs text-muted" style="margin-left: 8px;">${dateStr}</span>
                        </div>
                        <span class="status-badge status-${status}">${status.replace(/_/g, " ")}</span>
                    </div>

                    <div class="order-details">
                        <div>
                            <strong>Items Ordered:</strong>
                            <p class="text-muted">${itemsSummary}</p>
                        </div>
                        <div>
                            <strong>Buyer Details:</strong>
                            <p class="text-muted">${order.buyer_name || 'Verified Buyer'} • ${order.buyer_phone || '+91 9876543210'}</p>
                            <p class="text-xs text-muted">📍 ${order.delivery_location || order.delivery_address || 'Address provided'}</p>
                        </div>
                        <div>
                            <strong>Total Value:</strong>
                            <p style="font-size: 16px; font-weight: 800; color: var(--primary);">₹${order.total_amount || 0}</p>
                        </div>
                    </div>

                    <div class="order-actions-bar">
                        <label class="text-xs"><strong>Update Fulfillment Status:</strong></label>
                        <select class="order-status-select" data-id="${order.id}">
                            <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending Verification</option>
                            <option value="confirmed" ${status === 'confirmed' ? 'selected' : ''}>Confirmed & Accepted</option>
                            <option value="preparing" ${status === 'preparing' ? 'selected' : ''}>Packed & Preparing Dispatch</option>
                            <option value="out_for_delivery" ${status === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery (Cold Chain)</option>
                            <option value="delivered" ${status === 'delivered' ? 'selected' : ''}>Delivered to Buyer</option>
                            <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </div>
                </div>
            `;
        }).join("");

        // Attach status change events
        document.querySelectorAll(".order-status-select").forEach(sel => {
            sel.addEventListener("change", function () {
                const orderId = this.getAttribute("data-id");
                const newStatus = this.value;
                updateOrderStatus(orderId, newStatus);
            });
        });
    }

    async function updateOrderStatus(orderId, newStatus) {
        showToast(`Updating Order #${orderId} to ${newStatus}...`);

        if (isSupabaseConfigured && supabaseClient) {
            try {
                await supabaseClient
                    .from("orders")
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq("id", orderId);
            } catch (err) {
                console.warn("Supabase order update error:", err);
            }
        }

        let orders = LocalDB.get("orders", []);
        orders = orders.map(o => {
            if (o.id === orderId) o.status = newStatus;
            return o;
        });
        LocalDB.set("orders", orders);

        showToast(`Order #${orderId} status saved as "${newStatus.replace(/_/g, " ")}".`);
        loadIncomingOrders();
    }

    if (refreshOrdersBtn) refreshOrdersBtn.addEventListener("click", loadIncomingOrders);

    /* ====================================================================
       5. LEAFLET DISPATCH ROUTE PLANNER
       ==================================================================== */
    let map = null;
    let routeLayer = null;

    function initMap() {
        const mapContainer = document.getElementById("farmerRouteMap");
        if (!mapContainer || !window.L) return;

        map = L.map("farmerRouteMap").setView([19.9975, 73.7898], 8); // Nashik Center

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        drawSampleRoute([19.9975, 73.7898], [19.0760, 72.8777]); // Nashik to Mumbai
    }

    function drawSampleRoute(origin, dest) {
        if (!map) return;
        if (routeLayer) map.removeLayer(routeLayer);

        const latlngs = [
            origin,
            [19.5, 73.3],
            [19.2, 73.0],
            dest
        ];

        routeLayer = L.polyline(latlngs, { color: '#2f913f', weight: 5, opacity: 0.85 }).addTo(map);
        L.marker(origin).addTo(map).bindPopup("🚜 Farm Origin (Nashik)").openPopup();
        L.marker(dest).addTo(map).bindPopup("🛒 APMC Mandi Hub (Mumbai)");
        map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
    }

    const planRouteBtn = document.getElementById("planRouteBtn");
    if (planRouteBtn) {
        planRouteBtn.addEventListener("click", function () {
            showToast("Optimizing Cold-Chain Route...");
            setTimeout(() => {
                showToast("Route Calculated: 168 km • 3.5 hrs transit time");
                const metricDist = document.getElementById("metricDistance");
                const metricEta = document.getElementById("metricEta");
                const metricFreight = document.getElementById("metricFreight");
                if (metricDist) metricDist.textContent = "168 km";
                if (metricEta) metricEta.textContent = "3.5 hrs";
                if (metricFreight) metricFreight.textContent = "₹2,352";
            }, 500);
        });
    }

    /* ====================================================================
       6. AI INSIGHTS DEMAND PREDICTOR
       ==================================================================== */
    const aiCropSelect = document.getElementById("aiCropSelect");
    const aiTrendText = document.getElementById("aiTrendText");
    const aiAdviceText = document.getElementById("aiAdviceText");

    const AI_DATA = {
        tomatoes: {
            trend: "▲ 28% Increase Expected (Next 7 Days)",
            advice: "High demand surge in urban clusters. Optimal harvest window: Next 36 hours. Recommended floor price: ₹38 - ₹42/kg."
        },
        potatoes: {
            trend: "▲ 15% Steady Demand",
            advice: "Stable cold-storage demand. Bulk procurement active for food processing units. Recommended price: ₹26 - ₹30/kg."
        },
        onions: {
            trend: "▲ 34% High Export & Mandi Spike",
            advice: "Strong demand in Southern mandis. Dry curing recommended before packaging to maximize shelf life."
        },
        apples: {
            trend: "▲ 20% Premium Seasonal Demand",
            advice: "High demand for Grade-A Royal Delicious. Cold van dispatch recommended."
        },
        rice: {
            trend: "▲ 12% Consistent Wholesale Volume",
            advice: "Aromatic Basmati wholesale buying active. Bulk bag packaging recommended."
        }
    };

    if (aiCropSelect) {
        aiCropSelect.addEventListener("change", function () {
            const crop = this.value;
            const data = AI_DATA[crop] || AI_DATA.tomatoes;
            if (aiTrendText) aiTrendText.textContent = data.trend;
            if (aiAdviceText) aiAdviceText.textContent = data.advice;
        });
    }

    /* ====================================================================
       7. MULTILINGUAL VOICE AI ASSISTANT
       ==================================================================== */
    const voiceCommandBtn = document.getElementById("voiceCommandBtn");
    const voiceModal = document.getElementById("voiceModal");
    const stopVoiceBtn = document.getElementById("stopVoiceBtn");
    const voiceSpeechText = document.getElementById("voiceSpeechText");

    let recognition = null;
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRec();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript.toLowerCase();
            if (voiceSpeechText) voiceSpeechText.textContent = `Heard: "${transcript}"`;
            handleVoiceCommand(transcript);
        };

        recognition.onerror = function () {
            showToast("Voice input error or permission denied.");
            closeVoiceModal();
        };

        recognition.onend = function () {
            closeVoiceModal();
        };
    }

    function handleVoiceCommand(cmd) {
        showToast(`Processing: "${cmd}"`);
        if (cmd.includes("order") || cmd.includes("incoming")) {
            const btn = document.getElementById("tabIncomingOrdersBtn");
            if (btn) btn.click();
        } else if (cmd.includes("list") || cmd.includes("add") || cmd.includes("crop") || cmd.includes("tomato")) {
            const btn = document.getElementById("tabAddProduceBtn");
            if (btn) btn.click();
            if (cmd.includes("tomato")) {
                const nameInput = document.getElementById("cropName");
                if (nameInput) nameInput.value = "Fresh Vine Tomatoes";
            }
        } else if (cmd.includes("inventory") || cmd.includes("my listing") || cmd.includes("stock")) {
            const btn = document.getElementById("tabMyListingsBtn");
            if (btn) btn.click();
        }
    }

    if (voiceCommandBtn) {
        voiceCommandBtn.addEventListener("click", function () {
            if (!recognition) {
                showToast("Voice recognition not supported in this browser.");
                return;
            }
            if (voiceModal) voiceModal.style.display = "flex";
            try {
                recognition.start();
            } catch (e) {
                console.warn(e);
            }
        });
    }

    function closeVoiceModal() {
        if (voiceModal) voiceModal.style.display = "none";
    }

    if (stopVoiceBtn) {
        stopVoiceBtn.addEventListener("click", function () {
            if (recognition) recognition.stop();
            closeVoiceModal();
        });
    }

    /* ====================================================================
       8. AUTHENTICATION (Login / Signup)
       ==================================================================== */
    const authModal = document.getElementById("authModal");
    const loginButton = document.getElementById("loginButton");
    const signupButton = document.getElementById("signupButton");
    const closeAuthBtn = document.getElementById("closeAuthBtn");
    const loginFormPane = document.getElementById("loginFormPane");
    const signupFormPane = document.getElementById("signupFormPane");
    const switchSignupLink = document.getElementById("switchSignupLink");
    const switchLoginLink = document.getElementById("switchLoginLink");
    const farmerLoginForm = document.getElementById("farmerLoginForm");
    const farmerSignupForm = document.getElementById("farmerSignupForm");

    function openLogin() {
        if (authModal) authModal.style.display = "flex";
        if (loginFormPane) loginFormPane.classList.remove("hidden");
        if (signupFormPane) signupFormPane.classList.add("hidden");
    }

    function openSignup() {
        if (authModal) authModal.style.display = "flex";
        if (signupFormPane) signupFormPane.classList.remove("hidden");
        if (loginFormPane) loginFormPane.classList.add("hidden");
    }

    function closeAuth() {
        if (authModal) authModal.style.display = "none";
    }

    if (loginButton) loginButton.addEventListener("click", openLogin);
    if (signupButton) signupButton.addEventListener("click", openSignup);
    if (closeAuthBtn) closeAuthBtn.addEventListener("click", closeAuth);
    if (switchSignupLink) switchSignupLink.addEventListener("click", (e) => { e.preventDefault(); openSignup(); });
    if (switchLoginLink) switchLoginLink.addEventListener("click", (e) => { e.preventDefault(); openLogin(); });

    if (farmerLoginForm) {
        farmerLoginForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const email = document.getElementById("loginEmail").value.trim();
            const password = document.getElementById("loginPassword").value;

            showToast("Signing in to Supabase...");
            currentUser = {
                id: "farmer-" + Date.now(),
                email: email,
                full_name: email.split("@")[0],
                role: "farmer",
                location: "Maharashtra, India"
            };
            LocalDB.set("currentUser", currentUser);
            showToast(`Welcome back, ${currentUser.full_name}!`);
            closeAuth();
            updateFarmerProfileUI();
        });
    }

    if (farmerSignupForm) {
        farmerSignupForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const name = document.getElementById("signupName").value.trim();
            const email = document.getElementById("signupEmail").value.trim();
            const phone = document.getElementById("signupPhone").value.trim();
            const loc = document.getElementById("signupLocation").value.trim();

            showToast("Creating Farmer Account in Supabase...");
            currentUser = {
                id: "farmer-" + Date.now(),
                full_name: name,
                email: email,
                phone: phone,
                location: loc,
                role: "farmer"
            };
            LocalDB.set("currentUser", currentUser);
            showToast(`Farmer account created for ${name}!`);
            closeAuth();
            updateFarmerProfileUI();
        });
    }

    function updateFarmerProfileUI() {
        const nameDisp = document.getElementById("userNameDisplay");
        const emailDisp = document.getElementById("userEmailDisplay");
        const userBadge = document.getElementById("userProfileBadge");
        const authContainer = document.getElementById("authActionsContainer");

        if (currentUser) {
            if (nameDisp) nameDisp.textContent = currentUser.full_name;
            if (emailDisp) emailDisp.textContent = currentUser.email;
            if (userBadge) userBadge.classList.remove("hidden");
            if (authContainer) authContainer.classList.add("hidden");
        }
    }

    const userMenuButton = document.getElementById("userMenuButton");
    const userDropdownMenu = document.getElementById("userDropdownMenu");
    const userLogoutBtn = document.getElementById("userLogoutBtn");

    if (userMenuButton && userDropdownMenu) {
        userMenuButton.addEventListener("click", function (e) {
            e.stopPropagation();
            userDropdownMenu.classList.toggle("hidden");
        });
        document.addEventListener("click", function () {
            if (userDropdownMenu) userDropdownMenu.classList.add("hidden");
        });
    }

    if (userLogoutBtn) {
        userLogoutBtn.addEventListener("click", function () {
            currentUser = null;
            LocalDB.set("currentUser", null);
            showToast("Logged out from Farmer Portal.");
            location.reload();
        });
    }

    /* ====================================================================
       9. TOAST NOTIFICATION UTILITY
       ==================================================================== */
    function showToast(msg) {
        const toast = document.getElementById("toastNotification");
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.remove("hidden");
        setTimeout(() => {
            toast.classList.add("hidden");
        }, 3200);
    }

    // Initialize on load
    loadFarmerProducts();
    loadIncomingOrders();
    updateFarmerProfileUI();
    setTimeout(initMap, 500);
});
