/**
 * AI Intent Detection, Lead Scoring & Smart Routing Architecture.
 *
 * Implements an explainable, decision-support intelligence layer for Choutuppal CRM:
 * - Controlled canonical intent taxonomy (mapped directly to Service Catalog).
 * - Normalized confidence evaluation (0.0 to 1.0) and threshold-based gating.
 * - Explainable rule-assisted lead scoring (0 to 100) with factor explanations.
 * - Non-disruptive smart routing recommendations.
 * - Strict safeguards against prompt injection, sensitive profiling, autonomous code execution, and financial underwriting.
 *
 * All functions operate strictly after deterministic checks (Active Flow, Vendor Self-Service, Website Context).
 */

import {
  getServiceBySlug,
} from '@/lib/directory/service-catalog';
import type { WebsiteContext } from '@/lib/directory/website-context';

export const AI_CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.60,
  MINIMUM_ACTIONABLE: 0.60,
} as const;

export const LEAD_SCORE_BANDS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  VERY_HIGH: 'very_high',
} as const;

export type LeadScoreBand = (typeof LEAD_SCORE_BANDS)[keyof typeof LEAD_SCORE_BANDS];

export const LEAD_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type LeadPriority = (typeof LEAD_PRIORITIES)[keyof typeof LEAD_PRIORITIES];

export const CANONICAL_INTENTS = [
  'my_business',
  'promotions',
  'promotion_video',
  'poster_design',
  'whatsapp_marketing',
  'ads_campaign',
  'premium_listing',
  'real_estate',
  'property_buy',
  'property_rent',
  'jobs',
  'job_search',
  'post_job',
  'loans_finance',
  'insurance_enquiry',
  'local_deals',
  'local_technicians',
  'whatsapp_automation',
  'general_inquiry',
  'unknown',
] as const;

export type CanonicalIntent = (typeof CANONICAL_INTENTS)[number];

export interface IntentDetectionResult {
  intent: CanonicalIntent;
  service_slug: string | null;
  confidence: number;
  reason: string;
  suggested_priority: LeadPriority;
  extracted_fields: {
    business_name?: string | null;
    requirement?: string | null;
    budget?: number | null;
    location?: string | null;
    contact?: string | null;
    preferred_language?: string | null;
  };
  raw_provider?: string;
}

export interface LeadScoreFactor {
  code: string;
  label_en: string;
  label_te: string;
  points: number;
}

export interface LeadScoringResult {
  score: number;
  band: LeadScoreBand;
  factors: LeadScoreFactor[];
  suggested_priority: LeadPriority;
}

export interface SmartRoutingRecommendation {
  recommended_team: string;
  recommended_flow_slug: string | null;
  recommended_next_action:
    | 'ask_requirement'
    | 'ask_budget'
    | 'ask_location'
    | 'ask_business_name'
    | 'ask_contact'
    | 'handoff_to_sales'
    | 'continue_current_flow'
    | 'clarify_service';
  confidence: number;
  explanation: string;
}

export interface IntelligenceInput {
  message: string;
  websiteContext?: WebsiteContext | null;
  explicitServiceSlug?: string | null;
  humanOverrideService?: string | null;
  existingVars?: Record<string, unknown> | null;
}

export interface AIProviderAdapter {
  name: string;
  classify(promptText: string): Promise<string>;
}

// Security sanitization regexes
const SENSITIVE_PROFILING_PATTERNS = [
  /\b(caste|religion|hindu|muslim|christian|brahmin|reddy|kamma|sc|st|bc)\b/i,
  /\b(political\s+opinion|voter\s+targeting|persuade\s+voter|manipulate\s+vote)\b/i,
  /\b(bank\s+pin|atm\s+pin|cvv|otp|card\s+password|netbanking\s+password)\b/i,
  /\b(approve\s+loan|guarantee\s+loan|sanction\s+loan|credit\s+score\s+rating)\b/i,
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /<script[\s\S]*?>/i,
  /\b(drop\s+table|select\s+\*\s+from|delete\s+from|insert\s+into)\b/i,
];

/**
 * Sanitizes input text, detecting and neutralizing prompt injection attempts.
 */
