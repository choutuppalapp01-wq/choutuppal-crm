import { NextResponse } from 'next/server';
import { isFeatureEnabled, FEATURE_FLAGS } from '@/lib/flags';

/**
 * Production Readiness & Health Check Endpoint
 *
 * Safe read-only inspection endpoint for uptime monitoring, deployment verification,
 * and operational health checks.
 *
 * SAFETY GUARANTEES:
 * - NEVER executes database writes or mutations.
 * - NEVER exposes secret keys, tokens, or credentials.
 * - Returns booleans and high-level health state only.
 */
export async function GET() {
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const isMetaConfigured = Boolean(
    process.env.META_APP_SECRET ||
    process.env.META_APP_ID
  );

  const isEncryptionConfigured = Boolean(
    process.env.ENCRYPTION_KEY
  );

  const isHealthy = isSupabaseConfigured && isEncryptionConfigured;

  const responseBody = {
    status: isHealthy ? 'healthy' : 'degraded',
    version: '0.8.0',
    timestamp: new Date().toISOString(),
    checks: {
      supabase_configured: isSupabaseConfigured,
      meta_webhook_configured: isMetaConfigured,
      encryption_configured: isEncryptionConfigured,
    },
    features: {
      website_context: isFeatureEnabled(FEATURE_FLAGS.FEATURE_WEBSITE_CONTEXT),
      vendor_self_service: isFeatureEnabled(FEATURE_FLAGS.FEATURE_VENDOR_SELF_SERVICE),
      ai_intent: isFeatureEnabled(FEATURE_FLAGS.FEATURE_AI_INTENT),
    },
  };

  return NextResponse.json(responseBody, {
    status: isHealthy ? 200 : 503,
  });
}
