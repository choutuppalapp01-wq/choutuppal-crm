-- ============================================================
-- 042_directory_vendor_foundation.sql
--
-- Choutuppal CRM — Batch 05: Directory + Vendor Foundation
--
-- Adds:
--   1. categories: directory category taxonomy (Telugu + English display)
--   2. vendor_profiles: business owner profile tied to account and optional contact
--   3. business_listings: core local business listing with location, services, status
--   4. listing_photos: photo gallery for listings (supports primary flag, ordering)
--
-- Tenancy & Security:
--   - All tables enforce Row Level Security (RLS) via is_account_member(account_id).
--   - Public reads for published business listings and their photos.
--   - Strict account isolation: Account A cannot view, mutate, or delete Account B's records.
--   - Service role bypass retained for background automation & webhooks.
--
-- Idempotent: safe to run multiple times with IF NOT EXISTS and DROP POLICY.
-- ============================================================

-- ============================================================
-- 1. CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_te TEXT NOT NULL,
  icon TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_categories_account_active ON categories(account_id, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_select ON categories;
CREATE POLICY categories_select ON categories FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS categories_insert ON categories;
CREATE POLICY categories_insert ON categories FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS categories_update ON categories;
CREATE POLICY categories_update ON categories FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS categories_delete ON categories;
CREATE POLICY categories_delete ON categories FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- ============================================================
-- 2. VENDOR_PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS vendor_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_phone TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_account ON vendor_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_contact ON vendor_profiles(contact_id);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_phone ON vendor_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_whatsapp ON vendor_profiles(whatsapp_phone);

ALTER TABLE vendor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_profiles_select ON vendor_profiles;
CREATE POLICY vendor_profiles_select ON vendor_profiles FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS vendor_profiles_insert ON vendor_profiles;
CREATE POLICY vendor_profiles_insert ON vendor_profiles FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS vendor_profiles_update ON vendor_profiles;
CREATE POLICY vendor_profiles_update ON vendor_profiles FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS vendor_profiles_delete ON vendor_profiles;
CREATE POLICY vendor_profiles_delete ON vendor_profiles FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- ============================================================
-- 3. BUSINESS_LISTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS business_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  vendor_profile_id UUID REFERENCES vendor_profiles(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  category_slug TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  phone TEXT NOT NULL,
  whatsapp_phone TEXT NOT NULL,
  alternate_phone TEXT,
  email TEXT,
  address TEXT,
  area TEXT,
  city TEXT NOT NULL DEFAULT 'Choutuppal',
  state TEXT NOT NULL DEFAULT 'Telangana',
  pincode TEXT NOT NULL DEFAULT '508252',
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  website TEXT,
  services TEXT[] NOT NULL DEFAULT '{}',
  business_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'suspended', 'archived')),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_business_listings_account_status ON business_listings(account_id, status);
CREATE INDEX IF NOT EXISTS idx_business_listings_vendor ON business_listings(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_business_listings_category ON business_listings(category_id);
CREATE INDEX IF NOT EXISTS idx_business_listings_category_slug ON business_listings(category_slug);
CREATE INDEX IF NOT EXISTS idx_business_listings_phone ON business_listings(phone);
CREATE INDEX IF NOT EXISTS idx_business_listings_whatsapp ON business_listings(whatsapp_phone);
CREATE INDEX IF NOT EXISTS idx_business_listings_premium ON business_listings(is_premium) WHERE is_premium = true;
CREATE INDEX IF NOT EXISTS idx_business_listings_created_at ON business_listings(created_at DESC);

ALTER TABLE business_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_listings_select ON business_listings;
CREATE POLICY business_listings_select ON business_listings FOR SELECT
  USING (
    is_account_member(account_id)
    OR status = 'published'
  );

DROP POLICY IF EXISTS business_listings_insert ON business_listings;
CREATE POLICY business_listings_insert ON business_listings FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS business_listings_update ON business_listings;
CREATE POLICY business_listings_update ON business_listings FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS business_listings_delete ON business_listings;
CREATE POLICY business_listings_delete ON business_listings FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- ============================================================
-- 4. LISTING_PHOTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS listing_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES business_listings(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  alt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_photos_listing ON listing_photos(listing_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_listing_photos_account ON listing_photos(account_id);

ALTER TABLE listing_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listing_photos_select ON listing_photos;
CREATE POLICY listing_photos_select ON listing_photos FOR SELECT
  USING (
    is_account_member(account_id)
    OR EXISTS (
      SELECT 1 FROM business_listings bl
      WHERE bl.id = listing_photos.listing_id
        AND bl.status = 'published'
    )
  );

DROP POLICY IF EXISTS listing_photos_insert ON listing_photos;
CREATE POLICY listing_photos_insert ON listing_photos FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS listing_photos_update ON listing_photos;
CREATE POLICY listing_photos_update ON listing_photos FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS listing_photos_delete ON listing_photos;
CREATE POLICY listing_photos_delete ON listing_photos FOR DELETE
  USING (is_account_member(account_id, 'agent'));

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
