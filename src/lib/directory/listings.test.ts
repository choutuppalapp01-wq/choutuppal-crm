import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateListingInput,
  toPublicBusinessListing,
  getBusinessListingById,
  getPublicListingBySlug,
  findOrCreateVendorProfile,
} from './listings';
import type { BusinessListing, ListingPhoto } from './types';

const MOCK_LISTING: BusinessListing = {
  id: 'biz-1',
  account_id: 'acc-1',
  vendor_profile_id: 'vendor-1',
  category_id: 'cat-1',
  category_slug: 'electrical',
  name: 'Sri Sai Electricals',
  slug: 'sri-sai-electricals',
  description: 'All electrical wiring and repairs in Choutuppal',
  phone: '+919441348175',
  whatsapp_phone: '9441348175',
  alternate_phone: null,
  email: 'contact@srisaielectricals.com',
  address: 'Shop No. 4, Main Road',
  area: 'Bus Stand Area',
  city: 'Choutuppal',
  state: 'Telangana',
  pincode: '508252',
  latitude: 17.25,
  longitude: 78.9,
  website: 'https://srisaielectricals.com',
  services: ['Wiring', 'Repairs', 'Inverter Fitting'],
  business_hours: { mon: '09:00 - 21:00', sun: 'Closed' },
  status: 'published',
  is_verified: true,
  is_premium: false,
  metadata: { internal_notes: 'Verified by field visit' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_PHOTOS: ListingPhoto[] = [
  {
    id: 'photo-1',
    account_id: 'acc-1',
    listing_id: 'biz-1',
    storage_path: 'listings/biz-1/storefront.jpg',
    url: 'https://cdn.test/listings/biz-1/storefront.jpg',
    sort_order: 1,
    is_primary: true,
    alt_text: 'Storefront',
    created_at: new Date().toISOString(),
  },
  {
    id: 'photo-2',
    account_id: 'acc-1',
    listing_id: 'biz-1',
    storage_path: 'listings/biz-1/work.jpg',
    url: 'https://cdn.test/listings/biz-1/work.jpg',
    sort_order: 2,
    is_primary: false,
    alt_text: 'Electrical works sample',
    created_at: new Date().toISOString(),
  },
];

describe('Directory Foundation — validateListingInput', () => {
  it('passes on valid business listing input', () => {
    const res = validateListingInput({
      name: 'Choutuppal Pharmacy',
      slug: 'choutuppal-pharmacy',
      phone: '9494348175',
      whatsapp_phone: '9494348175',
      status: 'draft',
    });
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('rejects missing required fields', () => {
    const res = validateListingInput({});
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain('Business name is required');
    expect(res.errors).toContain('Valid business phone number is required');
    expect(res.errors).toContain('Valid WhatsApp phone number is required');
  });

  it('rejects invalid or unsafe slug formats', () => {
    const res = validateListingInput({
      name: 'Test',
      slug: 'Invalid Slug with Spaces!',
      phone: '9441348175',
      whatsapp_phone: '9441348175',
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.includes('Slug must be lowercase alphanumeric'))).toBe(true);
  });

  it('rejects unknown status lifecycle values', () => {
    const res = validateListingInput({
      name: 'Test',
      slug: 'valid-slug',
      phone: '9441348175',
      whatsapp_phone: '9441348175',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: 'unknown_status' as any,
    });
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain('Invalid status: unknown_status');
  });
});

describe('Directory Foundation — toPublicBusinessListing', () => {
  it('strips internal account_id, vendor_profile_id, and metadata', () => {
    const publicView = toPublicBusinessListing(MOCK_LISTING, MOCK_PHOTOS);

    expect(publicView.id).toBe('biz-1');
    expect(publicView.name).toBe('Sri Sai Electricals');
    expect(publicView.slug).toBe('sri-sai-electricals');
    // Ensure sensitive internal fields are omitted
    expect((publicView as unknown as Record<string, unknown>).account_id).toBeUndefined();
    expect((publicView as unknown as Record<string, unknown>).vendor_profile_id).toBeUndefined();
    expect((publicView as unknown as Record<string, unknown>).metadata).toBeUndefined();

    // Check photos projection and order
    expect(publicView.photos).toHaveLength(2);
    expect(publicView.photos[0].is_primary).toBe(true);
    expect(publicView.photos[0].url).toBe('https://cdn.test/listings/biz-1/storefront.jpg');
    expect((publicView.photos[0] as unknown as Record<string, unknown>).storage_path).toBeUndefined();
  });
});

describe('Directory Foundation — Account Scoped Lookups', () => {
  const fakeDb = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves listing by ID when account matches', async () => {
    fakeDb.from.mockReturnValue({
      select: () => ({
        eq: (_col1: string, val1: string) => ({
          eq: (_col2: string, val2: string) => ({
            maybeSingle: async () => {
              if (val1 === 'acc-1' && val2 === 'biz-1') {
                return { data: MOCK_LISTING, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      }),
    });

    const listing = await getBusinessListingById(fakeDb, 'acc-1', 'biz-1');
    expect(listing).not.toBeNull();
    expect(listing?.name).toBe('Sri Sai Electricals');
  });

  it('blocks cross-account listing access', async () => {
    fakeDb.from.mockReturnValue({
      select: () => ({
        eq: (_col1: string, val1: string) => ({
          eq: (_col2: string, val2: string) => ({
            maybeSingle: async () => {
              if (val1 === 'acc-1' && val2 === 'biz-1') {
                return { data: MOCK_LISTING, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      }),
    });

    // Account B trying to access Account A listing
    const listing = await getBusinessListingById(fakeDb, 'acc-2', 'biz-1');
    expect(listing).toBeNull();
  });

  it('rejects malicious listing IDs before DB call', async () => {
    const listing = await getBusinessListingById(
      fakeDb,
      'acc-1',
      "<script>alert('xss')</script>",
    );
    expect(listing).toBeNull();
    expect(fakeDb.from).not.toHaveBeenCalled();
  });
});

describe('Directory Foundation — Public Listing Resolution', () => {
  const fakeDb = {
    from: vi.fn(),
  };

  it('returns published listing by slug with its photos', async () => {
    fakeDb.from.mockImplementation((table: string) => {
      if (table === 'business_listings') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: MOCK_LISTING, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'listing_photos') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: MOCK_PHOTOS, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const publicListing = await getPublicListingBySlug(fakeDb, 'sri-sai-electricals');
    expect(publicListing).not.toBeNull();
    expect(publicListing?.name).toBe('Sri Sai Electricals');
    expect(publicListing?.photos).toHaveLength(2);
  });

  it('returns null for unpublished or draft listings', async () => {
    fakeDb.from.mockImplementation((table: string) => {
      if (table === 'business_listings') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await getPublicListingBySlug(fakeDb, 'draft-store');
    expect(res).toBeNull();
  });
});

describe('Directory Foundation — Vendor Profile Creation & Relationship', () => {
  const fakeDb = {
    from: vi.fn(),
  };

  it('finds existing vendor by normalized phone number', async () => {
    const existingVendor = {
      id: 'vendor-1',
      account_id: 'acc-1',
      display_name: 'Ramu',
      phone: '9441348175',
      whatsapp_phone: '9441348175',
      status: 'active',
      metadata: {},
    };

    fakeDb.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: existingVendor, error: null }),
          }),
        }),
      }),
    });

    const vendor = await findOrCreateVendorProfile(fakeDb, {
      accountId: 'acc-1',
      phone: '+91 94413-48175',
      displayName: 'Ramu',
    });

    expect(vendor).not.toBeNull();
    expect(vendor?.id).toBe('vendor-1');
  });

  it('creates new vendor profile if not found', async () => {
    fakeDb.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      insert: (payload: Record<string, unknown>) => ({
        select: () => ({
          maybeSingle: async () => ({
            data: { id: 'vendor-new', ...payload },
            error: null,
          }),
        }),
      }),
    });

    const vendor = await findOrCreateVendorProfile(fakeDb, {
      accountId: 'acc-1',
      phone: '9848012345',
      displayName: 'Krishna Rao',
    });

    expect(vendor).not.toBeNull();
    expect(vendor?.id).toBe('vendor-new');
    expect(vendor?.phone).toBe('9848012345');
    expect(vendor?.display_name).toBe('Krishna Rao');
  });
});