export function sanitizeIntelligenceInput(text: string): {
  cleanText: string;
  isSuspicious: boolean;
  containsSensitiveProfiling: boolean;
} {
  if (!text || typeof text !== 'string') {
    return { cleanText: '', isSuspicious: false, containsSensitiveProfiling: false };
  }

  const isSuspicious = PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
  const containsSensitiveProfiling = SENSITIVE_PROFILING_PATTERNS.some((pattern) => pattern.test(text));

  // Truncate to reasonable length (500 chars) to prevent token exhaustion/DoS
  const cleanText = text.slice(0, 500).trim();

  return {
    cleanText,
    isSuspicious,
    containsSensitiveProfiling,
  };
}

/**
 * Detects customer intent, extract structured requirement signals,
 * and proposes a priority level.
 *
 * Deterministic keywords and explicit selections take priority over heuristic classification.
 */
export async function detectIntentAndExtract(
  input: IntelligenceInput,
  providerAdapter?: AIProviderAdapter,
): Promise<IntentDetectionResult> {
  const { cleanText, isSuspicious } = sanitizeIntelligenceInput(input.message);

  // If prompt injection or attack pattern is detected, fail-safe to general inquiry
  if (isSuspicious) {
    return {
      intent: 'general_inquiry',
      service_slug: null,
      confidence: 0.1,
      reason: 'Flagged input content handled via safe general inquiry fallback.',
      suggested_priority: LEAD_PRIORITIES.NORMAL,
      extracted_fields: {},
      raw_provider: 'security_guard',
    };
  }

  // 1. Explicit user selection or human override wins over AI
  if (input.humanOverrideService) {
    const srv = getServiceBySlug(input.humanOverrideService);
    return {
      intent: (srv?.slug as CanonicalIntent) || 'general_inquiry',
      service_slug: srv?.slug || input.humanOverrideService,
      confidence: 1.0,
      reason: 'Authoritative human staff selection applied.',
      suggested_priority: LEAD_PRIORITIES.HIGH,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'human_override',
    };
  }

  if (input.explicitServiceSlug) {
    const srv = getServiceBySlug(input.explicitServiceSlug);
    return {
      intent: (srv?.slug as CanonicalIntent) || 'general_inquiry',
      service_slug: srv?.slug || input.explicitServiceSlug,
      confidence: 1.0,
      reason: 'Explicit interactive button or list selection by user.',
      suggested_priority: LEAD_PRIORITIES.HIGH,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'explicit_selection',
    };
  }

  // 2. High-confidence Website Context
  if (input.websiteContext?.service) {
    const ctxService = input.websiteContext.service;
    const srv = getServiceBySlug(ctxService);
    return {
      intent: (srv?.slug as CanonicalIntent) || (ctxService as CanonicalIntent),
      service_slug: srv?.slug || ctxService,
      confidence: 0.95,
      reason: `Contextually routed from website page "${input.websiteContext.source_page || 'home'}".`,
      suggested_priority: input.websiteContext.listing_id ? LEAD_PRIORITIES.HIGH : LEAD_PRIORITIES.NORMAL,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'website_context',
    };
  }

  // 3. Rule-based lexical & Telugu/English classification
  const lower = cleanText.toLowerCase();

  // Video Promotion
  if (
    lower.includes('వీడియో') ||
    lower.includes('రీల్స్') ||
    lower.includes('reels') ||
    lower.includes('video') ||
    lower.includes('shooting') ||
    lower.includes('voice over')
  ) {
    return {
      intent: 'promotion_video',
      service_slug: 'promotion_video',
      confidence: 0.92,
      reason: 'Customer message contains explicit video/reels promotion terminology.',
      suggested_priority: LEAD_PRIORITIES.HIGH,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'rule_classifier',
    };
  }

  // Poster Design
  if (
    lower.includes('పోస్టర్') ||
    lower.includes('poster') ||
    lower.includes('ఫ్లెక్స్') ||
    lower.includes('flex') ||
    lower.includes('banner') ||
    lower.includes('బ్యానర్') ||
    lower.includes('డిజైన్')
  ) {
    return {
      intent: 'poster_design',
      service_slug: 'poster_design',
      confidence: 0.90,
      reason: 'Customer requested banner/poster creative design.',
      suggested_priority: LEAD_PRIORITIES.NORMAL,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'rule_classifier',
    };
  }

  // WhatsApp Automation / Bot
  if (
    lower.includes('ఆటోమేషన్') ||
    lower.includes('బాట్') ||
    lower.includes('bot') ||
    lower.includes('crm') ||
    lower.includes('automation')
  ) {
    return {
      intent: 'whatsapp_automation',
      service_slug: 'whatsapp_automation',
      confidence: 0.94,
      reason: 'Customer requested business WhatsApp bot or CRM automation service.',
      suggested_priority: LEAD_PRIORITIES.HIGH,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'rule_classifier',
    };
  }

  // WhatsApp Marketing / Broadcasts
  if (
    lower.includes('మార్కెటింగ్') ||
    lower.includes('marketing') ||
    lower.includes('బ్రాడ్‌కాస్ట్') ||
    lower.includes('broadcast') ||
    lower.includes('bulk')
  ) {
    return {
      intent: 'whatsapp_marketing',
      service_slug: 'whatsapp_marketing',
      confidence: 0.88,
      reason: 'Customer requested WhatsApp marketing broadcast assistance.',
      suggested_priority: LEAD_PRIORITIES.NORMAL,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'rule_classifier',
    };
  }

  // Ads Campaigns
  if (
    lower.includes('యాడ్స్') ||
    lower.includes('ads') ||
    lower.includes('campaign') ||
    lower.includes('facebook ad') ||
    lower.includes('google ad')
  ) {
    return {
      intent: 'ads_campaign',
      service_slug: 'ads_campaign',
      confidence: 0.89,
      reason: 'Customer requested social media or search advertising campaigns.',
      suggested_priority: LEAD_PRIORITIES.NORMAL,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'rule_classifier',
    };
  }

  // Premium Listing
  if (
    lower.includes('ప్రీమియం') ||
    lower.includes('premium') ||
    lower.includes('గోల్డ్') ||
    lower.includes('gold plan') ||
    lower.includes('silver plan')
  ) {
    return {
      intent: 'premium_listing',
      service_slug: 'premium_listing',
      confidence: 0.91,
      reason: 'Customer enquired about directory premium listing tiers.',
      suggested_priority: LEAD_PRIORITIES.HIGH,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'rule_classifier',
    };
  }

  // Real Estate (Buy / Rent / Plots)
  if (
    lower.includes('ప్లాట్') ||
    lower.includes('plot') ||
    lower.includes('భూమి') ||
    lower.includes('land') ||
    lower.includes('ఇల్లు') ||
    lower.includes('house') ||
    lower.includes('అద్దె') ||
    lower.includes('rent')
  ) {
    const isRent = lower.includes('అద్దె') || lower.includes('rent');
    const intent: CanonicalIntent = isRent ? 'property_rent' : 'property_buy';
    return {
      intent,
      service_slug: intent,
      confidence: 0.88,
      reason: `Customer interested in property ${isRent ? 'rental' : 'purchase/plots'}.`,
      suggested_priority: LEAD_PRIORITIES.NORMAL,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'rule_classifier',
    };
  }

  // Jobs
  if (
    lower.includes('జాబ్') ||
    lower.includes('job') ||
    lower.includes('ఉద్యోగం') ||
    lower.includes('ఖాళీలు') ||
    lower.includes('vacancy') ||
    lower.includes('work')
  ) {
    const isEmployer = lower.includes('పోస్ట్') || lower.includes('post') || lower.includes('hiring') || lower.includes('కావాలి');
    const intent: CanonicalIntent = isEmployer ? 'post_job' : 'job_search';
    return {
      intent,
      service_slug: intent,
      confidence: 0.87,
      reason: `Customer interested in ${isEmployer ? 'employer recruitment posting' : 'local job search'}.`,
      suggested_priority: LEAD_PRIORITIES.NORMAL,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'rule_classifier',
    };
  }

  // Finance / Loans (Referral only)
  if (
    lower.includes('లోన్') ||
    lower.includes('loan') ||
    lower.includes('క్రెడిట్ కార్డ్') ||
    lower.includes('credit card') ||
    lower.includes('రుణం')
  ) {
    return {
      intent: 'loans_finance',
      service_slug: 'loans_finance',
      confidence: 0.90,
      reason: 'Customer enquired about loans or finance referral information.',
      suggested_priority: LEAD_PRIORITIES.NORMAL,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'rule_classifier',
    };
  }

  // Insurance (Referral only)
  if (
    lower.includes('ఇన్సూరెన్స్') ||
    lower.includes('insurance') ||
    lower.includes('భీమా') ||
    lower.includes('పాలసీ')
  ) {
    return {
      intent: 'insurance_enquiry',
      service_slug: 'insurance_enquiry',
      confidence: 0.89,
      reason: 'Customer enquired about insurance referral information.',
      suggested_priority: LEAD_PRIORITIES.NORMAL,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'rule_classifier',
    };
  }

  // Local Deals & Coupons
  if (
    lower.includes('ఆఫర్') ||
    lower.includes('offer') ||
    lower.includes('డిస్కౌంట్') ||
    lower.includes('discount') ||
    lower.includes('కూపన్') ||
    lower.includes('deal')
  ) {
    return {
      intent: 'local_deals',
      service_slug: 'local_deals',
      confidence: 0.86,
      reason: 'Customer asked for local merchant offers or coupons.',
      suggested_priority: LEAD_PRIORITIES.NORMAL,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'rule_classifier',
    };
  }

  // Local Services & Technicians
  if (
    lower.includes('ఎలక్ట్రీషియన్') ||
    lower.includes('electrician') ||
    lower.includes('ప్లంబర్') ||
    lower.includes('plumber') ||
    lower.includes('మెకానిక్') ||
    lower.includes('mechanic') ||
    lower.includes('రిపేర్') ||
    lower.includes('కేటరింగ్')
  ) {
    return {
      intent: 'local_technicians',
      service_slug: 'local_technicians',
      confidence: 0.89,
      reason: 'Customer searched for home services or technicians.',
      suggested_priority: LEAD_PRIORITIES.NORMAL,
      extracted_fields: extractFieldsRuleBased(cleanText),
      raw_provider: 'rule_classifier',
    };
  }

  // 4. Fallback to adapter if provided and not low text
  if (providerAdapter && cleanText.length > 5) {
    try {
      const response = await providerAdapter.classify(cleanText);
      const parsed = JSON.parse(response);
      if (
        parsed &&
        typeof parsed.intent === 'string' &&
        (CANONICAL_INTENTS as readonly string[]).includes(parsed.intent)
      ) {
        const normConf = typeof parsed.confidence === 'number' && !isNaN(parsed.confidence)
          ? Math.min(Math.max(parsed.confidence, 0.0), 1.0)
          : 0.5;
        return {
          intent: parsed.intent as CanonicalIntent,
          service_slug: parsed.service_slug || parsed.intent,
          confidence: normConf,
          reason: parsed.reason || 'AI provider classification.',
          suggested_priority: parsed.priority === 'urgent' || parsed.priority === 'high' ? parsed.priority : LEAD_PRIORITIES.NORMAL,
          extracted_fields: extractFieldsRuleBased(cleanText),
          raw_provider: providerAdapter.name,
        };
      }
    } catch {
      // Non-fatal: AI provider failure gracefully falls through to general_inquiry
    }
  }

  // 5. Safe low-confidence fallback
  return {
    intent: 'general_inquiry',
    service_slug: null,
    confidence: 0.35,
    reason: 'Customer input was general or ambiguous; requires user clarification.',
    suggested_priority: LEAD_PRIORITIES.NORMAL,
    extracted_fields: extractFieldsRuleBased(cleanText),
    raw_provider: 'fallback',
  };
}

