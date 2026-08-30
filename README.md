# KhetKonnect - Unified Shared Backend & Database Architecture

This directory contains the database definition and configuration for **KhetKonnect**, connecting both the **Farmer Frontend** and **Buyer Frontend** to a single, unified Supabase PostgreSQL backend.

---

## 🏛️ Architecture Overview

```text
       Farmer Portal (farmer/)               Buyer Marketplace (buyer/)
                 │                                        │
                 ▼                                        ▼
    ┌─────────────────────────────────────────────────────────────┐
    │              ONE SHARED SUPABASE POSTGRESQL                 │
    │                                                             │
    │  • Authentication (auth.users) & Profiles (profiles)       │
    │  • Produce Catalog & Inventory (products)                   │
    │  • Wishlist & Persistent Cart (favorites, carts, cart_items)│
    │  • Orders & Item Audit (orders, order_items)                │
    │  • Smart Dispatch Routes (logistics_routes)                 │
    │  • Storage Buckets (product-images, profile-images)         │
    │  • Atomic Order RPC (place_order)                           │
    │  • Fine-grained Row Level Security (RLS)                    │
    └─────────────────────────────────────────────────────────────┘
```

---

## 📁 Database Schema Details (`database/schema.sql`)

### 1. `profiles`
- Linked directly to Supabase Auth (`auth.users.id`).
- Fields: `id` (UUID PK), `full_name`, `email`, `phone`, `role` ('farmer' | 'buyer' | 'admin'), `location`, `profile_image`, `created_at`, `updated_at`.
- Auto-provisioned via the `on_auth_user_created` trigger.

### 2. `products`
- Shared farmer listings available to buyers in real time.
- Fields: `id` (UUID PK), `farmer_id` (FK profiles), `farmer_name`, `name`, `category`, `description`, `price`, `quantity`, `unit`, `image_url`, `image_emoji`, `location`, `status` ('available' | 'unavailable' | 'sold_out'), `is_verified`, `created_at`, `updated_at`.
- Strict RLS: Only the owning farmer can edit/delete their crops; buyers and public users can query available stock.

### 3. `favorites`
- Buyer wishlists.
- Fields: `id`, `buyer_id` (FK profiles), `product_id` (FK products), `created_at`.
- Unique constraint on `(buyer_id, product_id)` to prevent duplicates.

### 4. `carts` & `cart_items`
- Persistent multi-device buyer cart.
- Fields (`carts`): `id`, `buyer_id` (FK profiles), `created_at`, `updated_at`.
- Fields (`cart_items`): `id`, `cart_id` (FK carts), `product_id` (FK products), `quantity`, `created_at`, `updated_at`.

### 5. `orders` & `order_items`
- Orders placed by buyers containing items from one or multiple farmers.
- Fields (`orders`): `id`, `buyer_id`, `total_amount`, `delivery_location`, `contact_information`, `status` ('pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled'), `created_at`, `updated_at`.
- Fields (`order_items`): `id`, `order_id`, `product_id`, `farmer_id`, `quantity`, `price_at_purchase`, `subtotal`, `created_at`.
- Stores `price_at_purchase` so price changes by farmers never alter historical transactions.

### 6. Atomic Transaction Function (`place_order`)
- Safe PostgreSQL function executed via `supabase.rpc('place_order', { ... })`:
  1. Validates buyer authentication.
  2. Verifies crop existence, availability, and stock quantity under row locks (`FOR UPDATE`).
  3. Inserts the order and itemized order lines.
  4. Automatically decrements inventory and sets status to `sold_out` if quantity reaches 0.
  5. Clears the buyer's active cart.
  6. Executes atomically within a database transaction to prevent partial states or overselling.

---

## 🚀 Setup & Deployment Instructions

1. **Create Supabase Project**: Go to [supabase.com](https://supabase.com) and create a new project.
2. **Execute SQL**:
   - Open **SQL Editor** in your Supabase project dashboard.
   - Copy the entire contents of `backend/database/schema.sql` and run it.
3. **Configure Environment Variables**:
   - Copy `.env.example` to `.env` or configure in your hosting platform:
     ```env
     VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
     VITE_SUPABASE_ANON_KEY="your-anon-public-key"
     ```
4. Both **Farmer** (`/farmer/`) and **Buyer** (`/buyer/`) frontends automatically read these environment variables and interact with the same database.
