import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  identifyVendorByPhone,
  claimBusinessListing,
  updateVendorListing,
  addListingPhotoForVendor,
} from './vendor-service';
import type { BusinessListing, VendorProfile } from './types';

const MOCK_VENDOR: VendorProfile = {
  id: 'vendor-1',
  account_id: 'acc-1',
  contact_id: 'contact-1',
  display_name: 'Sri Sai Traders Owner',
  phone: '919441348175',
  whatsapp_phone: '919441348175',
  email: 'vendor@test.com',
  status: 'active',
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_LISTING: BusinessListing = {
  id: 'biz-1',
  account_id: 'acc-1',
  vendor_profile_id: 'vendor-1',
  category_id: 'cat-1',
  category_slug: 'electrical',
  name: 'Sri Sai Traders',
  slug: 'sri-sai-traders',
  description: 'Electrical appliances and repairs',
  phone: '+919441348175',
  whatsapp_phone: '919441348175',
  alternate_phone: null,
  email: 'contact@srisai.com',
  address: 'Main Road',
  area: 'Choutuppal Center',
  city: 'Choutuppal',
  state: 'Telangana',
  pincode: '508252',
  latitude: 17.25,
  longitude: 78.9,
  website: null,
  services: ['Repairs', 'Sales'],
  business_hours: { mon: '09:00 - 21:00' },
  status: 'published',
  is_verified: true,
  is_premium: false,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_UNCLAIMED_LISTING: BusinessListing = {
  ...MOCK_LISTING,
  id: 'biz-unclaimed-1',
  vendor_profile_id: null,
  name: 'Unclaimed Kirana Shop',
  slug: 'unclaimed-kirana-shop',
  phone: '919888877777',
  whatsapp_phone: '919888877777',
};

describe('Vendor Self-Service — identifyVendorByPhone', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      from: vi.fn(),
    };
  });

  it('identifies an existing vendor profile and fetches their listings', async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === 'vendor_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_VENDOR, error: null }),
        };
      }
      if (table === 'business_listings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [MOCK_LISTING], error: null }),
        };
      }
      return {};
    });

    const res = await identifyVendorByPhone(mockDb, 'acc-1', '9441348175');
    expect(res.isVendor).toBe(true);
    expect(res.vendorProfile?.id).toBe('vendor-1');
    expect(res.listings).toHaveLength(1);
    expect(res.listings[0].id).toBe('biz-1');
    expect(res.unclaimedListing).toBeNull();
  });

  it('identifies an unclaimed listing when vendor profile does not exist', async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === 'vendor_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'business_listings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_UNCLAIMED_LISTING, error: null }),
        };
      }
      return {};
    });

    const res = await identifyVendorByPhone(mockDb, 'acc-1', '9888877777');
    expect(res.isVendor).toBe(false);
    expect(res.vendorProfile).toBeNull();
    expect(res.listings).toHaveLength(0);
    expect(res.unclaimedListing?.id).toBe('biz-unclaimed-1');
  });

  it('returns false/null when phone does not match any vendor or listing', async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === 'vendor_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'business_listings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {};
    });

    const res = await identifyVendorByPhone(mockDb, 'acc-1', '9111122222');
    expect(res.isVendor).toBe(false);
    expect(res.vendorProfile).toBeNull();
    expect(res.listings).toHaveLength(0);
    expect(res.unclaimedListing).toBeNull();
  });

  it('enforces account isolation in query', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eqCalls: [string, any][] = [];
    mockDb.from.mockImplementation(() => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((col, val) => {
          eqCalls.push([col, val]);
          return {
            or: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            is: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
          };
        }),
      };
    });

    await identifyVendorByPhone(mockDb, 'acc-tenant-99', '9441348175');
    expect(eqCalls.some(([col, val]) => col === 'account_id' && val === 'acc-tenant-99')).toBe(true);
  });
});

