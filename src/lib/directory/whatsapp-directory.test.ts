/**
 * Unit and Regression Tests for Dynamic WhatsApp Directory.
 */

import { describe, expect, it } from 'vitest';
import {
  DIRECTORY_LIMITS,
  buildCategoryListPayload,
  buildListingDetailsActions,
  buildListingListPayload,
  buildWhatsAppPrefilledText,
  buildWhatsAppPrefillUrl,
  formatListingDetailsText,
  formatWhatsAppUrl,
  sanitizeDescription,
  getActiveCategories,
  getActiveListingsByCategory,
  getListingById,
  truncate,
  type DirectoryCategory,
  type DirectoryListing,
} from './whatsapp-directory';

describe('WhatsApp Dynamic Directory — Unit Tests', () => {
  it('truncates strings within limits and handles Telugu text', () => {
    expect(truncate('Short', 24)).toBe('Short');
    expect(truncate('1234567890123456789012345', 24)).toBe('12345678901234567890123…');
    expect(truncate('ఇంజనీరింగ్ & వెల్డింగ్ వర్క్స్ అండ్ సప్లైస్', 24).length).toBeLessThanOrEqual(24);
  });

  it('formats wa.me click-to-chat URLs with country code', () => {
    expect(formatWhatsAppUrl('9441348175')).toBe('https://wa.me/919441348175');
    expect(formatWhatsAppUrl('+919441348175')).toBe('https://wa.me/919441348175');
    expect(formatWhatsAppUrl('invalid')).toBe('');
  });

  it('builds paginated category list payload with Meta constraints (<= 10 rows)', () => {
    const mockCategories: DirectoryCategory[] = Array.from({ length: 16 }, (_, i) => ({
      id: `cat-${i + 1}`,
      slug: `cat-slug-${i + 1}`,
      name_en: `Category ${i + 1}`,
      name_te: `కేటగిరీ ${i + 1}`,
      display_order: i + 1,
    }));

    // Page 1: 8 categories + More + Back = 10 rows total
    const page1 = buildCategoryListPayload({ categories: mockCategories, page: 1, perPage: 8 });
    expect(page1.sections[0].rows.length).toBeLessThanOrEqual(10);
    expect(page1.hasMore).toBe(true);
    expect(page1.hasPrev).toBe(false);
    expect(page1.totalPages).toBe(2);
    expect(page1.sections[0].rows.some((r) => r.id === 'dir_catpage_2')).toBe(true);
    expect(page1.sections[0].rows.some((r) => r.id === 'dir_back_biz_menu')).toBe(true);

    // Page 2: 8 categories + Previous + Back = 10 rows total
    const page2 = buildCategoryListPayload({ categories: mockCategories, page: 2, perPage: 8 });
    expect(page2.sections[0].rows.length).toBeLessThanOrEqual(10);
    expect(page2.hasMore).toBe(false);
    expect(page2.hasPrev).toBe(true);
    expect(page2.sections[0].rows.some((r) => r.id === 'dir_catpage_1')).toBe(true);
  });

  it('builds paginated listing list payload and honors empty category', () => {
    // Empty case
    const emptyPayload = buildListingListPayload({
      categoryName: 'Empty Cat',
      categorySlug: 'empty-cat',
      listings: [],
      page: 1,
    });
    expect(emptyPayload.bodyText).toContain('ఈ విభాగంలో ప్రస్తుతం యాక్టివ్ షాపులు అందుబాటులో లేవు');
    expect(emptyPayload.sections[0].rows.some((r) => r.id === 'dir_browse')).toBe(true);

    // Populated case (15 listings)
    const mockListings: DirectoryListing[] = Array.from({ length: 15 }, (_, i) => ({
      id: `uuid-${i + 1}`,
      name: `Shop ${i + 1}`,
      category_slug: 'automobile',
      phone: `988500000${i}`,
      whatsapp_phone: `988500000${i}`,
      city: 'Choutuppal',
      services: [],
      business_hours: {},
      status: 'active',
      is_verified: i % 2 === 0,
      is_premium: i === 0,
      metadata: {
        listing_id: `CPL-BIZ-${String(i + 1).padStart(3, '0')}`,
        priority: 10 - i,
        display_order: i + 1,
      },
    }));

    const page1 = buildListingListPayload({
      categoryName: 'Automobile',
      categorySlug: 'automobile',
      listings: mockListings,
      page: 1,
      perPage: 8,
    });

    expect(page1.sections[0].rows.length).toBeLessThanOrEqual(10);
    expect(page1.hasMore).toBe(true);
    expect(page1.sections[0].rows.some((r) => r.id === 'dir_listpage_automobile_2')).toBe(true);
    expect(page1.sections[0].rows.some((r) => r.id === 'dir_item_CPL-BIZ-001')).toBe(true);
  });

  it('sanitizes synthetic contact suffixes from description without destroying meaningful content', () => {
    // 1. Synthetic suffix from CSV import
    expect(
      sanitizeDescription('S.S. ఆటో ఎలక్ట్రికల్ వర్క్స్ - Automobile in Choutuppal. Contact: 9885374861'),
    ).toBe('S.S. ఆటో ఎలక్ట్రికల్ వర్క్స్ - Automobile in Choutuppal');

    // 2. Trailing Contact without period
    expect(
      sanitizeDescription('Automobile electrical service in Choutuppal Contact: 9885374861'),
    ).toBe('Automobile electrical service in Choutuppal');

    // 3. Meaningful description without contact suffix
    expect(
      sanitizeDescription('చౌటుప్పల్లో ఆటోమొబైల్ ఎలక్ట్రికల్ మరియు మెకానిక్ సేవలు.'),
    ).toBe('చౌటుప్పల్లో ఆటోమొబైల్ ఎలక్ట్రికల్ మరియు మెకానిక్ సేవలు.');

    // 4. Genuine numbers preserved (24/7, Plot 42)
    expect(
      sanitizeDescription('24/7 అత్యవసర సేవలు అందుబాటులో ఉన్నాయి. Contact: 9885374861'),
    ).toBe('24/7 అత్యవసర సేవలు అందుబాటులో ఉన్నాయి');

    // 5. Empty / null / undefined handled cleanly
    expect(sanitizeDescription(null)).toBe('');
    expect(sanitizeDescription(undefined)).toBe('');
    expect(sanitizeDescription('')).toBe('');
  });

  it('formats business name with bold + italic and concise description', () => {
    const listing: DirectoryListing = {
      id: 'uuid-test',
      name: 'లక్ష్మి గణపతి ఇంజనీరింగ్ వర్క్స్',
      category_slug: 'engineering-welding',
      phone: '9701601613',
      whatsapp_phone: '9701601613',
      address: 'గాంధీ చౌక్, చౌటుప్పల్',
      city: 'Choutuppal',
      description: 'లక్ష్మి గణపతి ఇంజనీరింగ్ వర్క్స్ - Engineering in Choutuppal. Contact: 9701601613',
      services: ['ఆర్క్ వెల్డింగ్', 'షట్టర్ తయారీ'],
      business_hours: { raw: '9 AM - 8 PM' },
      status: 'active',
      is_verified: true,
      is_premium: true,
      metadata: {
        listing_id: 'CPL-BIZ-134',
        category: 'Engineering & Welding',
        category_te: 'ఇంజనీరింగ్ & వెల్డింగ్',
        subcategory: 'Welding',
        subcategory_te: 'వెల్డింగ్',
        maps_url: 'https://maps.google.com/?q=17.25,78.95',
      },
    };

    const details = formatListingDetailsText(listing);

    // 1. Business name: bold + italic
    expect(details).toContain('🏪 *_లక్ష్మి గణపతి ఇంజనీరింగ్ వర్క్స్_*');

    // 2. Concise description rendered
    expect(details).toContain('📝 లక్ష్మి గణపతి ఇంజనీరింగ్ వర్క్స్ - Engineering in Choutuppal');

    // 3. Category and Subcategory absence
    expect(details).not.toContain('Category:');
    expect(details).not.toContain('Subcategory:');
    expect(details).not.toContain('ఇంజనీరింగ్ & వెల్డింగ్');
    expect(details).not.toContain('Engineering & Welding');

    // 4. Contact phone number directly rendered in card for tap-to-call
    expect(details).toContain('📞 *ఫోన్:* +91 97016 01613');

    // 5. Raw wa.me URL absence in visible details
    expect(details).not.toContain('wa.me');

    // 6. Synthetic contact suffix removal without damaging legitimate text
    expect(details).not.toContain('Contact: 9701601613');

    // 7. Services section deferred in simplified Phase 3 flow
    expect(details).not.toContain('*Services*');

    // 8. Address shown only when available
    expect(details).toContain('📍 *చిరునామా:*\nగాంధీ చౌక్, చౌటుప్పల్');

    // Defensive check
    expect(details).not.toContain('undefined');
    expect(details).not.toContain('null');
  });

  it('renders direct phone number cleanly and suppresses when absent', () => {
    const listingNoPhone: DirectoryListing = {
      id: 'uuid-nophone',
      name: 'రహీమ్ వెల్డింగ్ వర్క్స్',
      category_slug: 'engineering-welding',
      phone: '',
      whatsapp_phone: '',
      city: 'Choutuppal',
      services: [],
      business_hours: {},
      status: 'active',
      is_verified: false,
      is_premium: false,
      metadata: { listing_id: 'CPL-BIZ-048' },
    };

    const detailsNoPhone = formatListingDetailsText(listingNoPhone);
    expect(detailsNoPhone).not.toContain('📞 *ఫోన్:*');

    const listingWithPhone: DirectoryListing = {
      ...listingNoPhone,
      phone: '9640201084',
    };
    const detailsWithPhone = formatListingDetailsText(listingWithPhone);
    expect(detailsWithPhone).toContain('📞 *ఫోన్:* +91 96402 01084');
  });

  it('shows address only when available and suppresses when empty', () => {
    const listingNoAddr: DirectoryListing = {
      id: 'uuid-noaddr',
      name: 'లక్ష్మి స్టోర్స్',
      category_slug: 'services',
      phone: '9885374861',
      whatsapp_phone: '9885374861',
      address: null,
      area: null,
      city: 'Choutuppal',
      services: [],
      business_hours: {},
      status: 'active',
      is_verified: false,
      is_premium: false,
      metadata: { listing_id: 'CPL-BIZ-001' },
    };

    const detailsNoAddr = formatListingDetailsText(listingNoAddr);
    expect(detailsNoAddr).not.toContain('చిరునామా');
    expect(detailsNoAddr).not.toContain('📍');

    const listingWithArea: DirectoryListing = {
      ...listingNoAddr,
      area: 'హైవే జంక్షన్, చౌటుప్పల్',
    };
    const detailsWithArea = formatListingDetailsText(listingWithArea);
    expect(detailsWithArea).toContain('📍 *చిరునామా:*\nహైవే జంక్షన్, చౌటుప్పల్');
  });

  it('builds WhatsApp prefilled Telugu message with Choutuppal App branding and genuine services', () => {
    const listing: DirectoryListing = {
      id: 'uuid-wa',
      name: 'లక్ష్మి గణపతి ఇంజనీరింగ్ వర్క్స్',
      category_slug: 'engineering-welding',
      phone: '9701601613',
      whatsapp_phone: '9701601613',
      description: 'లక్ష్మి గణపతి ఇంజనీరింగ్ వర్క్స్ - Engineering in Choutuppal. Contact: 9701601613',
      services: ['ఆర్క్ వెల్డింగ్', 'షట్టర్ తయారీ'],
      city: 'Choutuppal',
      business_hours: {},
      status: 'active',
      is_verified: true,
      is_premium: false,
      metadata: { listing_id: 'CPL-BIZ-134' },
    };

    const prefillText = buildWhatsAppPrefilledText(listing);

    // 10. WhatsApp prefilled text generated for the correct business
    expect(prefillText).toContain('🏪 వ్యాపారం: లక్ష్మి గణపతి ఇంజనీరింగ్ వర్క్స్');
    expect(prefillText).toContain('📝 వివరాలు: లక్ష్మి గణపతి ఇంజనీరింగ్ వర్క్స్ - Engineering in Choutuppal');
    expect(prefillText).toContain('• ఆర్క్ వెల్డింగ్');
    expect(prefillText).toContain('• షట్టర్ తయారీ');
    expect(prefillText).toContain('దయచేసి మీ సేవల వివరాలు తెలియజేయగలరు.');
    // Choutuppal branding
    expect(prefillText).toContain('🌐 Choutuppal App — మన చౌటుప్పల్, మన వ్యాపారాలు.');

    // 11. Telugu text and URL encoding handled correctly
    const prefillUrl = buildWhatsAppPrefillUrl(listing);
    expect(prefillUrl).toContain('https://wa.me/919701601613?text=');
    expect(prefillUrl).toContain(encodeURIComponent('🏪 వ్యాపారం: లక్ష్మి గణపతి ఇంజనీరింగ్ వర్క్స్'));
  });

  it('builds listing details navigation with simplified buttons (Next Shops, Back, Categories)', () => {
    const listing: DirectoryListing = {
      id: 'uuid-1',
      name: 'Test Shop',
      category_slug: 'automobile',
      phone: '9885374861',
      whatsapp_phone: '9885374861',
      city: 'Choutuppal',
      services: [],
      business_hours: {},
      status: 'active',
      is_verified: false,
      is_premium: false,
      metadata: { listing_id: 'CPL-BIZ-001' },
    };

    const actions = buildListingDetailsActions({
      listing,
      categorySlug: 'automobile',
      listingPage: 2,
    });

    // Exactly 3 reply buttons: [తర్వాతి షాపులు ➡️], [🔙 వెనుకకు], [📁 కేటగిరీలు]
    expect(actions.buttons.length).toBe(3);
    expect(actions.buttons[0]).toEqual({ id: 'dir_listpage_automobile_3', title: 'తర్వాతి షాపులు ➡️' });
    expect(actions.buttons[1]).toEqual({ id: 'dir_listpage_automobile_2', title: '🔙 వెనుకకు' });
    expect(actions.buttons[2]).toEqual({ id: 'dir_browse', title: '📁 కేటగిరీలు' });

    for (const btn of actions.buttons) {
      expect(btn.title.length).toBeLessThanOrEqual(20);
    }
    expect(actions.bodyText.length).toBeLessThanOrEqual(1024);

    // List fallback rows
    expect(actions.sections[0].rows.length).toBe(3);
    expect(actions.sections[0].rows[0].id).toBe('dir_listpage_automobile_3');
    expect(actions.sections[0].rows[1].id).toBe('dir_listpage_automobile_2');
    expect(actions.sections[0].rows[2].id).toBe('dir_browse');
  });

  it('handles uncategorized category by providing dir_browse for navigation', () => {
    const listing: DirectoryListing = {
      id: 'uuid-uncat',
      name: 'Uncategorized Shop',
      category_slug: null,
      phone: '9885374861',
      whatsapp_phone: '9885374861',
      city: 'Choutuppal',
      services: [],
      business_hours: {},
      status: 'active',
      is_verified: false,
      is_premium: false,
      metadata: { listing_id: 'CPL-BIZ-099' },
    };

    const actions = buildListingDetailsActions({
      listing,
      categorySlug: 'uncategorized',
      listingPage: 1,
    });

    expect(actions.buttons.length).toBe(3);
    expect(actions.buttons[0]).toEqual({ id: 'dir_browse', title: 'తర్వాతి షాపులు ➡️' });
    expect(actions.buttons[1]).toEqual({ id: 'dir_browse', title: '🔙 వెనుకకు' });
    expect(actions.buttons[2]).toEqual({ id: 'dir_browse', title: '📁 కేటగిరీలు' });
  });

  it('queries database with status = published filter and excludes pending records', async () => {
    // Mock db client
    const mockDb = {
      from: (table: string) => ({
        select: () => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              eq: (col3: string, val3: any) => {
                if (col2 === 'status' && val2 === 'published') {
                  return { data: [{ id: '1', name: 'Published Listing', status: 'published', is_premium: false, is_verified: false, metadata: { listing_id: 'CPL-BIZ-001' } }], error: null };
                }
                return { data: [], error: null };
              },
            }),
          }),
        }),
      }),
    };

    const listings = await getActiveListingsByCategory(mockDb, 'acc-1', 'automobile');
    expect(listings.length).toBe(1);
    expect(listings[0].name).toBe('Published Listing');
  });

  describe('getListingById — Security & Status Access Control', () => {
    function createMockDb(records: Array<{
      id: string;
      slug: string;
      name: string;
      status: string;
      account_id: string;
      metadata: Record<string, unknown>;
    }>) {
      return {
        from: (table: string) => {
          if (table !== 'business_listings') {
            return { select: () => ({ error: 'Unknown table' }) };
          }
          return {
            select: () => {
              let filterAcc: string | null = null;
              let filterStatus: string | null = null;
              let filterMetaId: string | null = null;
              let filterSlug: string | null = null;

              const builder = {
                eq: (col: string, val: any) => {
                  if (col === 'account_id') filterAcc = String(val);
                  if (col === 'slug') filterSlug = String(val);
                  if (col === 'status') filterStatus = String(val);
                  return builder;
                },
                filter: (col: string, op: string, val: any) => {
                  if (col === 'metadata->>listing_id' && op === 'eq') {
                    filterMetaId = String(val);
                  }
                  return builder;
                },
                maybeSingle: async () => {
                  const match = records.find((r) => {
                    if (filterAcc && r.account_id !== filterAcc) return false;
                    if (filterStatus && r.status !== filterStatus) return false;
                    if (filterMetaId && r.metadata?.listing_id !== filterMetaId) return false;
                    if (filterSlug && r.slug !== filterSlug) return false;
                    return true;
                  });
                  return { data: match || null, error: null };
                },
              };
              return builder;
            },
          };
        },
      };
    }

    const testRecords = [
      {
        id: 'rec-pub',
        slug: 'sri-sai-electricals',
        name: 'Sri Sai Electricals',
        status: 'published',
        account_id: 'acc-1',
        metadata: { listing_id: 'CPL-BIZ-001' },
      },
      {
        id: 'rec-act',
        slug: 'active-kirana-store',
        name: 'Active Kirana Store',
        status: 'active',
        account_id: 'acc-1',
        metadata: { listing_id: 'CPL-BIZ-002' },
      },
      {
        id: 'rec-pen',
        slug: 'pending-auto-works',
        name: 'Pending Auto Works',
        status: 'pending',
        account_id: 'acc-1',
        metadata: { listing_id: 'CPL-BIZ-003' },
      },
      {
        id: 'rec-dft',
        slug: 'draft-sweet-house',
        name: 'Draft Sweet House',
        status: 'draft',
        account_id: 'acc-1',
        metadata: { listing_id: 'CPL-BIZ-004' },
      },
      {
        id: 'rec-sus',
        slug: 'suspended-medical-hall',
        name: 'Suspended Medical Hall',
        status: 'suspended',
        account_id: 'acc-1',
        metadata: { listing_id: 'CPL-BIZ-005' },
      },
      {
        id: 'rec-arc',
        slug: 'archived-cloth-store',
        name: 'Archived Cloth Store',
        status: 'archived',
        account_id: 'acc-1',
        metadata: { listing_id: 'CPL-BIZ-006' },
      },
    ];

    it('allows access to published listings by listing_id and by slug', async () => {
      const mockDb = createMockDb(testRecords);
      // By metadata listing_id
      const resById = await getListingById(mockDb, 'acc-1', 'CPL-BIZ-001');
      expect(resById).not.toBeNull();
      expect(resById?.name).toBe('Sri Sai Electricals');
      expect(resById?.status).toBe('published');

      // By slug fallback
      const resBySlug = await getListingById(mockDb, 'acc-1', 'sri-sai-electricals');
      expect(resBySlug).not.toBeNull();
      expect(resBySlug?.name).toBe('Sri Sai Electricals');
    });

    it('blocks active listings because canonical business_listings publication status is published', async () => {
      const mockDb = createMockDb(testRecords);
      const resById = await getListingById(mockDb, 'acc-1', 'CPL-BIZ-002');
      expect(resById).toBeNull();
      const resBySlug = await getListingById(mockDb, 'acc-1', 'active-kirana-store');
      expect(resBySlug).toBeNull();
    });

    it('blocks pending listings from direct ID lookup', async () => {
      const mockDb = createMockDb(testRecords);
      const resById = await getListingById(mockDb, 'acc-1', 'CPL-BIZ-003');
      expect(resById).toBeNull();
      const resBySlug = await getListingById(mockDb, 'acc-1', 'pending-auto-works');
      expect(resBySlug).toBeNull();
    });

    it('blocks draft listings from direct ID lookup', async () => {
      const mockDb = createMockDb(testRecords);
      const resById = await getListingById(mockDb, 'acc-1', 'CPL-BIZ-004');
      expect(resById).toBeNull();
      const resBySlug = await getListingById(mockDb, 'acc-1', 'draft-sweet-house');
      expect(resBySlug).toBeNull();
    });

    it('blocks suspended listings from direct ID lookup', async () => {
      const mockDb = createMockDb(testRecords);
      const resById = await getListingById(mockDb, 'acc-1', 'CPL-BIZ-005');
      expect(resById).toBeNull();
      const resBySlug = await getListingById(mockDb, 'acc-1', 'suspended-medical-hall');
      expect(resBySlug).toBeNull();
    });

    it('blocks archived listings from direct ID lookup', async () => {
      const mockDb = createMockDb(testRecords);
      const resById = await getListingById(mockDb, 'acc-1', 'CPL-BIZ-006');
      expect(resById).toBeNull();
      const resBySlug = await getListingById(mockDb, 'acc-1', 'archived-cloth-store');
      expect(resBySlug).toBeNull();
    });

    it('enforces account isolation so another account cannot view published listings', async () => {
      const mockDb = createMockDb(testRecords);
      const res = await getListingById(mockDb, 'wrong-account', 'CPL-BIZ-001');
      expect(res).toBeNull();
    });
  });
});