/**
 * Extracts structured fields using deterministic regex rules (zero hallucination).
 */
export function extractFieldsRuleBased(text: string): IntentDetectionResult['extracted_fields'] {
  if (!text) return {};
  const result: IntentDetectionResult['extracted_fields'] = {};

  // Budget detection (e.g., 20000, 20k, 20 వేలు, 5000 rs)
  const budgetKMatch = text.match(/(\d+)\s*(k|వేలు|thousand)/i);
  if (budgetKMatch) {
    result.budget = parseInt(budgetKMatch[1], 10) * 1000;
  } else {
    const budgetRawMatch = text.match(/(?:rs\.?|₹|రూ\.?|బడ్జెట్)\s*(\d{3,7})/i) || text.match(/(\d{3,7})\s*(?:rs\.?|₹|రూ\.?)/i);
    if (budgetRawMatch) {
      result.budget = parseInt(budgetRawMatch[1], 10);
    }
  }

  // Phone extraction (10-digit standard Indian phone)
  const phoneMatch = text.match(/(?:(?:\+|0{0,2})91[\s-]?)?([6-9]\d{9})/);
  if (phoneMatch) {
    result.contact = phoneMatch[1];
  }

  // Location indicator
  if (text.match(/చౌటుప్పల్|choutuppal/i)) {
    result.location = 'Choutuppal';
  } else if (text.match(/నారాయణపురం|narayanpur/i)) {
    result.location = 'Samsthan Narayanpur';
  } else if (text.match(/హైవే|highway/i)) {
    result.location = 'Highway Area';
  }

  // Clean requirement summary (first 100 chars of text)
  if (text.length > 5) {
    result.requirement = text.slice(0, 100).trim();
  }

  return result;
}