describe('Vendor Self-Service — claimBusinessListing', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      from: vi.fn(),
    };
  });

  it('successfully claims an unclaimed listing and links vendor profile', async () => {
    const newVendor: VendorProfile = {
      ...MOCK_VENDOR,
      id: 'vendor-new-1',
      display_name: 'Choutuppal Owner',
    };

    mockDb.from.mockImplementation((table: string) => {
      if (table === 'business_listings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_UNCLAIMED_LISTING, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (table === 'vendor_profiles') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: newVendor, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await claimBusinessListing(mockDb, {
      accountId: 'acc-1',
      listingId: 'biz-unclaimed-1',
      phone: '9888877777',
      displayName: 'Choutuppal Owner',
    });

    expect(res.success).toBe(true);
    expect(res.vendorProfile?.id).toBe('vendor-new-1');
  });

  it('rejects claim if listing is already claimed by another vendor', async () => {
    mockDb.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_LISTING, error: null }), // MOCK_LISTING has vendor_profile_id: 'vendor-1'
    }));

    const res = await claimBusinessListing(mockDb, {
      accountId: 'acc-1',
      listingId: 'biz-1',
      phone: '9888877777',
      displayName: 'Intruder',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('already claimed');
  });

  it('rejects claim for cross-account listing or nonexistent listing', async () => {
    mockDb.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const res = await claimBusinessListing(mockDb, {
      accountId: 'acc-other',
      listingId: 'biz-1',
      phone: '9888877777',
      displayName: 'Owner',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Listing not found');
  });

  it('rejects invalid parameters', async () => {
    const res = await claimBusinessListing(mockDb, {
      accountId: '',
      listingId: 'bad id with spaces!!!',
      phone: '',
      displayName: 'Owner',
    });
    expect(res.success).toBe(false);
  });
});

describe('Vendor Self-Service — updateVendorListing', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      from: vi.fn(),
    };
  });

  it('successfully updates whitelisted fields when vendor owns listing', async () => {
    const updated = {
      ...MOCK_LISTING,
      address: 'Near New Bus Stand, Choutuppal',
      services: ['Wiring', 'Repairs', 'Solar Panel Service'],
    };

    mockDb.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_LISTING, error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: updated, error: null }),
              }),
            }),
          }),
        }),
      }),
    }));

    const res = await updateVendorListing(mockDb, {
      accountId: 'acc-1',
      vendorProfileId: 'vendor-1',
      listingId: 'biz-1',
      patch: {
        address: 'Near New Bus Stand, Choutuppal',
        services: ['Wiring', 'Repairs', 'Solar Panel Service'],
      },
    });

    expect(res.success).toBe(true);
    expect(res.updatedListing?.address).toBe('Near New Bus Stand, Choutuppal');
    expect(res.updatedListing?.services).toContain('Solar Panel Service');
  });

  it('rejects update when listing does not belong to the calling vendor', async () => {
    mockDb.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const res = await updateVendorListing(mockDb, {
      accountId: 'acc-1',
      vendorProfileId: 'vendor-unauthorized',
      listingId: 'biz-1',
      patch: { address: 'Hacked Address' },
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Unauthorized');
  });

  it('validates patched listing values and rejects invalid input', async () => {
    mockDb.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_LISTING, error: null }),
    }));

    const res = await updateVendorListing(mockDb, {
      accountId: 'acc-1',
      vendorProfileId: 'vendor-1',
      listingId: 'biz-1',
      patch: { name: '' }, // empty name invalidates listing
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Business name is required');
  });
});

describe('Vendor Self-Service — addListingPhotoForVendor', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      from: vi.fn(),
    };
  });

  it('adds photo to listing and resets primary flag if isPrimary=true', async () => {
    let resetCalled = false;
    const insertedPhoto = {
      id: 'photo-new-1',
      account_id: 'acc-1',
      listing_id: 'biz-1',
      storage_path: 'listings/biz-1/new.jpg',
      url: 'https://cdn.test/listings/biz-1/new.jpg',
      is_primary: true,
      sort_order: 1,
      alt_text: 'Storefront front view',
      created_at: new Date().toISOString(),
    };

    mockDb.from.mockImplementation((table: string) => {
      if (table === 'business_listings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'biz-1' }, error: null }),
        };
      }
      if (table === 'listing_photos') {
        return {
          update: vi.fn(() => {
            resetCalled = true;
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: insertedPhoto, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await addListingPhotoForVendor(mockDb, {
      accountId: 'acc-1',
      vendorProfileId: 'vendor-1',
      listingId: 'biz-1',
      storagePath: 'listings/biz-1/new.jpg',
      url: 'https://cdn.test/listings/biz-1/new.jpg',
      isPrimary: true,
      sortOrder: 1,
      altText: 'Storefront front view',
    });

    expect(res.success).toBe(true);
    expect(res.photo?.id).toBe('photo-new-1');
    expect(resetCalled).toBe(true);
  });

  it('rejects photo upload if listing does not belong to vendor', async () => {
    mockDb.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const res = await addListingPhotoForVendor(mockDb, {
      accountId: 'acc-1',
      vendorProfileId: 'vendor-attacker',
      listingId: 'biz-1',
      storagePath: 'listings/biz-1/hack.jpg',
      url: 'https://cdn.test/listings/biz-1/hack.jpg',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Unauthorized');
  });
});
