/**
 * Service Catalog Taxonomy & Definitions.
 *
 * Implements extensible, account-safe service catalog taxonomy,
 * defining service categories, specific services, flow routing mappings,
 * CRM lead tagging, and user requirement fields for Choutuppal CRM.
 *
 * Architecture:
 * SERVICE CATALOG → SERVICE CATEGORY → SERVICE → USER REQUIREMENT → GUIDED FLOW → LEAD DATA → CRM TAG → HANDOFF
 */

export interface ServiceCategory {
  id: string;
  slug: string;
  name_en: string;
  name_te: string;
  description_en: string;
  description_te: string;
  icon: string;
  display_order: number;
  is_active: boolean;
}

export interface ServiceDefinition {
  id: string;
  category_slug: string;
  slug: string;
  name_en: string;
  name_te: string;
  description_en: string;
  description_te: string;
  flow_slug: string;
  lead_tag: string;
  requirement_fields: string[];
  display_order: number;
  is_active: boolean;
  metadata?: Record<string, unknown>;
}

export const KNOWN_SERVICE_TAGS = {
  VIDEO_PROMOTION: 'tag_video_promotion',
  CREATIVE_DESIGN: 'tag_creative_design',
  CREATIVE_POLITICAL_LEAD: 'tag_creative_political_lead',
  WHATSAPP_MARKETING: 'tag_whatsapp_marketing',
  ADS_CAMPAIGN: 'tag_ads_campaign',
  PREMIUM_LISTING: 'tag_premium_listing',
  OWNER_LISTING: 'tag_owner_listing',
  TENANT_SEEKER: 'tag_tenant_seeker',
  JOB_SEEKER: 'tag_job_seeker',
  EMPLOYER_JOB: 'tag_employer_job',
  FINANCE_LEAD: 'tag_finance_lead',
  INSURANCE_LEAD: 'tag_insurance_lead',
  DEAL_SHOPPER: 'tag_deal_shopper',
  MERCHANT_DEAL_PENDING: 'tag_merchant_deal_pending',
  AFFILIATE_LEAD: 'tag_affiliate_lead',
  LOCAL_SERVICE_LEAD: 'tag_local_service_lead',
  PERSONAL_GREETINGS: 'tag_personal_greetings',
  WHATSAPP_AUTOMATION_LEAD: 'tag_whatsapp_automation_lead',
  CATERING_LEAD: 'tag_catering_lead',
  POLITICAL_FLEX: 'tag_political_flex',
} as const;

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'cat-my-business',
    slug: 'my_business',
    name_en: 'My Business',
    name_te: 'నా వ్యాపారం',
    description_en: 'Vendor profile, store details, and self-service listing management',
    description_te: 'షాప్ ప్రొఫైల్, వివరాల సవరణ మరియు వ్యాపార నిర్వహణ',
    icon: 'Store',
    display_order: 1,
    is_active: true,
  },
  {
    id: 'cat-promotions',
    slug: 'promotions',
    name_en: 'Promotion Services',
    name_te: 'ప్రమోషన్ సేవలు',
    description_en: 'Promotional video reels, business ads, and local digital marketing',
    description_te: 'వీడియో రీల్స్, ప్రకటనలు మరియు స్థానిక డిజిటల్ ప్రమోషన్లు',
    icon: 'Megaphone',
    display_order: 2,
    is_active: true,
  },
  {
    id: 'cat-design-video',
    slug: 'design_video',
    name_en: 'Design & Video',
    name_te: 'డిజైన్ & వీడియో',
    description_en: 'Posters, greetings, festival creatives, and video production',
    description_te: 'పోస్టర్ డిజైన్, శుభాకాంక్షలు, ఫ్లెక్స్ మరియు వీడియో తయారీ',
    icon: 'Palette',
    display_order: 3,
    is_active: true,
  },
  {
    id: 'cat-wa-marketing',
    slug: 'whatsapp_marketing',
    name_en: 'WhatsApp Marketing',
    name_te: 'WhatsApp మార్కెటింగ్',
    description_en: 'Compliant opt-in customer messaging, broadcasts, and automation',
    description_te: 'కస్టమర్ మెసేజింగ్, ప్రచారాలు మరియు ఆటోమేషన్ సేవలు',
    icon: 'MessageSquare',
    display_order: 4,
    is_active: true,
  },
  {
    id: 'cat-ads-campaigns',
    slug: 'ads_campaigns',
    name_en: 'Ads Campaigns',
    name_te: 'యాడ్స్ క్యాంపెయిన్స్',
    description_en: 'Meta, Google, and local social media advertising campaigns',
    description_te: 'సోషల్ మీడియా & గూగుల్ యాడ్స్ ద్వారా స్థానిక ప్రచారం',
    icon: 'Target',
    display_order: 5,
    is_active: true,
  },
  {
    id: 'cat-premium-listing',
    slug: 'premium_listing',
    name_en: 'Premium Listing',
    name_te: 'ప్రీమియం లిస్టింగ్',
    description_en: 'Verified badge, top category placement, and enhanced visibility',
    description_te: 'వెరిఫైడ్ బ్యాడ్జ్, టాప్ ప్లేస్‌మెంట్ మరియు ప్రత్యేక గుర్తింపు',
    icon: 'Sparkles',
    display_order: 6,
    is_active: true,
  },
  {
    id: 'cat-real-estate',
    slug: 'real_estate',
    name_en: 'Real Estate & Rentals',
    name_te: 'రియల్ ఎస్టేట్ & అద్దెలు',
    description_en: 'Plots, farmland, houses, commercial rentals, and properties',
    description_te: 'ప్లాట్లు, భూములు, ఇళ్ళు మరియు అద్దె వివరాలు',
    icon: 'Building2',
    display_order: 7,
    is_active: true,
  },
  {
    id: 'cat-jobs',
    slug: 'jobs',
    name_en: 'Jobs',
    name_te: 'ఉద్యోగ సమాచారం',
    description_en: 'Local job vacancies, candidate profiles, and employer hiring',
    description_te: 'స్థానిక ఉద్యోగ ఖాళీలు, రిక్రూట్‌మెంట్ మరియు అభ్యర్థుల వివరాలు',
    icon: 'Briefcase',
    display_order: 8,
    is_active: true,
  },
  {
    id: 'cat-finance',
    slug: 'finance',
    name_en: 'Loans & Credit Cards',
    name_te: 'రుణాలు & క్రెడిట్ కార్డులు',
    description_en: 'Personal, business, home loans referral and credit cards enquiry',
    description_te: 'పర్సనల్, బిజినెస్ లోన్లు మరియు క్రెడిట్ కార్డ్ విచారణ',
    icon: 'Coins',
    display_order: 9,
    is_active: true,
  },
  {
    id: 'cat-insurance',
    slug: 'insurance',
    name_en: 'Insurance',
    name_te: 'భీమా (Insurance)',
    description_en: 'Vehicle, health, and life insurance referral enquiries',
    description_te: 'వాహన, ఆరోగ్య మరియు జీవిత భీమా విచారణ సేవలు',
    icon: 'Shield',
    display_order: 10,
    is_active: true,
  },
  {
    id: 'cat-deals',
    slug: 'deals',
    name_en: 'Deals & Offers',
    name_te: 'ఆఫర్లు & డీల్స్',
    description_en: 'Local merchant discounts, shopping deals, and promotional coupons',
    description_te: 'స్థానిక దుకాణాల డిస్కౌంట్లు, కూపన్లు మరియు ప్రత్యేక ఆఫర్లు',
    icon: 'Tag',
    display_order: 11,
    is_active: true,
  },
  {
    id: 'cat-affiliate',
    slug: 'affiliate',
    name_en: 'Affiliate Products',
    name_te: 'ఉపయోగకర వస్తువులు',
    description_en: 'Recommended electronics, tools, and digital solutions with clear disclosure',
    description_te: 'ఎలక్ట్రానిక్స్, గృహోపకరణాలు మరియు ఉపయోగకరమైన ఉత్పత్తులు',
    icon: 'ShoppingBag',
    display_order: 12,
    is_active: true,
  },
  {
    id: 'cat-local-services',
    slug: 'local_services',
    name_en: 'Local Services',
    name_te: 'స్థానిక సేవలు',
    description_en: 'Electricians, mechanics, plumbers, catering, and home repairs',
    description_te: 'ఎలక్ట్రీషియన్లు, మెకానిక్స్, ప్లంబర్లు, కేటరింగ్ & ఇతర సేవలు',
    icon: 'Wrench',
    display_order: 13,
    is_active: true,
  },
  {
    id: 'cat-greetings',
    slug: 'greetings',
    name_en: 'Greetings & Events',
    name_te: 'శుభాకాంక్షలు & ఈవెంట్స్',
    description_en: 'Birthday wishes, marriage posters, event banners, and personal greetings',
    description_te: 'పుట్టినరోజు, పెళ్లి శుభాకాంక్షలు మరియు ఈవెంట్ పోస్టర్లు',
    icon: 'HeartHandshake',
    display_order: 14,
    is_active: true,
  },
  {
    id: 'cat-wa-automation',
    slug: 'wa_automation',
    name_en: 'WhatsApp Automation',
    name_te: 'WhatsApp ఆటోమేషన్',
    description_en: 'Custom WhatsApp CRM, bots, and lead capture solutions for businesses',
    description_te: 'వ్యాపారాల కోసం WhatsApp బాట్ మరియు CRM సొల్యూషన్స్',
    icon: 'Bot',
    display_order: 15,
    is_active: true,
  },
];

