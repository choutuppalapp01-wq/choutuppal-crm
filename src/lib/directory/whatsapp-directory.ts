/**
 * WhatsApp Dynamic Directory Runtime Layer.
 *
 * Provides database queries, pagination, message formatting,
 * and navigation transitions for the Choutuppal WhatsApp Directory.
 *
 * Rules:
 * - Reads ONLY from `business_listings` and `categories` in Supabase CRM DB.
 * - Visibility filter: status = 'published' (zero 'pending' listings exposed).
 * - Enforces WhatsApp limits (max 10 rows in list, titles <= 24 chars, descriptions <= 72 chars).
 * - Session tracking via flow run variables (vars.dir_*).
 * - Self-service: No agent handoff triggered during directory browsing.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import type { InteractiveButton, InteractiveListRow, InteractiveListSection } from '@/lib/whatsapp/meta-api';

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
 * Loads public, published listings for a category with deterministic ranking.
 * Visibility rule: status = 'published'
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
    .eq('status', 'published')
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
      title: 'తర్వాతి షాపులు ➡️',
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
 * Only returns listings with status = 'published'.
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
    .eq('status', 'published')
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
    .eq('status', 'published')
    .eq('slug', listingId.toLowerCase())
    .maybeSingle();

  if (!errSlug && bySlug) {
    return bySlug as DirectoryListing;
  }

  return null;
}

/**
 * Sanitizes description text by removing synthetic contact number suffixes
 * (e.g. ". Contact: 9885374861" or "Contact: 9885374861") without destroying
 * meaningful descriptions or unrelated numbers.
 */
export function sanitizeDescription(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\s*[.,-]?\s*Contact:\s*\+?\d{10,12}\s*$/i, '')
    .replace(/\s*[.,-]?\s*Contact:\s*\+?\d{10,12}\b/gi, '')
    .trim();
}

/**
 * Formats a business listing into a clean WhatsApp details card.
 * Suppresses empty/null fields cleanly.
 * Format:
 * 🏪 ***{Business / Service Name}*** (bold + italic: *_..._*)
 * 📝 {Short description in 1–2 concise lines}
 * *Services*
 * • {Genuine service 1}
 * • {Genuine service 2}
 * 📍 *Address*
 * {Business address}
 *
 * Does NOT display Category, Subcategory, separate phone lines,
 * or raw wa.me URLs. Strips synthetic Contact suffixes.
 */
export function formatListingDetailsText(item: DirectoryListing): string {
  const parts: string[] = [];

  // Business / Service Name: bold + italic
  parts.push(`🏪 *_${item.name.trim()}_*`);

  // Short description in 1-2 concise lines, sanitized
  const cleanDesc = sanitizeDescription(item.description);
  if (cleanDesc) {
    parts.push(`📝 ${cleanDesc}`);
  }

  // Contact phone number formatted directly for tap-to-dial
  const rawPhone = (item.phone || item.whatsapp_phone || '').trim();
  const digits = normalizePhone(rawPhone);
  if (digits) {
    const formatted =
      digits.length === 10
        ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
        : digits.startsWith('91') && digits.length === 12
        ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
        : `+${digits}`;
    parts.push(`📞 *ఫోన్:* ${formatted}`);
  }

  // Address: show only when genuine address data is available
  const addressStr = (item.address || '').trim() || (item.area || '').trim();
  if (addressStr) {
    parts.push(`📍 *చిరునామా:*\n${addressStr}`);
  }

  return parts.join('\n\n');
}

/**
 * Builds the customer-facing prefilled Telugu message draft for WhatsApp chat.
 * Allows the customer to review and edit before sending.
 */
