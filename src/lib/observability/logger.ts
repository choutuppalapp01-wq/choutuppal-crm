/**
 * Choutuppal CRM — Production Observability, Logging & Error Taxonomy
 *
 * Implements structured event logging, PII masking (phone number masking),
 * secret redaction, and standardized error taxonomy for production operations.
 */

export const OBSERVABILITY_EVENTS = {
  WEBHOOK_RECEIVED: 'webhook_received',
  WEBHOOK_REJECTED: 'webhook_rejected',
  WEBHOOK_DUPLICATE: 'webhook_duplicate',
  FLOW_STARTED: 'flow_started',
  FLOW_COMPLETED: 'flow_completed',
  FLOW_FAILED: 'flow_failed',
  LEAD_CREATED: 'lead_created',
  LEAD_UPDATED: 'lead_updated',
  INTENT_DETECTED: 'intent_detected',
  AI_FALLBACK: 'ai_fallback',
  HUMAN_HANDOFF: 'human_handoff',
  MESSAGE_SEND_ATTEMPT: 'message_send_attempt',
  MESSAGE_SEND_SUCCESS: 'message_send_success',
  MESSAGE_SEND_FAILED: 'message_send_failed',
} as const;

export type ObservabilityEventType =
  (typeof OBSERVABILITY_EVENTS)[keyof typeof OBSERVABILITY_EVENTS];

export const ERROR_TAXONOMY = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  WEBHOOK_ERROR: 'WEBHOOK_ERROR',
  FLOW_ERROR: 'FLOW_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  WHATSAPP_API_ERROR: 'WHATSAPP_API_ERROR',
  AI_ERROR: 'AI_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorTaxonomyCode =
  (typeof ERROR_TAXONOMY)[keyof typeof ERROR_TAXONOMY];

export class AppError extends Error {
  public readonly code: ErrorTaxonomyCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorTaxonomyCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Mask phone number for logs and observability, preserving only the last 4 digits.
 * Example: '9441348175' -> '******8175'
 * Example: '+919441348175' -> '+91******8175'
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return '****';

  if (trimmed.startsWith('+91') && trimmed.length > 7) {
    const last4 = trimmed.slice(-4);
    return `+91******${last4}`;
  }

  const last4 = trimmed.slice(-4);
  return `******${last4}`;
}

const SECRET_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /key/i,
  /authorization/i,
  /auth/i,
  /otp/i,
  /pin/i,
  /cvv/i,
  /cookie/i,
];

/**
 * Recursively redacts sensitive values from objects before logging.
 */
export function redactSecrets<T>(data: T): T {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSecrets(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const cleanObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      const isSecretKey = SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSecretKey) {
        cleanObj[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        cleanObj[key] = redactSecrets(val);
      } else if (typeof val === 'string' && (key.toLowerCase().includes('phone') || key.toLowerCase().includes('mobile'))) {
        cleanObj[key] = maskPhone(val);
      } else {
        cleanObj[key] = val;
      }
    }
    return cleanObj as T;
  }

  return data;
}

export interface StructuredLogEntry {
  timestamp: string;
  eventType: ObservabilityEventType;
  accountId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    code: ErrorTaxonomyCode;
    message: string;
  };
}

/**
 * Emits a structured log safely formatted with PII masking and secret redaction.
 */
export function createStructuredLog(
  eventType: ObservabilityEventType,
  payload: {
    accountId?: string;
    metadata?: Record<string, unknown>;
    error?: { code: ErrorTaxonomyCode; message: string };
  } = {},
): StructuredLogEntry {
  const safeMetadata = payload.metadata ? redactSecrets(payload.metadata) : undefined;
  return {
    timestamp: new Date().toISOString(),
    eventType,
    accountId: payload.accountId,
    metadata: safeMetadata,
    error: payload.error,
  };
}
