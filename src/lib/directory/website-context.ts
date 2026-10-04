/**
 * Website → WhatsApp Context Routing Models and Utilities.
 *
 * Implements safe, deterministic contextual link generation, parsing, validation,
 * and routing resolution for website-originated WhatsApp inbound inquiries.
 *
 * All website context is treated as untrusted input.
 */

export const ALLOWED_SOURCES = ['website'] as const;
export type WebsiteSource = (typeof ALLOWED_SOURCES)[number];

export const ALLOWED_SERVICES = [
  'local_directory',
  'my_business',
  'premium_listing',
  'promotion_services',
  'real_estate',
  'jobs',
  'promotion',
  'whatsapp_automation',
  'service_catalog',
  'loans_finance',
  'insurance',
  'deals',
] as const;
export type SupportedService = (typeof ALLOWED_SERVICES)[number];

export const ALLOWED_INTENTS = [
  'business_enquiry',
  'premium_enquiry',
  'property_enquiry',
  'job_enquiry',
  'service_enquiry',
  'general_enquiry',
  'finance_enquiry',
  'insurance_enquiry',
] as const;
export type SupportedIntent = (typeof ALLOWED_INTENTS)[number];

export const ALLOWED_FLOW_SLUGS = [
  'welcome_menu_v2',
  'welcome_menu',
  'local_directory',
  'my_business',
  'premium_listing',
  'promotion_services',
  'real_estate',
  'jobs',
  'service_catalog',
  'faq_bot',
  'lead_capture',
] as const;
export type AllowedFlowSlug = (typeof ALLOWED_FLOW_SLUGS)[number];

/**
 * Validated, typed website context model.
 */
export interface WebsiteContext {
  source: WebsiteSource;
  source_page?: string;
  source_button?: string;
  campaign?: string;
  service?: SupportedService;
  intent?: SupportedIntent;
  listing_id?: string;
  property_id?: string;
  job_id?: string;
  flow_slug?: AllowedFlowSlug;
  ref?: string;
}

/**
 * Options for building a contextual WhatsApp URL.
 */
export interface BuildContextUrlOptions {
  phoneNumber: string;
  context: WebsiteContext;
  humanMessage?: string;
}

// Security sanitization regexes
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
const SAFE_STRING_REGEX = /^[a-zA-Z0-9_\-\.\s]{1,100}$/;
const CTX_TAG_REGEX = /\[CTX\s+([^\]]+)\]/i;

/**
 * Builds a safe, canonical WhatsApp click-to-chat URL with embedded context tag.
 */
