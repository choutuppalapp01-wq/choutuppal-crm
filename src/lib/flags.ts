/**
 * Feature Flags Configuration.
 *
 * Controls safe progressive rollout of Choutuppal CRM capabilities.
 * All new modules default to false unless explicitly enabled via environment variables.
 */

export const FEATURE_FLAGS = {
  FEATURE_WELCOME: "FEATURE_WELCOME",
  FEATURE_DIRECTORY: "FEATURE_DIRECTORY",
  FEATURE_VENDOR: "FEATURE_VENDOR",
  FEATURE_PREMIUM: "FEATURE_PREMIUM",
  FEATURE_PROMOTION: "FEATURE_PROMOTION",
  FEATURE_VIDEO: "FEATURE_VIDEO",
  FEATURE_DESIGN: "FEATURE_DESIGN",
  FEATURE_WHATSAPP_MARKETING: "FEATURE_WHATSAPP_MARKETING",
  FEATURE_ADS: "FEATURE_ADS",
  FEATURE_REAL_ESTATE: "FEATURE_REAL_ESTATE",
  FEATURE_JOBS: "FEATURE_JOBS",
  FEATURE_DEALS: "FEATURE_DEALS",
  FEATURE_FINANCE: "FEATURE_FINANCE",
  FEATURE_INSURANCE: "FEATURE_INSURANCE",
  FEATURE_AFFILIATE: "FEATURE_AFFILIATE",
  FEATURE_WEBSITE_CONTEXT: "FEATURE_WEBSITE_CONTEXT",
  FEATURE_VENDOR_SELF_SERVICE: "FEATURE_VENDOR_SELF_SERVICE",
  FEATURE_SERVICE_CATALOG: "FEATURE_SERVICE_CATALOG",
  FEATURE_AI_INTENT: "FEATURE_AI_INTENT",
  FEATURE_AI_BEHAVIOUR: "FEATURE_AI_BEHAVIOUR",
  FEATURE_AI_RECOMMENDATION: "FEATURE_AI_RECOMMENDATION",
  FEATURE_AI_ADMIN: "FEATURE_AI_ADMIN",
} as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

const DEFAULT_FLAG_STATE: Record<FeatureFlag, boolean> = {
  FEATURE_SERVICE_CATALOG: false,
  FEATURE_WELCOME: false,
  FEATURE_DIRECTORY: false,
  FEATURE_VENDOR: false,
  FEATURE_PREMIUM: false,
  FEATURE_PROMOTION: false,
  FEATURE_VIDEO: false,
  FEATURE_DESIGN: false,
  FEATURE_WHATSAPP_MARKETING: false,
  FEATURE_ADS: false,
  FEATURE_REAL_ESTATE: false,
  FEATURE_JOBS: false,
  FEATURE_DEALS: false,
  FEATURE_FINANCE: false,
  FEATURE_INSURANCE: false,
  FEATURE_AFFILIATE: false,
  FEATURE_WEBSITE_CONTEXT: false,
  FEATURE_VENDOR_SELF_SERVICE: false,
  FEATURE_AI_INTENT: false,
  FEATURE_AI_BEHAVIOUR: false,
  FEATURE_AI_RECOMMENDATION: false,
  FEATURE_AI_ADMIN: false,
};

/**
 * Checks whether a feature flag is enabled.
 * Evaluates process.env[flagName] against 'true' | '1', falling back to safe default (false).
 */
export function isFeatureEnabled(
  flag: FeatureFlag,
  envOverrides?: Record<string, string | undefined>,
): boolean {
  const env = envOverrides ?? process.env;
  const envVal = env[flag]?.trim().toLowerCase();
  if (envVal === "true" || envVal === "1") return true;
  if (envVal === "false" || envVal === "0") return false;
  return DEFAULT_FLAG_STATE[flag] ?? false;
}

/**
 * Returns a snapshot of all feature flag states.
 */
export function getAllFeatureFlags(
  envOverrides?: Record<string, string | undefined>,
): Record<FeatureFlag, boolean> {
  const result = {} as Record<FeatureFlag, boolean>;
  for (const flag of Object.values(FEATURE_FLAGS)) {
    result[flag] = isFeatureEnabled(flag, envOverrides);
  }
  return result;
}
