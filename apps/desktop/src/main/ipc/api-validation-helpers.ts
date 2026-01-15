/**
 * API Key Validation Helpers
 *
 * Centralized logic for validating API keys across different providers
 * to ensure consistency and maintainability.
 */

import { getHttpErrorMessage, getNetworkErrorMessage } from '../utils/error-helpers';

const API_KEY_VALIDATION_TIMEOUT_MS = 15000;

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validation context for logging
 */
interface ValidationContext {
  provider: string;
  keyPrefix: string;
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate API key by making a test request
 */
export async function validateApiKey(
  provider: string,
  apiKey: string
): Promise<ValidationResult> {
  const keyPrefix = apiKey.substring(0, 8);
  const context: ValidationContext = { provider, keyPrefix: `${keyPrefix}...` };

  console.log('[API Key] Validation requested', context);

  try {
    const response = await makeValidationRequest(provider, apiKey);

    if (response.ok) {
      console.log('[API Key] Validation succeeded', context);
      return { valid: true };
    }

    return handleValidationError(response, context);
  } catch (error) {
    return handleValidationException(error, context);
  }
}

/**
 * Make validation request based on provider
 */
async function makeValidationRequest(provider: string, apiKey: string): Promise<Response> {
  switch (provider) {
    case 'anthropic':
      return fetchWithTimeout(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
        },
        API_KEY_VALIDATION_TIMEOUT_MS
      );

    case 'openai':
      return fetchWithTimeout(
        'https://api.openai.com/v1/models',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        },
        API_KEY_VALIDATION_TIMEOUT_MS
      );

    case 'google':
      return fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        {
          method: 'GET',
        },
        API_KEY_VALIDATION_TIMEOUT_MS
      );

    case 'groq':
      return fetchWithTimeout(
        'https://api.groq.com/openai/v1/models',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        },
        API_KEY_VALIDATION_TIMEOUT_MS
      );

    case 'custom':
      // For custom provider, skip validation
      console.log('[API Key] Skipping validation for custom provider');
      return Promise.resolve(new Response('{}', { status: 200 }));

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Handle non-OK HTTP response during validation
 */
async function handleValidationError(
  response: Response,
  context: ValidationContext
): Promise<ValidationResult> {
  const errorData = await response.json().catch(() => ({}));
  const apiErrorMessage =
    (errorData as { error?: { message?: string } })?.error?.message ||
    `API returned status ${response.status}`;

  console.warn('[API Key] Validation failed', {
    ...context,
    status: response.status,
    error: apiErrorMessage,
  });

  // Try to get user-friendly message based on status code
  const userMessage = getHttpErrorMessage(response.status, context.provider) || apiErrorMessage;

  return { valid: false, error: userMessage };
}

/**
 * Handle exception during validation (network errors, timeouts, etc.)
 */
function handleValidationException(
  error: unknown,
  context: ValidationContext
): ValidationResult {
  const errorMsg = error instanceof Error ? error.message : String(error);

  console.error('[API Key] Validation error', {
    ...context,
    error: errorMsg,
    stack: error instanceof Error ? error.stack : undefined,
  });

  // Try to get user-friendly message based on error type
  const userMessage =
    getNetworkErrorMessage(errorMsg, context.provider) ||
    'Failed to validate API key. Check your internet connection and try again.';

  return { valid: false, error: userMessage };
}
