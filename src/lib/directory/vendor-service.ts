/**
 * Vendor Self-Service Engine & Operations.
 *
 * Provides safe, account-isolated business listing management for vendors,
 * including phone-based vendor matching, listing claim, guided updates,
 * and photo management.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import type { DirectoryDbClient } from './listings';
import { validateListingInput } from './listings';
import type {
  BusinessListing,
  ListingPhoto,
  VendorProfile,
} from './types';

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export interface VendorIdentificationResult {
  isVendor: boolean;
  vendorProfile: VendorProfile | null;
  listings: BusinessListing[];
  unclaimedListing: BusinessListing | null;
}

/**
 * Identifies a vendor by incoming WhatsApp phone number within the current account.
 *
 * 1. Checks vendor_profiles for account_id + normalized phone match.
 * 2. If vendor profile exists, fetches all associated business listings.
 * 3. If no vendor profile, checks whether an existing unclaimed business listing
 *    matches the phone number (eligible for claiming).
 */
export async function identifyVendorByPhone(
  db: SupabaseClient | DirectoryDbClient,
  accountId: string,
  rawPhone: string,
): Promise<VendorIdentificationResult> {
  const normPhone = normalizePhone(rawPhone);
  if (!accountId || !normPhone) {
    return {
      isVendor: false,
      vendorProfile: null,
      listings: [],
      unclaimedListing: null,
    };
  }

  // 1. Look up existing vendor profile in the account
  const { data: vendor, error: vendorErr } = await db
    .from('vendor_profiles')
    .select('*')
    .eq('account_id', accountId)
    .or(`phone.eq.${normPhone},whatsapp_phone.eq.${normPhone}`)
    .maybeSingle();

  if (!vendorErr && vendor) {
    const v = vendor as VendorProfile;
    // Load all listings owned by this vendor in this account
    const { data: listings } = await db
      .from('business_listings')
      .select('*')
      .eq('account_id', accountId)
      .eq('vendor_profile_id', v.id)
      .order('created_at', { ascending: true });

    return {
      isVendor: true,
      vendorProfile: v,
      listings: (listings as BusinessListing[]) || [],
      unclaimedListing: null,
    };
  }

  // 2. Check if an unclaimed business listing matches this phone
  const { data: unclaimed } = await db
    .from('business_listings')
    .select('*')
    .eq('account_id', accountId)
    .or(`phone.eq.${normPhone},whatsapp_phone.eq.${normPhone}`)
    .is('vendor_profile_id', null)
    .limit(1)
    .maybeSingle();

  return {
    isVendor: false,
    vendorProfile: null,
    listings: [],
    unclaimedListing: (unclaimed as BusinessListing) || null,
  };
}

/**
 * Claims an unclaimed business listing for a vendor.
 *
 * Creates or associates a vendor profile and updates business_listings.vendor_profile_id.
 * Verifies strict account isolation and ensures listing was actually unclaimed.
 */