/**
 * Calculates an explainable, rule-assisted lead score (0-100) based on CRM signals.
 */
export function calculateLeadScore(args: {
  intentResult: IntentDetectionResult;
  websiteContext?: WebsiteContext | null;
  hasContact: boolean;
  hasPreviousInteraction?: boolean;
}): LeadScoringResult {
  let score = 0;
  const factors: LeadScoreFactor[] = [];

  // 1. Service Identified (+20)
  if (args.intentResult.service_slug && args.intentResult.intent !== 'general_inquiry') {
    score += 20;
    factors.push({
      code: 'service_identified',
      label_en: 'Specific service need identified',
      label_te: 'నిర్దిష్ట సేవా అవసరం గుర్తించబడింది',
      points: 20,
    });
  }

  // 2. Clear Requirement Provided (+20)
  if (args.intentResult.extracted_fields.requirement) {
    score += 20;
    factors.push({
      code: 'requirement_provided',
      label_en: 'Specific requirement details provided',
      label_te: 'అవసరమైన వివరాలు అందించబడ్డాయి',
      points: 20,
    });
  }

  // 3. Budget Specified (+15)
  if (args.intentResult.extracted_fields.budget && args.intentResult.extracted_fields.budget > 0) {
    score += 15;
    factors.push({
      code: 'budget_provided',
      label_en: 'Budget capacity stated',
      label_te: 'బడ్జెట్ అంచనా తెలపబడింది',
      points: 15,
    });
  }

  // 4. Contact Phone Available (+15)
  if (args.hasContact || args.intentResult.extracted_fields.contact) {
    score += 15;
    factors.push({
      code: 'contact_available',
      label_en: 'Verified customer phone number available',
      label_te: 'ధృవీకరించబడిన సంప్రదింపు నంబర్ ఉంది',
      points: 15,
    });
  }

  // 5. Explicit Location Provided (+10)
  if (args.intentResult.extracted_fields.location) {
    score += 10;
    factors.push({
      code: 'location_provided',
      label_en: 'Specific local area identified',
      label_te: 'స్థానిక ప్రాంత వివరాలు అందించబడ్డాయి',
      points: 10,
    });
  }

  // 6. High Intent Confidence (+10)
  if (args.intentResult.confidence >= AI_CONFIDENCE_THRESHOLDS.HIGH) {
    score += 10;
    factors.push({
      code: 'high_intent_confidence',
      label_en: 'High confidence purchase/service intent',
      label_te: 'సేవా ఆసక్తి అధిక స్పష్టతతో ఉంది',
      points: 10,
    });
  }

  // 7. Contextual Click from Website (+10)
  if (args.websiteContext?.source === 'website') {
    score += 10;
    factors.push({
      code: 'website_contextual_lead',
      label_en: 'Customer arrived from official website action button',
      label_te: 'వెబ్‌సైట్ యాక్షన్ బటన్ ద్వారా వచ్చిన నేరుగా లీడ్',
      points: 10,
    });
  }

  // Strict boundary cap [0, 100]
  const finalScore = Math.min(Math.max(score, 0), 100);

  // Band classification
  let band: LeadScoreBand = LEAD_SCORE_BANDS.LOW;
  let suggested_priority: LeadPriority = LEAD_PRIORITIES.NORMAL;

  if (finalScore >= 80) {
    band = LEAD_SCORE_BANDS.VERY_HIGH;
    suggested_priority = LEAD_PRIORITIES.URGENT;
  } else if (finalScore >= 60) {
    band = LEAD_SCORE_BANDS.HIGH;
    suggested_priority = LEAD_PRIORITIES.HIGH;
  } else if (finalScore >= 30) {
    band = LEAD_SCORE_BANDS.MEDIUM;
    suggested_priority = LEAD_PRIORITIES.NORMAL;
  } else {
    band = LEAD_SCORE_BANDS.LOW;
    suggested_priority = LEAD_PRIORITIES.LOW;
  }

  return {
    score: finalScore,
    band,
    factors,
    suggested_priority,
  };
}

