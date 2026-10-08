/**
 * Unit and Regression Tests for Dynamic WhatsApp Directory.
 */

import { describe, expect, it } from 'vitest';
import {
  DIRECTORY_LIMITS,
  buildCategoryListPayload,
  buildListingDetailsActions,
  buildListingListPayload,
  formatListingDetailsText,
  formatWhatsAppUrl,
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

  it('formats business details cleanly without null, undefined, or empty labels', () => {
    const listing: DirectoryListing = {
      id: 'uuid-test',
      name: 'లక్ష్మి గణపతి ఇంజనీరింగ్ వర్క్స్',
      category_slug: 'engineering-welding',
      phone: '9701601613',
      whatsapp_phone: '9701601613',
      address: 'గాంధీ చౌక్, చౌటుప్పల్',
      city: 'Choutuppal',
      services: ['ఆర్క్ వెల్డింగ్', 'షట్టర్ తయారీ'],
      business_hours: { raw: '9 AM - 8 PM' },
      status: 'active',
      is_verified: true,
      is_premium: true,
      metadata: {
        listing_id: 'CPL-BIZ-134',
        category: 'Engineering & Welding',
        category_te: 'ఇంజనీరింగ్ & వెల్డింగ్',
        maps_url: 'https://maps.google.com/?q=17.25,78.95',
      },
    };

    const details = formatListingDetailsText(listing);
    expect(details).toContain('లక్ష్మి గణపతి ఇంజనీరింగ్ వర్క్స్');
    expect(details).toContain('⭐ [Featured]');
    expect(details).toContain('✅ [Verified]');
    expect(details).toContain('9701601613');
    expect(details).toContain('https://wa.me/919701601613');
    expect(details).toContain('https://maps.google.com/?q=17.25,78.95');
    expect(details).not.toContain('undefined');
    expect(details).not.toContain('null');
    expect(details).not.toContain('N/A');
  });

  it('suppresses location map URL if maps_url is blank or missing', () => {
    const listingNoMap: DirectoryListing = {
      id: 'uuid-nomap',
      name: 'No Map Shop',
      category_slug: 'services',
      phone: '9885374861',
      whatsapp_phone: '9885374861',
      city: 'Choutuppal',
      services: [],
      business_hours: {},
      status: 'active',
      is_verified: false,
      is_premium: false,
      metadata: {
        listing_id: 'CPL-BIZ-001',
        maps_url: '',
      },
    };

    const details = formatListingDetailsText(listingNoMap);
    expect(details).not.toContain('Location Map');
    expect(details).not.toContain('https://maps.google.com');
  });

  it('builds listing details actions with interactive reply buttons and navigation', () => {
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

    // 1. Reply buttons (Meta max 3, <= 20 chars each)
    expect(actions.buttons.length).toBe(3);
    expect(actions.buttons[0]).toEqual({ id: 'dir_call_CPL-BIZ-001', title: '📞 Call' });
    expect(actions.buttons[1]).toEqual({ id: 'dir_wa_CPL-BIZ-001', title: '💬 WhatsApp' });
    expect(actions.buttons[2]).toEqual({ id: 'dir_listpage_automobile_2', title: '🔙 Back' });
    for (const btn of actions.buttons) {
      expect(btn.title.length).toBeLessThanOrEqual(20);
    }
    expect(actions.bodyText.length).toBeLessThanOrEqual(1024);

    // 2. Sections list fallback
    expect(actions.sections[0].rows.length).toBe(3);
    expect(actions.sections[0].rows[0].id).toBe('dir_listpage_automobile_2');
    expect(actions.sections[0].rows[1].id).toBe('dir_browse');
    expect(actions.sections[0].rows[2].id).toBe('dir_back_biz_menu');
  });

  it('includes Call button and omits WhatsApp button when WhatsApp phone is blank', () => {
    const listing: DirectoryListing = {
      id: 'uuid-callonly',
      name: 'Call Only Shop',
      category_slug: 'automobile',
      phone: '9885374861',
      whatsapp_phone: '',
      city: 'Choutuppal',
      services: [],
      business_hours: {},
      status: 'active',
      is_verified: false,
      is_premium: false,
      metadata: { listing_id: 'CPL-BIZ-002' },
    };

    const actions = buildListingDetailsActions({
      listing,
      categorySlug: 'automobile',
      listingPage: 1,
    });

    expect(actions.buttons.some((b) => b.id === 'dir_call_CPL-BIZ-002')).toBe(true);
    expect(actions.buttons.some((b) => b.id.startsWith('dir_wa_'))).toBe(false);
    expect(actions.buttons.some((b) => b.id === 'dir_listpage_automobile_1')).toBe(true);
    expect(actions.buttons.some((b) => b.id === 'dir_browse')).toBe(true);
    expect(actions.buttons.length).toBeLessThanOrEqual(3);
  });

  it('includes WhatsApp button and omits Call button when phone is blank', () => {
    const listing: DirectoryListing = {
      id: 'uuid-waonly',
      name: 'WhatsApp Only Shop',
      category_slug: 'automobile',
      phone: '',
      whatsapp_phone: '9885374861',
      city: 'Choutuppal',
      services: [],
      business_hours: {},
      status: 'active',
      is_verified: false,
      is_premium: false,
      metadata: { listing_id: 'CPL-BIZ-003' },
    };

    const actions = buildListingDetailsActions({
      listing,
      categorySlug: 'automobile',
      listingPage: 1,
    });

    expect(actions.buttons.some((b) => b.id.startsWith('dir_call_'))).toBe(false);
    expect(actions.buttons.some((b) => b.id === 'dir_wa_CPL-BIZ-003')).toBe(true);
    expect(actions.buttons.some((b) => b.id === 'dir_listpage_automobile_1')).toBe(true);
    expect(actions.buttons.some((b) => b.id === 'dir_browse')).toBe(true);
    expect(actions.buttons.length).toBeLessThanOrEqual(3);
  });

  it('omits both Call and WhatsApp buttons when phone and WhatsApp phone are blank', () => {
    const listing: DirectoryListing = {
      id: 'uuid-nophone',
      name: 'No Phone Shop',
      category_slug: 'automobile',
      phone: '',
      whatsapp_phone: '',
      city: 'Choutuppal',
      services: [],
      business_hours: {},
      status: 'active',
      is_verified: false,
      is_premium: false,
      metadata: { listing_id: 'CPL-BIZ-004' },
    };

    const actions = buildListingDetailsActions({
      listing,
      categorySlug: 'automobile',
      listingPage: 1,
    });

    expect(actions.buttons.some((b) => b.id.startsWith('dir_call_'))).toBe(false);
    expect(actions.buttons.some((b) => b.id.startsWith('dir_wa_'))).toBe(false);
    expect(actions.buttons.some((b) => b.id === 'dir_listpage_automobile_1')).toBe(true);
    expect(actions.buttons.some((b) => b.id === 'dir_browse')).toBe(true);
    expect(actions.buttons.some((b) => b.id === 'dir_back_biz_menu')).toBe(true);
    expect(actions.buttons.length).toBeLessThanOrEqual(3);
  });

  it('queries database with status in (active, published) filter and excludes pending records', async () => {
    // Mock db client
    const mockDb = {
      from: (table: string) => ({
        select: () => ({
          eq: (col1: string, val1: any) => ({
            in: (col2: string, val2: any[]) => ({
              eq: (col3: string, val3: any) => {
                if (val2.includes('published') || val2.includes('active')) {
                  return { data: [{ id: '1', name: 'Active Listing', status: 'published', is_premium: false, is_verified: false, metadata: { listing_id: 'CPL-BIZ-001' } }], error: null };
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
    expect(listings[0].name).toBe('Active Listing');
  });
});
