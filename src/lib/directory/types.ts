/**
 * Directory and Vendor Domain Models & Types.
 *
 * Establishes typed schemas for business listings, categories,
 * vendor profiles, and listing photos for Choutuppal CRM.
 */

export const LISTING_STATUSES = [
  'draft',
  'pending',
  'published',
  'suspended',
  'archived',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const VENDOR_STATUSES = ['active', 'suspended', 'archived'] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export interface Category {
  id: string;
  account_id: string;
  slug: string;
  name_en: string;
  name_te: string;
  icon?: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorProfile {
  id: string;
  account_id: string;
  contact_id?: string | null;
  display_name: string;
  phone: string;
  whatsapp_phone: string;
  email?: string | null;
  status: VendorStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ListingPhoto {
  id: string;
  account_id: string;
  listing_id: string;
  storage_path: string;
  url: string;
  sort_order: number;
  is_primary: boolean;
  alt_text?: string | null;
  created_at: string;
}

export interface BusinessListing {
  id: string;
  account_id: string;
  vendor_profile_id?: string | null;
  category_id?: string | null;
  category_slug?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  phone: string;
  whatsapp_phone: string;
  alternate_phone?: string | null;
  email?: string | null;
  address?: string | null;
  area?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  website?: string | null;
  services: string[];
  business_hours: Record<string, string>;
  status: ListingStatus;
  is_verified: boolean;
  is_premium: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Publicly visible subset of a business listing (scrubbed of internal vendor/account secrets).
 */
export interface PublicBusinessListing {
  id: string;
  name: string;
  slug: string;
  category_slug?: string | null;
  description?: string | null;
  phone: string;
  whatsapp_phone: string;
  address?: string | null;
  area?: string | null;
  city: string;
  services: string[];
  business_hours: Record<string, string>;
  is_verified: boolean;
  is_premium: boolean;
  photos: Array<{
    id: string;
    url: string;
    is_primary: boolean;
    sort_order: number;
    alt_text?: string | null;
  }>;
}
