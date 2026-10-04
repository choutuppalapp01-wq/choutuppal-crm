/**
 * Canonical Business Listings and Directory Data Layer.
 *
 * Provides safe, account-isolated queries and mutations for
 * business listings, categories, and vendor relationships.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import type {
  BusinessListing,
  ListingPhoto,
  PublicBusinessListing,
  VendorProfile,
} from './types';

// Defensive input validation regexes
const SAFE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Validates and normalizes business listing input payload before DB persistence.
 */
export function validateListingInput(input: Partial<BusinessListing>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input.name || !input.name.trim()) {
    errors.push('Business name is required');
  }

  if (!input.slug || !SAFE_SLUG_REGEX.test(input.slug)) {
    errors.push('Slug must be lowercase alphanumeric with hyphens (e.g., "sri-sai-electricals")');
  }

  if (!input.phone || !normalizePhone(input.phone)) {
    errors.push('Valid business phone number is required');
  }

  if (!input.whatsapp_phone || !normalizePhone(input.whatsapp_phone)) {
    errors.push('Valid WhatsApp phone number is required');
  }

  if (input.status && !['draft', 'pending', 'published', 'suspended', 'archived'].includes(input.status)) {
    errors.push(`Invalid status: ${input.status}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Transforms an internal business listing into its public-facing shape,
 * stripping internal metadata and sensitive ownership keys.
 */
export function toPublicBusinessListing(
  listing: BusinessListing,
  photos: ListingPhoto[] = [],
): PublicBusinessListing {
  const sortedPhotos = [...photos]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({
      id: p.id,
      url: p.url,
      is_primary: p.is_primary,
      sort_order: p.sort_order,
      alt_text: p.alt_text ?? null,
    }));

  return {
    id: listing.id,
    name: listing.name,
    slug: listing.slug,
    category_slug: listing.category_slug ?? null,
    description: listing.description ?? null,
    phone: listing.phone,
    whatsapp_phone: listing.whatsapp_phone,
    address: listing.address ?? null,
    area: listing.area ?? null,
    city: listing.city,
    services: listing.services ?? [],
    business_hours: listing.business_hours ?? {},
    is_verified: listing.is_verified,
    is_premium: listing.is_premium,
    photos: sortedPhotos,
  };
}

export interface DirectoryDbClient {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Resolves a business listing by ID with strict account isolation.
 *
 * Guards against cross-account access and SQL/script injections.
 */
export async function getBusinessListingById(
  db: SupabaseClient | DirectoryDbClient,
  accountId: string,
  listingId: string,
): Promise<BusinessListing | null> {
  if (!accountId || !listingId || !SAFE_ID_REGEX.test(listingId)) {
    return null;
  }

  const { data, error } = await db
    .from('business_listings')
    .select('*')
    .eq('account_id', accountId)
    .eq('id', listingId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as BusinessListing;
}

/**
 * Resolves a public business listing by slug or ID.
 *
 * Only returns listings with status = 'published'.
 */
export async function getPublicListingBySlug(
  db: SupabaseClient | DirectoryDbClient,
  slug: string,
): Promise<PublicBusinessListing | null> {
  if (!slug || !SAFE_SLUG_REGEX.test(slug)) {
    return null;
  }

  const { data: listing, error: listingErr } = await db
    .from('business_listings')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (listingErr || !listing) {
    return null;
  }

  const { data: photos } = await db
    .from('listing_photos')
    .select('*')
    .eq('listing_id', listing.id)
    .order('sort_order', { ascending: true });

  return toPublicBusinessListing(listing as BusinessListing, (photos as ListingPhoto[]) || []);
}

/**
 * Resolves or creates a vendor profile for an account and phone number.
 */
export async function findOrCreateVendorProfile(
  db: SupabaseClient | DirectoryDbClient,
  args: {
    accountId: string;
    phone: string;
    whatsappPhone?: string;
    displayName: string;
    contactId?: string | null;
  },
): Promise<VendorProfile | null> {
  const normPhone = normalizePhone(args.phone);
  const normWa = normalizePhone(args.whatsappPhone || args.phone);

  if (!args.accountId || !normPhone) return null;

  // Search existing vendor by normalized phone in the given account
  const { data: existing, error: findErr } = await db
    .from('vendor_profiles')
    .select('*')
    .eq('account_id', args.accountId)
    .eq('phone', normPhone)
    .maybeSingle();

  if (!findErr && existing) {
    return existing as VendorProfile;
  }

  // Create new vendor profile
  const { data: inserted, error: insertErr } = await db
    .from('vendor_profiles')
    .insert({
      account_id: args.accountId,
      contact_id: args.contactId ?? null,
      display_name: args.displayName.trim(),
      phone: normPhone,
      whatsapp_phone: normWa,
      status: 'active',
      metadata: {},
    })
    .select('*')
    .maybeSingle();

  if (insertErr || !inserted) {
    console.error('[directory] Error creating vendor profile:', insertErr?.message);
    return null;
  }

  return inserted as VendorProfile;
}