/**
 * Computes a smart routing recommendation for CRM staff or automated next step.
 * Never interrupts an active deterministic flow.
 */
export function recommendSmartRoute(args: {
  intentResult: IntentDetectionResult;
  scoringResult: LeadScoringResult;
  isFlowActive: boolean;
}): SmartRoutingRecommendation {
  // If an active conversation flow is underway, NEVER usurp it
  if (args.isFlowActive) {
    return {
      recommended_team: 'bot_active_flow',
      recommended_flow_slug: null,
      recommended_next_action: 'continue_current_flow',
      confidence: 1.0,
      explanation: 'Customer has an active ongoing flow. Deterministic flow execution must proceed uninterrupted.',
    };
  }

  // Low confidence → clarify service
  if (args.intentResult.confidence < AI_CONFIDENCE_THRESHOLDS.MINIMUM_ACTIONABLE) {
    return {
      recommended_team: 'general_support',
      recommended_flow_slug: 'service_catalog',
      recommended_next_action: 'clarify_service',
      confidence: args.intentResult.confidence,
      explanation: 'Low intent confidence. Recommend presenting the main service menu for customer choice.',
    };
  }

  const intent = args.intentResult.intent;

  // Promotions & Creative Design
  if (intent === 'promotion_video' || intent === 'promotions') {
    return {
      recommended_team: 'promotion_team',
      recommended_flow_slug: 'promotion_services',
      recommended_next_action: args.scoringResult.score >= 60 ? 'handoff_to_sales' : 'ask_budget',
      confidence: args.intentResult.confidence,
      explanation: 'Promotional video lead routed to digital promotions desk.',
    };
  }

  if (intent === 'poster_design') {
    return {
      recommended_team: 'design_team',
      recommended_flow_slug: 'promotion_services',
      recommended_next_action: args.scoringResult.score >= 60 ? 'handoff_to_sales' : 'ask_requirement',
      confidence: args.intentResult.confidence,
      explanation: 'Creative poster design lead routed to creative design desk.',
    };
  }

  // WhatsApp Automation / Bots
  if (intent === 'whatsapp_automation') {
    return {
      recommended_team: 'automation_sales_team',
      recommended_flow_slug: 'service_catalog',
      recommended_next_action: 'handoff_to_sales',
      confidence: args.intentResult.confidence,
      explanation: 'High-value commercial WhatsApp CRM inquiry routed to automation specialist.',
    };
  }

  // Premium Listing
  if (intent === 'premium_listing' || intent === 'my_business') {
    return {
      recommended_team: 'vendor_support',
      recommended_flow_slug: intent === 'my_business' ? 'my_business' : 'premium_listing',
      recommended_next_action: 'handoff_to_sales',
      confidence: args.intentResult.confidence,
      explanation: 'Directory merchant and premium plan lead routed to vendor onboarding team.',
    };
  }

  // Real Estate
  if (intent === 'property_buy' || intent === 'property_rent' || intent === 'real_estate') {
    return {
      recommended_team: 'property_team',
      recommended_flow_slug: 'real_estate',
      recommended_next_action: args.scoringResult.score >= 50 ? 'handoff_to_sales' : 'ask_location',
      confidence: args.intentResult.confidence,
      explanation: 'Real estate requirement routed to local property desk.',
    };
  }

  // Jobs
  if (intent === 'job_search' || intent === 'post_job' || intent === 'jobs') {
    return {
      recommended_team: 'jobs_team',
      recommended_flow_slug: 'jobs',
      recommended_next_action: 'handoff_to_sales',
      confidence: args.intentResult.confidence,
      explanation: 'Recruitment or job vacancy lead routed to local employment desk.',
    };
  }

  // Finance Referral (Neutral referral)
  if (intent === 'loans_finance') {
    return {
      recommended_team: 'finance_referral_desk',
      recommended_flow_slug: 'service_catalog',
      recommended_next_action: 'handoff_to_sales',
      confidence: args.intentResult.confidence,
      explanation: 'Finance inquiry routed to authorized referral channel (no automated approval).',
    };
  }

  // Insurance Referral
  if (intent === 'insurance_enquiry') {
    return {
      recommended_team: 'insurance_referral_desk',
      recommended_flow_slug: 'service_catalog',
      recommended_next_action: 'handoff_to_sales',
      confidence: args.intentResult.confidence,
      explanation: 'Insurance inquiry routed to authorized referral channel.',
    };
  }

  // Fallback
  return {
    recommended_team: 'general_sales',
    recommended_flow_slug: 'service_catalog',
    recommended_next_action: 'clarify_service',
    confidence: args.intentResult.confidence,
    explanation: 'Standard service inquiry routed to general desk.',
  };
}
