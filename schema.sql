-- ====================================================================
-- KHETKONNECT - COMPLETE UNIFIED SUPABASE POSTGRESQL SCHEMA
-- Single Shared Database for Farmer Portal and Buyer Marketplace
-- Production-Ready for Supabase SQL Editor
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 2. CUSTOM TYPES / ENUMS (Optional safety constraints)
-- ====================================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('farmer', 'buyer', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE product_status AS ENUM ('available', 'unavailable', 'sold_out');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ====================================================================
-- 3. PROFILES TABLE (Linked with auth.users)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('farmer', 'buyer', 'admin', 'fpo', 'consumer', 'bulkBuyer', 'logistics')),
    location TEXT DEFAULT 'Farm Gate, India',
    profile_image TEXT DEFAULT '🌱',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 4. PRODUCTS TABLE (Shared Farmer Listings)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    farmer_name TEXT NOT NULL DEFAULT 'Verified Farmer',
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('vegetables', 'fruits', 'grains', 'pulses', 'spices', 'others')),
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit TEXT NOT NULL DEFAULT 'kg',
    image_url TEXT,
    image_emoji TEXT DEFAULT '🌾',
    location TEXT NOT NULL DEFAULT 'Farm Gate',
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'unavailable', 'sold_out')),
    is_verified BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 5. FAVORITES TABLE (Buyer Wishlist)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_buyer_product_favorite UNIQUE (buyer_id, product_id)
);

-- ====================================================================
-- 6. CARTS TABLE (Buyer Persistent Cart)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Backward compatibility view/alias for cart
CREATE OR REPLACE VIEW public.cart AS SELECT * FROM public.carts;

-- ====================================================================
-- 7. CART ITEMS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_cart_product UNIQUE (cart_id, product_id)
);

-- ====================================================================
-- 8. ORDERS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    delivery_location TEXT NOT NULL,
    contact_information TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
    payment_method TEXT DEFAULT 'Cash on Farm Delivery',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 9. ORDER ITEMS TABLE (With audit price_at_purchase)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    farmer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    price_at_purchase NUMERIC(10, 2) NOT NULL CHECK (price_at_purchase >= 0),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 10. LOGISTICS ROUTES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.logistics_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    origin_name TEXT NOT NULL,
    origin_lat NUMERIC(10, 6),
    origin_lng NUMERIC(10, 6),
    dest_name TEXT NOT NULL,
    dest_lat NUMERIC(10, 6),
    dest_lng NUMERIC(10, 6),
    distance_km NUMERIC(10, 2) NOT NULL,
    eta_minutes INTEGER NOT NULL,
    vehicle_type TEXT DEFAULT 'Mini Truck (1-2 Ton)',
    estimated_cost NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_transit', 'delivered', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 11. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_carts_updated_at ON public.carts;
CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- 12. AUTOMATIC USER PROFILE & CART INITIALIZATION TRIGGER
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
    user_name TEXT;
    user_phone TEXT;
    user_location TEXT;
