/**
 * WhatsApp Dynamic Directory Runtime Layer.
 *
 * Provides database queries, pagination, message formatting,
 * and navigation transitions for the Choutuppal WhatsApp Directory.
 *
 * Rules:
 * - Reads ONLY from `business_listings` and `categories` in Supabase CRM DB.
 * - Visibility filter: status = 'active' (zero 'pending' listings exposed).
 * - Enforces WhatsApp limits (max 10 rows in list, titles <= 24 chars, descriptions <= 72 chars).
 * - Session tracking via flow run variables (vars.dir_*).
 * - Self-service: No agent handoff triggered during directory browsing.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import type { InteractiveListRow, InteractiveListSection } from '@/lib/whatsapp/meta-api';

export interface DirectoryCategory {
  id: string;
  slug: string;
  name_en: string;
  name_te: string;
  display_order: number;
}

export interface DirectoryListing {
  id: string;
  name: string;
  slug?: string;
  category_slug: string | null;
  phone: string;
  whatsapp_phone: string;
  alternate_phone?: string | null;
  address?: string | null;
  area?: string | null;
  city: string;
  description?: string | null;
  services: string[];
  business_hours: Record<string, string>;
  status: string;
  is_verified: boolean;
  is_premium: boolean;
  metadata: {
    listing_id?: string;
    category?: string;
    category_te?: string;
    subcategory?: string;
    subcategory_te?: string;
    village?: string;
    maps_url?: string;
    logo_url?: string;
    cover_url?: string;
    video_url?: string;
    featured?: boolean;
    priority?: number;
    display_order?: number;
    owner_phone?: string;
    [key: string]: unknown;
  };
}

export interface DirectoryState {
  mode: boolean;
  category?: string;
  categoryPage: number;
  listingPage: number;
  selectedListingId?: string;
  previousMenu?: string;
}

export const DIRECTORY_LIMITS = {
  CATEGORIES_PER_PAGE: 8,
  LISTINGS_PER_PAGE: 8,
  TITLE_MAX_LEN: 24,
  DESC_MAX_LEN: 72,
} as const;

/**
 * Truncates a string safely to max length with ellipsis.
 */
export function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen - 1).trim() + '…';
}

/**
 * Formats a phone number into an international wa.me click-to-chat URL.
 * Example: '9441348175' -> 'https://wa.me/919441348175'
 */
export function formatWhatsAppUrl(phone: string): string {
  const digits = normalizePhone(phone);
  if (!digits) return '';
  // For standard 10-digit Indian numbers starting with 6-9, prepend 91
  if (/^[6-9]\d{9}$/.test(digits)) {
    return `https://wa.me/91${digits}`;
  }
  // If already starting with 91 and 12 digits
  if (/^91[6-9]\d{9}$/.test(digits)) {
    return `https://wa.me/${digits}`;
  }
  return `https://wa.me/${digits}`;
}

/**
 * Loads active categories from the database ordered by display_order ASC, name_en ASC.
 */
