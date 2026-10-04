import { beforeEach, describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/health', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns healthy 200 status when required environment variables are set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.ENCRYPTION_KEY = 'test-encryption-key';

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('healthy');
    expect(json.version).toBe('0.8.0');
    expect(json.timestamp).toBeDefined();

    // Verify non-secret booleans
    expect(json.checks.supabase_configured).toBe(true);
    expect(json.checks.encryption_configured).toBe(true);

    // Verify feature flags presence
    expect(json.features).toHaveProperty('website_context');
    expect(json.features).toHaveProperty('vendor_self_service');
    expect(json.features).toHaveProperty('ai_intent');

    // Confirm absolutely no token or secret strings leaked in json
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain('test-service-key');
    expect(serialized).not.toContain('test-encryption-key');
  });

  it('returns degraded 503 status when required environment variables are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ENCRYPTION_KEY;

    const res = await GET();
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.status).toBe('degraded');
    expect(json.checks.supabase_configured).toBe(false);
  });
});