export function buildContextualWhatsAppUrl(options: BuildContextUrlOptions): string {
  const cleanPhone = options.phoneNumber.replace(/[^0-9]/g, '');
  const tokens: string[] = ['source=website'];

  const ctx = options.context;
  if (ctx.source_page && SAFE_STRING_REGEX.test(ctx.source_page)) {
    tokens.push(`page=${ctx.source_page.trim()}`);
  }
  if (ctx.source_button && SAFE_STRING_REGEX.test(ctx.source_button)) {
    tokens.push(`button=${ctx.source_button.trim()}`);
  }
  if (ctx.campaign && SAFE_STRING_REGEX.test(ctx.campaign)) {
    tokens.push(`campaign=${ctx.campaign.trim()}`);
  }
  if (ctx.service && (ALLOWED_SERVICES as readonly string[]).includes(ctx.service)) {
    tokens.push(`service=${ctx.service}`);
  }
  if (ctx.intent && (ALLOWED_INTENTS as readonly string[]).includes(ctx.intent)) {
    tokens.push(`intent=${ctx.intent}`);
  }
  if (ctx.listing_id && SAFE_ID_REGEX.test(ctx.listing_id)) {
    tokens.push(`listing_id=${ctx.listing_id}`);
  }
  if (ctx.property_id && SAFE_ID_REGEX.test(ctx.property_id)) {
    tokens.push(`property_id=${ctx.property_id}`);
  }
  if (ctx.job_id && SAFE_ID_REGEX.test(ctx.job_id)) {
    tokens.push(`job_id=${ctx.job_id}`);
  }
  if (ctx.flow_slug && (ALLOWED_FLOW_SLUGS as readonly string[]).includes(ctx.flow_slug)) {
    tokens.push(`flow_slug=${ctx.flow_slug}`);
  }
  if (ctx.ref && SAFE_STRING_REGEX.test(ctx.ref)) {
    tokens.push(`ref=${ctx.ref.trim()}`);
  }

  const ctxTag = `[CTX ${tokens.join(' ')}]`;
  const textBody = options.humanMessage && options.humanMessage.trim()
    ? `${options.humanMessage.trim()}\n\n${ctxTag}`
    : ctxTag;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textBody)}`;
}

/**
 * Parse and validate website context from inbound message text.
 * Returns null if no context tag is found or if validation fails.
 */
export function parseWebsiteContext(text: string | null | undefined): {
  context: WebsiteContext;
  cleanText: string;
} | null {
  if (!text || typeof text !== 'string') return null;

  const match = text.match(CTX_TAG_REGEX);
  if (!match) return null;

  const rawTokens = match[1].trim().split(/\s+/);
  const parsedMap = new Map<string, string>();

  for (const token of rawTokens) {
    const eqIdx = token.indexOf('=');
    if (eqIdx === -1) continue;
    const key = token.slice(0, eqIdx).toLowerCase().trim();
    const val = token.slice(eqIdx + 1).trim();
    if (parsedMap.has(key)) {
      // Duplicate key detected - treat as suspicious / ignore extra or keep first
      continue;
    }
    parsedMap.set(key, val);
  }

  // Validate source
  const source = parsedMap.get('source');
  if (source !== 'website') {
    return null;
  }

  const result: WebsiteContext = { source: 'website' };

  // Validate optional fields
  const page = parsedMap.get('page');
  if (page && SAFE_STRING_REGEX.test(page)) {
    result.source_page = page;
  }

  const button = parsedMap.get('button');
  if (button && SAFE_STRING_REGEX.test(button)) {
    result.source_button = button;
  }

  const campaign = parsedMap.get('campaign');
  if (campaign && SAFE_STRING_REGEX.test(campaign)) {
    result.campaign = campaign;
  }

  const service = parsedMap.get('service');
  if (service && (ALLOWED_SERVICES as readonly string[]).includes(service)) {
    result.service = service as SupportedService;
  }

  const intent = parsedMap.get('intent');
  if (intent && (ALLOWED_INTENTS as readonly string[]).includes(intent)) {
    result.intent = intent as SupportedIntent;
  }

  const listingId = parsedMap.get('listing_id');
  if (listingId && SAFE_ID_REGEX.test(listingId)) {
    result.listing_id = listingId;
  }

  const propertyId = parsedMap.get('property_id');
  if (propertyId && SAFE_ID_REGEX.test(propertyId)) {
    result.property_id = propertyId;
  }

  const jobId = parsedMap.get('job_id');
  if (jobId && SAFE_ID_REGEX.test(jobId)) {
    result.job_id = jobId;
  }

  const flowSlug = parsedMap.get('flow_slug');
  if (flowSlug && (ALLOWED_FLOW_SLUGS as readonly string[]).includes(flowSlug)) {
    result.flow_slug = flowSlug as AllowedFlowSlug;
  }

  const ref = parsedMap.get('ref');
  if (ref && SAFE_STRING_REGEX.test(ref)) {
    result.ref = ref;
  }

  // Clean the human-readable text by removing the [CTX ...] tag
  const cleanText = text.replace(CTX_TAG_REGEX, '').trim();

  return {
    context: result,
    cleanText,
  };
}

/**
 * Deterministically resolves the target template/flow slug for a given website context.
 *
 * Explicit flow_slug (allowlisted) takes precedence.
 * Otherwise, maps service/intent/page to configured core templates.
 */
export function resolveTargetFlowSlug(context: WebsiteContext): AllowedFlowSlug | null {
  if (context.flow_slug && (ALLOWED_FLOW_SLUGS as readonly string[]).includes(context.flow_slug)) {
    return context.flow_slug;
  }

  // Map service
  if (context.service) {
    switch (context.service) {
      case 'premium_listing':
        return 'premium_listing';
      case 'real_estate':
        return 'real_estate';
      case 'jobs':
        return 'jobs';
      case 'promotion_services':
      case 'promotion':
      case 'whatsapp_automation':
        return 'promotion_services';
      case 'my_business':
        return 'my_business';
      case 'local_directory':
        return 'local_directory';
      case 'service_catalog':
      case 'loans_finance':
      case 'insurance':
      case 'deals':
        return 'service_catalog';
    }
  }

  // Map intent
  if (context.intent) {
    switch (context.intent) {
      case 'premium_enquiry':
        return 'premium_listing';
      case 'property_enquiry':
        return 'real_estate';
      case 'job_enquiry':
        return 'jobs';
      case 'service_enquiry':
        return 'promotion_services';
      case 'finance_enquiry':
      case 'insurance_enquiry':
        return 'service_catalog';
      case 'business_enquiry':
        return context.listing_id ? 'premium_listing' : 'local_directory';
    }
  }

  // Map page
  if (context.source_page) {
    switch (context.source_page) {
      case 'premium-listing':
        return 'premium_listing';
      case 'property':
      case 'real-estate':
        return 'real_estate';
      case 'job':
      case 'jobs':
        return 'jobs';
      case 'promotion':
      case 'whatsapp-automation':
        return 'promotion_services';
      case 'business-listing':
      case 'local-directory':
        return 'local_directory';
    }
  }

  return null;
}