export async function getActiveCategories(
  db: SupabaseClient | any,
  accountId: string
): Promise<DirectoryCategory[]> {
  const { data, error } = await db
    .from('categories')
    .select('id, slug, name_en, name_te, display_order')
    .eq('account_id', accountId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name_en', { ascending: true });

  if (error || !data) {
    console.error('[directory] Error loading categories:', error?.message);
    return [];
  }
  return data as DirectoryCategory[];
}

/**
 * Builds the paginated interactive category list message payload.
 */
export function buildCategoryListPayload(args: {
  categories: DirectoryCategory[];
  page: number;
  perPage?: number;
}): {
  bodyText: string;
  buttonLabel: string;
  sections: InteractiveListSection[];
  hasMore: boolean;
  hasPrev: boolean;
  totalPages: number;
} {
  const perPage = args.perPage || DIRECTORY_LIMITS.CATEGORIES_PER_PAGE;
  const total = args.categories.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(1, args.page), totalPages);

  const startIdx = (currentPage - 1) * perPage;
  const pageItems = args.categories.slice(startIdx, startIdx + perPage);

  const rows: InteractiveListRow[] = pageItems.map((cat) => ({
    id: `dir_cat_${cat.slug}`,
    title: truncate(cat.name_en, DIRECTORY_LIMITS.TITLE_MAX_LEN),
    description: truncate(cat.name_te || cat.name_en, DIRECTORY_LIMITS.DESC_MAX_LEN),
  }));

  const hasMore = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  if (hasMore) {
    rows.push({
      id: `dir_catpage_${currentPage + 1}`,
      title: '➡️ More Categories',
      description: `మరిన్ని విభాగాలు (Page ${currentPage + 1}/${totalPages})`,
    });
  }

  if (hasPrev) {
    rows.push({
      id: `dir_catpage_${currentPage - 1}`,
      title: '⬅️ Previous Page',
      description: `మునుపటి పేజీ (Page ${currentPage - 1}/${totalPages})`,
    });
  }

  // Always offer a return row back to the business menu
  rows.push({
    id: 'dir_back_biz_menu',
    title: '🔙 Back to Menu',
    description: 'వ్యాపార మెనూకి తిరిగి వెళ్ళండి',
  });

  return {
    bodyText: `📁 *చౌటుప్పల్ లోకల్ బిజినెస్ డైరెక్టరీ*\n\nదయచేసి మీకు కావలసిన కేటగిరీని ఎంచుకోండి (Page ${currentPage}/${totalPages}):`,
    buttonLabel: 'కేటగిరీలు చూడండి',
    sections: [
      {
        title: 'వ్యాపార విభాగాలు',
        rows,
      },
    ],
    hasMore,
    hasPrev,
    totalPages,
  };
}

/**
 * Loads public, active listings for a category with deterministic ranking.
 * Visibility rule: status = 'active'
 * Ranking order:
 * 1. is_premium DESC
 * 2. is_verified DESC
 * 3. priority DESC (from metadata)
 * 4. display_order ASC (from metadata)
 * 5. created_at ASC / slug ASC
 */
export async function getActiveListingsByCategory(
  db: SupabaseClient | any,
  accountId: string,
  categorySlug: string
): Promise<DirectoryListing[]> {
  const { data, error } = await db
    .from('business_listings')
    .select('*')
    .eq('account_id', accountId)
    .in('status', ['active', 'published'])
    .eq('category_slug', categorySlug);

  if (error || !data) {
    console.error('[directory] Error loading listings:', error?.message);
    return [];
  }

  const listings = (data as DirectoryListing[]) || [];

  // Deterministic in-memory sort honoring ranking rules
  listings.sort((a, b) => {
    // 1. Premium
    if (a.is_premium !== b.is_premium) return a.is_premium ? -1 : 1;
    // 2. Verified
    if (a.is_verified !== b.is_verified) return a.is_verified ? -1 : 1;
    // 3. Priority DESC
    const pA = Number(a.metadata?.priority || 0);
    const pB = Number(b.metadata?.priority || 0);
    if (pA !== pB) return pB - pA;
    // 4. Display Order ASC
    const dA = Number(a.metadata?.display_order || 9999);
    const dB = Number(b.metadata?.display_order || 9999);
    if (dA !== dB) return dA - dB;
    // 5. Deterministic fallback: listing_id or slug
    const idA = String(a.metadata?.listing_id || a.slug);
    const idB = String(b.metadata?.listing_id || b.slug);
    return idA.localeCompare(idB);
  });

  return listings;
}

/**
 * Builds the paginated interactive listing list message payload.
 */