export const SERVICES: ServiceDefinition[] = [
  // 1. Video & Promotions
  {
    id: 'srv-promo-video',
    category_slug: 'promotions',
    slug: 'promotion_video',
    name_en: 'Promotion Video & Reels',
    name_te: 'ప్రమోషన్ వీడియో & రీల్స్',
    description_en: 'Reels, status videos, shorts, and shop shooting with voice-over',
    description_te: 'Instagram/Facebook రీల్స్, వాయిస్ ఓవర్ మరియు షాప్ వీడియో ప్రచారం',
    flow_slug: 'promotion_services',
    lead_tag: KNOWN_SERVICE_TAGS.VIDEO_PROMOTION,
    requirement_fields: ['business_name', 'video_type', 'duration', 'language', 'voice_over_required', 'budget_range'],
    display_order: 1,
    is_active: true,
  },
  {
    id: 'srv-poster-design',
    category_slug: 'design_video',
    slug: 'poster_design',
    name_en: 'Poster & Creative Design',
    name_te: 'పోస్టర్ & క్రియేటివ్ డిజైన్',
    description_en: 'Business banners, festival wishes, event flex, and commercial creative posters',
    description_te: 'షాప్ బ్యానర్లు, పండుగ శుభాకాంక్షలు, ఈవెంట్ ఫ్లెక్స్ మరియు డిజిటల్ పోస్టర్లు',
    flow_slug: 'promotion_services',
    lead_tag: KNOWN_SERVICE_TAGS.CREATIVE_DESIGN,
    requirement_fields: ['name', 'occasion', 'photo_provided', 'message', 'design_size', 'language'],
    display_order: 2,
    is_active: true,
  },
  {
    id: 'srv-wa-marketing',
    category_slug: 'whatsapp_marketing',
    slug: 'whatsapp_marketing',
    name_en: 'WhatsApp Marketing & Broadcasts',
    name_te: 'WhatsApp మార్కెటింగ్ & బ్రాడ్‌కాస్ట్',
    description_en: 'Opt-in customer engagement, broadcasts, and automated response setup',
    description_te: 'అనుమతి పొందిన కస్టమర్లకు మెసేజింగ్ మరియు ఆటోమేషన్ సెటప్',
    flow_slug: 'promotion_services',
    lead_tag: KNOWN_SERVICE_TAGS.WHATSAPP_MARKETING,
    requirement_fields: ['business_name', 'opted_in_contacts_available', 'campaign_goal', 'contact_count'],
    display_order: 3,
    is_active: true,
  },
  {
    id: 'srv-ads-campaign',
    category_slug: 'ads_campaigns',
    slug: 'ads_campaign',
    name_en: 'Ads Campaign Management',
    name_te: 'యాడ్స్ క్యాంపెయిన్ సేవలు',
    description_en: 'Targeted local ads on Meta, Google, and local platforms for businesses',
    description_te: 'చౌటుప్పల్ పరిసరాల్లో బిజినెస్ కోసం సోషల్ మీడియా యాడ్స్ రన్ చేయడం',
    flow_slug: 'promotion_services',
    lead_tag: KNOWN_SERVICE_TAGS.ADS_CAMPAIGN,
    requirement_fields: ['business_name', 'target_area', 'platform', 'budget_range'],
    display_order: 4,
    is_active: true,
  },
  {
    id: 'srv-premium-listing',
    category_slug: 'premium_listing',
    slug: 'premium_listing',
    name_en: 'Directory Premium Listing',
    name_te: 'డైరెక్టరీ ప్రీమియం లిస్టింగ్',
    description_en: 'Top rank in directory searches, gold verified badge, and priority customer leads',
    description_te: 'డైరెక్టరీలో టాప్ స్థానం, వెరిఫైడ్ బ్యాడ్జ్ మరియు ఎక్కువ కస్టమర్ కాల్స్',
    flow_slug: 'premium_listing',
    lead_tag: KNOWN_SERVICE_TAGS.PREMIUM_LISTING,
    requirement_fields: ['business_name', 'category', 'plan_choice', 'listing_id'],
    display_order: 5,
    is_active: true,
  },

  // 2. Real Estate & Property
  {
    id: 'srv-property-buy',
    category_slug: 'real_estate',
    slug: 'property_buy',
    name_en: 'Buy Property (Plots/Houses)',
    name_te: 'ప్రాపర్టీ కొనుగోలు (ప్లాట్లు/ఇళ్ళు)',
    description_en: 'Open plots, DTCP/HMDA layouts, agricultural farmlands, and houses',
    description_te: 'ఓపెన్ ప్లాట్లు, వ్యవసాయ భూములు మరియు ఇళ్ళ కొనుగోలు సహాయం',
    flow_slug: 'real_estate',
    lead_tag: KNOWN_SERVICE_TAGS.OWNER_LISTING,
    requirement_fields: ['property_type', 'preferred_location', 'budget_range'],
    display_order: 6,
    is_active: true,
  },
  {
    id: 'srv-property-rent',
    category_slug: 'real_estate',
    slug: 'property_rent',
    name_en: 'House & Shop Rentals',
    name_te: 'ఇళ్ళు & షాపుల అద్దెలు',
    description_en: 'Residential houses, commercial shops, and office spaces for rent',
    description_te: 'నివాస గృహాలు, వ్యాపార షాపులు మరియు కమర్షియల్ అద్దె స్థలాలు',
    flow_slug: 'real_estate',
    lead_tag: KNOWN_SERVICE_TAGS.TENANT_SEEKER,
    requirement_fields: ['rental_type', 'location', 'budget_range'],
    display_order: 7,
    is_active: true,
  },

  // 3. Jobs & Hiring
  {
    id: 'srv-job-search',
    category_slug: 'jobs',
    slug: 'job_search',
    name_en: 'Local Job Search',
    name_te: 'స్థానిక ఉద్యోగ శోధన',
    description_en: 'Find open jobs in factories, pharma companies, retail shops, and offices',
    description_te: 'పరిశ్రమలు, షాపులు మరియు ఆఫీసుల్లో ఉద్యోగ సమాచారం',
    flow_slug: 'jobs',
    lead_tag: KNOWN_SERVICE_TAGS.JOB_SEEKER,
    requirement_fields: ['qualification', 'experience', 'preferred_role', 'location'],
    display_order: 8,
    is_active: true,
  },
  {
    id: 'srv-post-job',
    category_slug: 'jobs',
    slug: 'post_job',
    name_en: 'Post a Job / Employer Hiring',
    name_te: 'ఉద్యోగ ప్రకటన ఇవ్వండి',
    description_en: 'Employers hiring for local staff, helpers, operators, and drivers',
    description_te: 'షాపులు, పరిశ్రమల్లో ఖాళీల కోసం స్థానిక అభ్యర్థుల రిక్రూట్‌మెంట్',
    flow_slug: 'jobs',
    lead_tag: KNOWN_SERVICE_TAGS.EMPLOYER_JOB,
    requirement_fields: ['company_name', 'job_title', 'vacancies', 'salary_range'],
    display_order: 9,
    is_active: true,
  },

  // 4. Finance & Insurance (Neutral lead routing)
  {
    id: 'srv-loans-finance',
    category_slug: 'finance',
    slug: 'loans_finance',
    name_en: 'Loans & Finance Enquiry',
    name_te: 'రుణాలు & క్రెడిట్ సమాచారం',
    description_en: 'Referral inquiry for personal, business, home loans, or credit cards',
    description_te: 'పర్సనల్, బిజినెస్ లోన్లు మరియు క్రెడిట్ కార్డుల సమాచారం',
    flow_slug: 'service_catalog',
    lead_tag: KNOWN_SERVICE_TAGS.FINANCE_LEAD,
    requirement_fields: ['loan_type', 'employment_type', 'basic_requirement'],
    display_order: 10,
    is_active: true,
  },
  {
    id: 'srv-insurance-referral',
    category_slug: 'insurance',
    slug: 'insurance_enquiry',
    name_en: 'Insurance Enquiry',
    name_te: 'భీమా విచారణ సేవలు',
    description_en: 'Referral inquiry for motor, health, or life insurance solutions',
    description_te: 'వాహన, ఆరోగ్య మరియు జీవిత భీమా పాలసీల విచారణ',
    flow_slug: 'service_catalog',
    lead_tag: KNOWN_SERVICE_TAGS.INSURANCE_LEAD,
    requirement_fields: ['insurance_type', 'coverage_need'],
    display_order: 11,
    is_active: true,
  },

  // 5. Deals & Offers
  {
    id: 'srv-local-deals',
    category_slug: 'deals',
    slug: 'local_deals',
    name_en: 'Local Deals & Coupons',
    name_te: 'స్థానిక ఆఫర్లు & డీల్స్',
    description_en: 'Discover discounts from local shops or register merchant deals',
    description_te: 'స్థానిక దుకాణాల ప్రత్యేక డిస్కౌంట్లు & వ్యాపారుల ఆఫర్ల నమోదు',
    flow_slug: 'service_catalog',
    lead_tag: KNOWN_SERVICE_TAGS.DEAL_SHOPPER,
    requirement_fields: ['deal_interest', 'location'],
    display_order: 12,
    is_active: true,
  },

  // 6. Local Services & Technicians
  {
    id: 'srv-local-technicians',
    category_slug: 'local_services',
    slug: 'local_technicians',
    name_en: 'Local Technicians & Services',
    name_te: 'టెక్నీషియన్లు & గృహ సేవలు',
    description_en: 'Electricians, plumbers, mechanics, catering, and emergency assistance',
    description_te: 'ఎలక్ట్రీషియన్లు, ప్లంబర్లు, మెకానిక్స్, కేటరింగ్ & ఇతర సేవలు',
    flow_slug: 'local_directory',
    lead_tag: KNOWN_SERVICE_TAGS.LOCAL_SERVICE_LEAD,
    requirement_fields: ['service_needed', 'area', 'urgency'],
    display_order: 13,
    is_active: true,
  },

  // 7. WhatsApp Automation for Business
  {
    id: 'srv-wa-automation-lead',
    category_slug: 'wa_automation',
    slug: 'whatsapp_automation',
    name_en: 'WhatsApp Bot & CRM Solution',
    name_te: 'వ్యాపార WhatsApp Bot / CRM',
    description_en: 'Custom automated WhatsApp bot and CRM engine for local businesses',
    description_te: 'మీ వ్యాపారం లేదా షాప్ కోసం ఆటోమేటెడ్ WhatsApp బాట్ మరియు CRM సొల్యూషన్',
    flow_slug: 'service_catalog',
    lead_tag: KNOWN_SERVICE_TAGS.WHATSAPP_AUTOMATION_LEAD,
    requirement_fields: ['business_name', 'business_type', 'automation_goal', 'budget_range'],
    display_order: 14,
    is_active: true,
  },
];

/**
 * Returns all active service categories sorted by display order.
 */
export function listServiceCategories(): ServiceCategory[] {
  return SERVICE_CATEGORIES.filter((c) => c.is_active).sort(
    (a, b) => a.display_order - b.display_order,
  );
}

/**
 * Returns all active services, optionally filtered by category slug.
 */
export function listServices(categorySlug?: string): ServiceDefinition[] {
  return SERVICES.filter((s) => s.is_active && (!categorySlug || s.category_slug === categorySlug)).sort(
    (a, b) => a.display_order - b.display_order,
  );
}

/**
 * Looks up a service by slug.
 */
export function getServiceBySlug(slug: string): ServiceDefinition | null {
  return SERVICES.find((s) => s.slug === slug && s.is_active) ?? null;
}

/**
 * Looks up a category by slug.
 */
export function getCategoryBySlug(slug: string): ServiceCategory | null {
  return SERVICE_CATEGORIES.find((c) => c.slug === slug && c.is_active) ?? null;
}