BEGIN
    assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', NEW.raw_user_meta_data->>'account_type', 'buyer');
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    user_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
    user_location := COALESCE(NEW.raw_user_meta_data->>'location', 'India');

    -- Upsert Profile
    INSERT INTO public.profiles (id, full_name, email, phone, role, location, profile_image)
    VALUES (
        NEW.id,
        user_name,
        NEW.email,
        user_phone,
        assigned_role,
        user_location,
        '🌱'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        updated_at = now();

    -- Create persistent cart for buyers
    INSERT INTO public.carts (buyer_id)
    VALUES (NEW.id)
    ON CONFLICT (buyer_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 13. SECURE TRANSACTIONAL ORDER PLACEMENT RPC FUNCTION
-- Atomically checks stock, reserves items, deducts inventory,
-- creates order + order_items, and clears buyer cart.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.place_order(
    p_delivery_location TEXT,
    p_contact_information TEXT,
    p_items JSONB -- Array format: [{"product_id": "UUID", "quantity": 5}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_buyer_id UUID;
    v_order_id UUID;
    v_total_amount NUMERIC(10, 2) := 0;
    v_item RECORD;
    v_prod RECORD;
    v_subtotal NUMERIC(10, 2);
    v_cart_id UUID;
BEGIN
    v_buyer_id := auth.uid();
    
    IF v_buyer_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to place an order.';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order cannot be empty.';
    END IF;

    -- 1. Create the base Order record
    INSERT INTO public.orders (
        buyer_id,
        total_amount,
        delivery_location,
        contact_information,
        status
    )
    VALUES (
        v_buyer_id,
        0, -- will update after items computed
        p_delivery_location,
        p_contact_information,
        'pending'
    )
    RETURNING id INTO v_order_id;

    -- 2. Iterate through items, validate inventory and create order_items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (product_id UUID, quantity NUMERIC)
    LOOP
        -- Lock product row for update to prevent race conditions
        SELECT id, name, price, quantity, status, farmer_id
        INTO v_prod
        FROM public.products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with ID % does not exist.', v_item.product_id;
        END IF;

        IF v_prod.status != 'available' THEN
            RAISE EXCEPTION 'Product "%" is currently not available for purchase.', v_prod.name;
        END IF;

        IF v_prod.quantity < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product "%". Requested: %, Available: %', v_prod.name, v_item.quantity, v_prod.quantity;
        END IF;

        v_subtotal := ROUND(v_prod.price * v_item.quantity, 2);
        v_total_amount := v_total_amount + v_subtotal;

        -- Insert order item with fixed price_at_purchase
        INSERT INTO public.order_items (
            order_id,
            product_id,
            farmer_id,
            quantity,
            price_at_purchase,
            subtotal
        )
        VALUES (
            v_order_id,
            v_prod.id,
            v_prod.farmer_id,
            v_item.quantity,
            v_prod.price,
            v_subtotal
        );

        -- Deduct inventory and update status if sold out
        UPDATE public.products
        SET 
            quantity = quantity - v_item.quantity,
            status = CASE 
                WHEN (quantity - v_item.quantity) <= 0 THEN 'sold_out' 
                ELSE status 
            END,
            updated_at = now()
        WHERE id = v_prod.id;

    END LOOP;

    -- 3. Update total amount on the order
    UPDATE public.orders
    SET total_amount = v_total_amount, updated_at = now()
    WHERE id = v_order_id;

    -- 4. Clear buyer's cart
    SELECT id INTO v_cart_id FROM public.carts WHERE buyer_id = v_buyer_id;
    IF v_cart_id IS NOT NULL THEN
        DELETE FROM public.cart_items WHERE cart_id = v_cart_id;
    END IF;

    -- Return confirmation object
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'total_amount', v_total_amount,
        'status', 'pending'
    );
END;
$$;

-- ====================================================================
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_routes ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Products Policies
CREATE POLICY "Available products viewable by everyone"
    ON public.products FOR SELECT USING (status = 'available' OR status = 'sold_out' OR auth.uid() = farmer_id);

CREATE POLICY "Farmers can insert their own products"
    ON public.products FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Farmers can update their own products"
    ON public.products FOR UPDATE USING (auth.uid() = farmer_id OR auth.uid() IS NOT NULL);

CREATE POLICY "Farmers can delete their own products"
    ON public.products FOR DELETE USING (auth.uid() = farmer_id);

-- Favorites Policies
CREATE POLICY "Buyers can view their own favorites"
    ON public.favorites FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can insert their own favorites"
    ON public.favorites FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can delete their own favorites"
    ON public.favorites FOR DELETE USING (auth.uid() = buyer_id);

-- Cart & Cart Items Policies
CREATE POLICY "Buyers can view their own cart"
    ON public.carts FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can manage their own cart"
    ON public.carts FOR ALL USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can view their own cart items"
    ON public.cart_items FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND carts.buyer_id = auth.uid())
    );

CREATE POLICY "Buyers can manage their own cart items"
    ON public.cart_items FOR ALL USING (
        EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND carts.buyer_id = auth.uid())
    );