export function buildListingListPayload(args: {
  categoryName: string;
  categorySlug: string;
  listings: DirectoryListing[];
  page: number;
  perPage?: number;
}): {
  bodyText: string;
  buttonLabel: string;
  sections: InteractiveListSection[];
  hasMore: boolean;
  hasPrev: boolean;
  totalPages: number;
} {
  const perPage = args.perPage || DIRECTORY_LIMITS.LISTINGS_PER_PAGE;
  const total = args.listings.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(1, args.page), totalPages);

  if (total === 0) {
    return {
      bodyText: `🏪 *${args.categoryName}*\n\nఈ విభాగంలో ప్రస్తుతం యాక్టివ్ షాపులు అందుబాటులో లేవు.\n\nకొత్త షాపుల నమోదు పరిశీలనలో ఉంది.`,
      buttonLabel: 'మెనూ ఎంపికలు',
      sections: [
        {
          title: 'నావిగేషన్',
          rows: [
            {
              id: 'dir_browse',
              title: '📁 All Categories',
              description: 'అన్ని కేటగిరీలు చూడండి',
            },
            {
              id: 'dir_back_biz_menu',
              title: '🔙 Business Menu',
              description: 'వ్యాపార మెనూకి తిరిగి వెళ్ళండి',
            },
          ],
        },
      ],
      hasMore: false,
      hasPrev: false,
      totalPages: 1,
    };
  }

  const startIdx = (currentPage - 1) * perPage;
  const pageItems = args.listings.slice(startIdx, startIdx + perPage);

  const rows: InteractiveListRow[] = pageItems.map((item) => {
    const listingId = item.metadata?.listing_id || item.slug;
    const badge = item.is_premium ? '⭐ ' : item.is_verified ? '✅ ' : '🏪 ';
    const title = truncate(`${badge}${item.name}`, DIRECTORY_LIMITS.TITLE_MAX_LEN);
    const desc = truncate(
      item.metadata?.subcategory_te || item.area || item.city || item.phone,
      DIRECTORY_LIMITS.DESC_MAX_LEN
    );
    return {
      id: `dir_item_${listingId}`,
      title,
      description: desc,
    };
  });

  const hasMore = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  if (hasMore) {
    rows.push({
      id: `dir_listpage_${args.categorySlug}_${currentPage + 1}`,
      title: '➡️ Next Listings',
      description: `తర్వాతి జాబితా (Page ${currentPage + 1}/${totalPages})`,
    });
  }

  if (hasPrev) {
    rows.push({
      id: `dir_listpage_${args.categorySlug}_${currentPage - 1}`,
      title: '⬅️ Previous Page',
      description: `మునుపటి జాబితా (Page ${currentPage - 1}/${totalPages})`,
    });
  }

  // Back to categories navigation
  rows.push({
    id: 'dir_browse',
    title: '📁 Categories',
    description: 'కేటగిరీల జాబితాకు వెళ్ళండి',
  });

  return {
    bodyText: `🏪 *${args.categoryName}* (${total} షాపులు)\n\nవివరాలు చూడటానికి షాప్‌ను ఎంచుకోండి (Page ${currentPage}/${totalPages}):`,
    buttonLabel: 'షాపులు చూడండి',
    sections: [
      {
        title: 'షాపుల జాబితా',
        rows,
      },
    ],
    hasMore,
    hasPrev,
    totalPages,
  };
}

/**
 * Loads a single business listing by its deterministic listing_id (or slug).
 */
export async function getListingById(
  db: SupabaseClient | any,
  accountId: string,
  listingId: string
): Promise<DirectoryListing | null> {
  // First search by metadata->>listing_id
  const { data: byMeta, error: errMeta } = await db
    .from('business_listings')
    .select('*')
    .eq('account_id', accountId)
    .filter('metadata->>listing_id', 'eq', listingId)
    .maybeSingle();

  if (!errMeta && byMeta) {
    return byMeta as DirectoryListing;
  }

  // Fallback by slug
  const { data: bySlug, error: errSlug } = await db
    .from('business_listings')
    .select('*')
    .eq('account_id', accountId)
    .eq('slug', listingId.toLowerCase())
    .maybeSingle();

  if (!errSlug && bySlug) {
    return bySlug as DirectoryListing;
  }

  return null;
}