export function buildWhatsAppPrefilledText(item: DirectoryListing): string {
  const parts: string[] = [
    'నమస్కారం! 🙏',
    'నేను Choutuppal App ద్వారా మీ వ్యాపారం గురించి తెలుసుకున్నాను.',
    `🏪 వ్యాపారం: ${item.name.trim()}`,
  ];

  const desc = sanitizeDescription(item.description);
  if (desc) {
    parts.push(`📝 వివరాలు: ${desc}`);
  }

  if (item.services && Array.isArray(item.services) && item.services.length > 0) {
    const validServices = item.services
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0);
    if (validServices.length > 0) {
      parts.push(`*సేవలు:*\n${validServices.map((s) => `• ${s}`).join('\n')}`);
    }
  }

  parts.push('దయచేసి మీ సేవల వివరాలు తెలియజేయగలరు.');
  parts.push('ధన్యవాదాలు!\n🌐 Choutuppal App — మన చౌటుప్పల్, మన వ్యాపారాలు.');

  return parts.join('\n\n');
}

/**
 * Prepares the click-to-chat wa.me URL with the prefilled Telugu draft.
 */
export function buildWhatsAppPrefillUrl(item: DirectoryListing): string {
  const phone = (item.whatsapp_phone || item.phone || '').trim();
  const digits = normalizePhone(phone);
  if (!digits) return '';

  let standardDigits = digits;
  if (/^[6-9]\d{9}$/.test(digits)) {
    standardDigits = `91${digits}`;
  }

  const prefillText = buildWhatsAppPrefilledText(item);
  const encodedText = encodeURIComponent(prefillText);

  return `https://wa.me/${standardDigits}?text=${encodedText}`;
}

/**
 * Builds the interactive action navigation for a listing details view.
 * Produces simplified navigation reply buttons:
 * - తర్వాతి షాపులు ➡️
 * - 🔙 వెనుకకు
 * - 📁 కేటగిరీలు
 */
export function buildListingDetailsActions(args: {
  listing: DirectoryListing;
  categorySlug: string;
  listingPage: number;
}): {
  bodyText: string;
  buttons: InteractiveButton[];
  buttonLabel: string;
  sections: InteractiveListSection[];
} {
  const { listing, categorySlug, listingPage } = args;
  const rawDetails = formatListingDetailsText(listing);
  // Enforce Meta's 1024-char body limit
  const detailsText = truncate(rawDetails, 1024);

  const curPage = listingPage || 1;
  const catSlug =
    categorySlug && categorySlug !== 'uncategorized'
      ? categorySlug
      : (listing.category_slug || 'uncategorized');

  const nextPageId =
    catSlug && catSlug !== 'uncategorized'
      ? `dir_listpage_${catSlug}_${curPage + 1}`
      : 'dir_browse';

  const backId =
    catSlug && catSlug !== 'uncategorized'
      ? `dir_listpage_${catSlug}_${curPage}`
      : 'dir_browse';

  // Simplified navigation: [తర్వాతి షాపులు ➡️], [🔙 వెనుకకు], [📁 కేటగిరీలు]
  const buttons: InteractiveButton[] = [
    { id: nextPageId, title: 'తర్వాతి షాపులు ➡️' },
    { id: backId, title: '🔙 వెనుకకు' },
    { id: 'dir_browse', title: '📁 కేటగిరీలు' },
  ];

  const rows: InteractiveListRow[] = [
    {
      id: nextPageId,
      title: 'తర్వాతి షాపులు ➡️',
      description: 'తర్వాతి షాపుల జాబితా చూడండి',
    },
    {
      id: backId,
      title: '🔙 వెనుకకు',
      description: 'మునుపటి జాబితాకు తిరిగి వెళ్ళండి',
    },
    {
      id: 'dir_browse',
      title: '📁 కేటగిరీలు',
      description: 'అన్ని కేటగిరీలు చూడండి',
    },
  ];

  return {
    bodyText: detailsText,
    buttons,
    buttonLabel: 'ఎంపికలు',
    sections: [
      {
        title: 'చర్యలు',
        rows,
      },
    ],
  };
}