export async function claimBusinessListing(
  db: SupabaseClient | DirectoryDbClient,
  args: {
    accountId: string;
    listingId: string;
    phone: string;
    displayName: string;
    contactId?: string | null;
  },
): Promise<{ success: boolean; vendorProfile?: VendorProfile; error?: string }> {
  const normPhone = normalizePhone(args.phone);
  if (!args.accountId || !args.listingId || !normPhone || !SAFE_ID_REGEX.test(args.listingId)) {
    return { success: false, error: 'Invalid parameters for claim' };
  }

  // Fetch target listing in current account
  const { data: listing, error: listErr } = await db
    .from('business_listings')
    .select('*')
    .eq('account_id', args.accountId)
    .eq('id', args.listingId)
    .maybeSingle();

  if (listErr || !listing) {
    return { success: false, error: 'Listing not found in account' };
  }

  const bl = listing as BusinessListing;
  if (bl.vendor_profile_id) {
    return { success: false, error: 'Listing is already claimed by another vendor' };
  }

  // Create or resolve vendor profile
  const { data: vendor, error: venErr } = await db
    .from('vendor_profiles')
    .insert({
      account_id: args.accountId,
      contact_id: args.contactId ?? null,
      display_name: args.displayName.trim(),
      phone: normPhone,
      whatsapp_phone: normPhone,
      status: 'active',
      metadata: { claimed_listing_id: bl.id },
    })
    .select('*')
    .maybeSingle();

  if (venErr || !vendor) {
    return { success: false, error: venErr?.message || 'Failed to create vendor profile' };
  }

  const v = vendor as VendorProfile;

  // Associate listing with the vendor
  const { error: updateErr } = await db
    .from('business_listings')
    .update({
      vendor_profile_id: v.id,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', args.accountId)
    .eq('id', bl.id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  return { success: true, vendorProfile: v };
}

/**
 * Updates a business listing with strict vendor ownership validation.
 *
 * Ensures:
 * 1. listing belongs to current account_id.
 * 2. listing belongs to vendor_profile_id.
 * 3. input validation passes.
 */
export async function updateVendorListing(
  db: SupabaseClient | DirectoryDbClient,
  args: {
    accountId: string;
    vendorProfileId: string;
    listingId: string;
    patch: Partial<BusinessListing>;
  },
): Promise<{ success: boolean; updatedListing?: BusinessListing; error?: string }> {
  if (
    !args.accountId ||
    !args.vendorProfileId ||
    !args.listingId ||
    !SAFE_ID_REGEX.test(args.listingId) ||
    !SAFE_ID_REGEX.test(args.vendorProfileId)
  ) {
    return { success: false, error: 'Invalid identification parameters' };
  }

  // Check ownership
  const { data: existing, error: fetchErr } = await db
    .from('business_listings')
    .select('*')
    .eq('account_id', args.accountId)
    .eq('id', args.listingId)
    .eq('vendor_profile_id', args.vendorProfileId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return { success: false, error: 'Unauthorized: Listing does not belong to vendor' };
  }

  // Whitelist safe editable fields
  const safePatch: Partial<BusinessListing> = {};
  if (args.patch.name !== undefined) safePatch.name = args.patch.name.trim();
  if (args.patch.description !== undefined) safePatch.description = args.patch.description?.trim();
  if (args.patch.address !== undefined) safePatch.address = args.patch.address?.trim();
  if (args.patch.area !== undefined) safePatch.area = args.patch.area?.trim();
  if (args.patch.services !== undefined) safePatch.services = args.patch.services;
  if (args.patch.alternate_phone !== undefined) {
    safePatch.alternate_phone = args.patch.alternate_phone
      ? normalizePhone(args.patch.alternate_phone)
      : null;
  }
  if (args.patch.business_hours !== undefined) safePatch.business_hours = args.patch.business_hours;

  const validation = validateListingInput({
    ...(existing as BusinessListing),
    ...safePatch,
  });

  if (!validation.isValid) {
    return { success: false, error: validation.errors.join(', ') };
  }

  const { data: updated, error: updateErr } = await db
    .from('business_listings')
    .update({
      ...safePatch,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', args.accountId)
    .eq('id', args.listingId)
    .eq('vendor_profile_id', args.vendorProfileId)
    .select('*')
    .maybeSingle();

  if (updateErr || !updated) {
    return { success: false, error: updateErr?.message || 'Failed to update listing' };
  }

  return { success: true, updatedListing: updated as BusinessListing };
}

/**
 * Adds a photo to a listing with ownership validation.
 *
 * If isPrimary is true, resets other photos for this listing so only one is primary.
 */
export async function addListingPhotoForVendor(
  db: SupabaseClient | DirectoryDbClient,
  args: {
    accountId: string;
    vendorProfileId: string;
    listingId: string;
    storagePath: string;
    url: string;
    isPrimary?: boolean;
    sortOrder?: number;
    altText?: string;
  },
): Promise<{ success: boolean; photo?: ListingPhoto; error?: string }> {
  if (
    !args.accountId ||
    !args.vendorProfileId ||
    !args.listingId ||
    !SAFE_ID_REGEX.test(args.listingId) ||
    !SAFE_ID_REGEX.test(args.vendorProfileId)
  ) {
    return { success: false, error: 'Invalid parameters' };
  }

  // Check ownership
  const { data: listing, error: listErr } = await db
    .from('business_listings')
    .select('id')
    .eq('account_id', args.accountId)
    .eq('id', args.listingId)
    .eq('vendor_profile_id', args.vendorProfileId)
    .maybeSingle();

  if (listErr || !listing) {
    return { success: false, error: 'Unauthorized: Listing does not belong to vendor' };
  }

  if (args.isPrimary) {
    // Reset existing primary photos for this listing
    await db
      .from('listing_photos')
      .update({ is_primary: false })
      .eq('account_id', args.accountId)
      .eq('listing_id', args.listingId);
  }

  const { data: photo, error: insertErr } = await db
    .from('listing_photos')
    .insert({
      account_id: args.accountId,
      listing_id: args.listingId,
      storage_path: args.storagePath,
      url: args.url,
      is_primary: args.isPrimary ?? false,
      sort_order: args.sortOrder ?? 0,
      alt_text: args.altText ?? null,
    })
    .select('*')
    .maybeSingle();

  if (insertErr || !photo) {
    return { success: false, error: insertErr?.message || 'Failed to add photo' };
  }

  return { success: true, photo: photo as ListingPhoto };
}