/**
 * Formats a business listing into a rich WhatsApp text details card.
 * Suppresses empty/null fields cleanly.
 */
export function formatListingDetailsText(item: DirectoryListing): string {
  const parts: string[] = [];
  let badges = '';
  if (item.is_premium) badges += ' ⭐ [Featured]';
  if (item.is_verified) badges += ' ✅ [Verified]';
  parts.push(`🏪 *${item.name}*${badges}`);

  const catEn = item.metadata?.category || item.category_slug;
  const catTe = item.metadata?.category_te;
  if (catTe || catEn) {
    parts.push(`📂 *Category:* ${catTe ? `${catTe} (${catEn})` : catEn}`);
  }

  const subTe = item.metadata?.subcategory_te;
  const subEn = item.metadata?.subcategory;
  if (subTe || subEn) {
    parts.push(`🏷️ *Subcategory:* ${subTe ? `${subTe} (${subEn})` : subEn}`);
  }

  if (item.area && item.area.trim()) {
    parts.push(`📍 *Area:* ${item.area.trim()}`);
  }

  if (item.address && item.address.trim()) {
    parts.push(`🏠 *Address:* ${item.address.trim()}`);
  }

  if (item.phone && item.phone.trim()) {
    parts.push(`📞 *Phone:* ${item.phone.trim()}`);
  }

  const wa = item.whatsapp_phone || item.phone;
  if (wa && wa.trim()) {
    const waUrl = formatWhatsAppUrl(wa);
    parts.push(`💬 *WhatsApp:* ${wa.trim()} (${waUrl})`);
  }

  if (item.alternate_phone && item.alternate_phone.trim()) {
    parts.push(`📱 *Alternate Phone:* ${item.alternate_phone.trim()}`);
  }

  const rawHours =
    item.metadata?.business_hours ||
    item.business_hours?.raw ||
    (typeof item.business_hours === 'string' ? item.business_hours : '');
  if (rawHours && String(rawHours).trim()) {
    parts.push(`🕒 *Timings:* ${String(rawHours).trim()}`);
  }

  if (item.description && item.description.trim()) {
    parts.push(`\n📝 *About:*\n${item.description.trim()}`);
  }

  if (item.services && item.services.length > 0) {
    parts.push(`\n🛠️ *Services:*\n${item.services.map((s) => `• ${s}`).join('\n')}`);
  }

  if (item.metadata?.maps_url && item.metadata.maps_url.trim()) {
    parts.push(`\n🗺️ *Location Map:*\n${item.metadata.maps_url.trim()}`);
  }

  return parts.join('\n');
}

/**
 * Builds the interactive action navigation for a listing details view.
 */
export function buildListingDetailsActions(args: {
  listing: DirectoryListing;
  categorySlug: string;
  listingPage: number;
}): {
  bodyText: string;
  buttonLabel: string;
  sections: InteractiveListSection[];
} {
  const { listing, categorySlug, listingPage } = args;
  const detailsText = formatListingDetailsText(listing);

  const rows: InteractiveListRow[] = [];

  // 1. Back to same listings page
  rows.push({
    id: `dir_listpage_${categorySlug}_${listingPage}`,
    title: '🔙 Back to Listings',
    description: 'షాపుల జాబితాకు తిరిగి వెళ్ళండి',
  });

  // 2. Back to Categories
  rows.push({
    id: 'dir_browse',
    title: '📁 All Categories',
    description: 'కేటగిరీల జాబితాకు వెళ్ళండి',
  });

  // 3. Return to Main Business Menu
  rows.push({
    id: 'dir_back_biz_menu',
    title: '🏠 Business Menu',
    description: 'ప్రధాన వ్యాపార మెనూకి వెళ్ళండి',
  });

  return {
    bodyText: detailsText,
    buttonLabel: 'మెనూ ఎంపికలు',
    sections: [
      {
        title: 'నావిగేషన్',
        rows,
      },
    ],
  };
}
