import { describe, expect, it } from 'vitest';
import {
  AppError,
  ERROR_TAXONOMY,
  OBSERVABILITY_EVENTS,
  createStructuredLog,
  maskPhone,
  redactSecrets,
} from './logger';

describe('Observability Logger & Safety', () => {
  it('masks phone numbers correctly keeping last 4 digits', () => {
    expect(maskPhone('9441348175')).toBe('******8175');
    expect(maskPhone('+919441348175')).toBe('+91******8175');
    expect(maskPhone('8175')).toBe('****');
    expect(maskPhone('')).toBe('');
    expect(maskPhone(null)).toBe('');
  });

  it('redacts sensitive secret keys recursively', () => {
    const raw = {
      accountId: 'acc-123',
      metaAccessToken: 'EAABwz...',
      verify_token: 'my-verify-token',
      apiKey: 'sec_xyz',
      password: 'password123',
      phoneNumber: '9441348175',
      nested: {
        authorizationHeader: 'Bearer 12345',
        otpCode: '54321',
        user: 'valid_user',
      },
    };

    const redacted = redactSecrets(raw);
    expect(redacted.accountId).toBe('acc-123');
    expect(redacted.metaAccessToken).toBe('[REDACTED]');
    expect(redacted.verify_token).toBe('[REDACTED]');
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.phoneNumber).toBe('******8175');
    expect(redacted.nested.authorizationHeader).toBe('[REDACTED]');
    expect(redacted.nested.otpCode).toBe('[REDACTED]');
    expect(redacted.nested.user).toBe('valid_user');
  });

  it('creates structured log entries with correct taxonomy and timestamp', () => {
    const entry = createStructuredLog(OBSERVABILITY_EVENTS.WEBHOOK_RECEIVED, {
      accountId: 'acc-1',
      metadata: {
        messageId: 'wamid.123',
        senderPhone: '9441348175',
        token: 'secret-token',
      },
    });

    expect(entry.eventType).toBe('webhook_received');
    expect(entry.accountId).toBe('acc-1');
    expect(entry.metadata?.messageId).toBe('wamid.123');
    expect(entry.metadata?.senderPhone).toBe('******8175');
    expect(entry.metadata?.token).toBe('[REDACTED]');
    expect(entry.timestamp).toBeDefined();
  });

  it('supports error taxonomy instantiation via AppError', () => {
    const err = new AppError(
      ERROR_TAXONOMY.WEBHOOK_ERROR,
      'Invalid signature received',
      { reason: 'HMAC mismatch' },
    );

    expect(err.name).toBe('AppError');
    expect(err.code).toBe('WEBHOOK_ERROR');
    expect(err.message).toBe('Invalid signature received');
    expect(err.details?.reason).toBe('HMAC mismatch');
  });
});