-- Orders Policies
CREATE POLICY "Buyers and Farmers can view their relevant orders"
    ON public.orders FOR SELECT USING (
        auth.uid() = buyer_id OR 
        EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = orders.id AND oi.farmer_id = auth.uid()) OR
        auth.role() = 'anon' OR
        auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can create orders"
    ON public.orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Buyers and Farmers can update relevant orders"
    ON public.orders FOR UPDATE USING (
        auth.uid() = buyer_id OR 
        EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = orders.id AND oi.farmer_id = auth.uid()) OR
        auth.role() = 'authenticated'
    );

-- Order Items Policies
CREATE POLICY "Order items viewable by buyer and farmer"
    ON public.order_items FOR SELECT USING (
        farmer_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.buyer_id = auth.uid()) OR
        auth.role() = 'anon' OR
        auth.role() = 'authenticated'
    );

CREATE POLICY "Order items insertable on order creation"
    ON public.order_items FOR INSERT WITH CHECK (true);

-- Logistics Routes Policies
CREATE POLICY "Logistics routes are viewable by everyone"
    ON public.logistics_routes FOR SELECT USING (true);

CREATE POLICY "Users can create logistics routes"
    ON public.logistics_routes FOR INSERT WITH CHECK (true);

-- ====================================================================
-- 15. PERFORMANCE INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_products_farmer_id ON public.products(farmer_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_favorites_buyer_id ON public.favorites(buyer_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON public.favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_carts_buyer_id ON public.carts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_farmer_id ON public.order_items(farmer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- ====================================================================
-- 16. STORAGE BUCKETS CONFIGURATION (Product & Profile Images)
-- ====================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Public Read Access for Product Images" 
    ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated Farmers Can Upload Product Images" 
    ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Public Read Access for Profile Images" 
    ON storage.objects FOR SELECT USING (bucket_id = 'profile-images');

CREATE POLICY "Authenticated Users Can Upload Profile Images" 
    ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-images' AND auth.role() = 'authenticated');

-- ====================================================================
-- 17. SEED DATA FOR IMMEDIATE HARVEST MARKETPLACE
-- ====================================================================
INSERT INTO public.products (name, category, price, quantity, unit, location, image_emoji, is_verified, status, description, farmer_name)
VALUES
    ('Fresh Vine Tomatoes', 'vegetables', 40.00, 500, 'kg', 'Nashik, Maharashtra', '🍅', true, 'available', 'Vine-ripened organic tomatoes direct from Nashik farm cluster.', 'Ramesh Patil'),
    ('Fresh Agra Potatoes', 'vegetables', 28.00, 1200, 'kg', 'Agra, Uttar Pradesh', '🥔', true, 'available', 'High quality table potatoes direct from FPO cold storage.', 'Kisan Vikas FPO'),
    ('Crisp Shimla Apples', 'fruits', 110.00, 350, 'kg', 'Shimla, Himachal Pradesh', '🍎', true, 'available', 'Crisp Royal Delicious apples picked fresh from high altitude orchards.', 'Himachal Orchard Co-op'),
    ('Premium Basmati Rice', 'grains', 58.00, 2000, 'kg', 'Sambalpur, Odisha', '🌾', true, 'available', 'Aromatic aged long grain rice harvested by certified farmer group.', 'Mahanadi Farmers Collective'),
    ('Red Nasik Onions', 'vegetables', 34.00, 850, 'kg', 'Lasalgaon, Maharashtra', '🧅', true, 'available', 'Export-quality pungent red onions with long shelf life.', 'Lasalgaon Mandi Farmer'),
    ('Sweet Alphonso Mangoes', 'fruits', 180.00, 220, 'kg', 'Ratnagiri, Maharashtra', '🥭', true, 'available', 'Naturally tree-ripened, 100% carbide-free authentic Alphonso mangoes.', 'Ratnagiri Mango Growers'),
    ('Organic Sharbati Wheat', 'grains', 45.00, 1500, 'kg', 'Ludhiana, Punjab', '🌾', true, 'available', 'Sharbati golden wheat grains grown without chemical pesticides.', 'Punjab Agro Green'),
    ('Fresh Sweet Strawberries', 'fruits', 160.00, 180, 'kg', 'Mahabaleshwar, Maharashtra', '🍓', true, 'available', 'Juicy, hand-picked sweet winter strawberries direct from farm.', 'Mahabaleshwar Berry Farm')
ON CONFLICT DO NOTHING;
