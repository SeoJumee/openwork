/**
 * Error handling utilities for improved error management
 *
 * Centralizes error handling logic to ensure consistency and maintainability
 * across the application.
 */

/**
 * Safely execute cleanup functions that may throw errors
 * Ensures cleanup runs even if one step fails
 */
export async function safeCleanup(
  cleanupFns: Array<() => void | Promise<void>>,
  context: string
): Promise<void> {
  const errors: Error[] = [];

  for (const fn of cleanupFns) {
    try {
      await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      console.error(`[${context}] Cleanup function failed:`, err);
    }
  }

  if (errors.length > 0) {
    console.warn(`[${context}] ${errors.length} cleanup function(s) failed, but continuing...`);
  }
}

/**
 * Execute a callback with error handling
 * Prevents unhandled rejections when callbacks themselves throw
 */
export async function safeCallback<T>(
  callback: () => T | Promise<T>,
  errorHandler: (error: Error) => void,
  context: string
): Promise<void> {
  try {
    await callback();
  } catch (error) {
    try {
      const err = error instanceof Error ? error : new Error(String(error));
      errorHandler(err);
    } catch (handlerError) {
      console.error(
        `[${context}] Error handler itself failed:`,
        handlerError instanceof Error ? handlerError.message : String(handlerError)
      );
      // Don't throw - we've done our best
    }
  }
}

/**
 * Map HTTP status codes to user-friendly error messages
 */
export function getHttpErrorMessage(statusCode: number, provider: string): string | null {
  switch (statusCode) {
    case 401:
      return 'Invalid API key. Please check that you copied the key correctly.';
    case 403:
      return 'API key does not have permission to access this resource.';
    case 429:
      return 'Rate limit exceeded. Please try again in a few moments.';
    case 500:
    case 502:
    case 503:
    case 504:
      return `${provider.charAt(0).toUpperCase() + provider.slice(1)} API is experiencing issues. Please try again later.`;
    default:
      return null;
  }
}

/**
 * Detect and explain network errors
 */
export function getNetworkErrorMessage(errorMessage: string, provider: string): string | null {
  if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
    return `Cannot reach ${provider.charAt(0).toUpperCase() + provider.slice(1)} API. Please check your internet connection.`;
  }
  if (errorMessage.includes('ECONNREFUSED')) {
    return 'Connection refused. Please check your firewall settings.';
  }
  if (errorMessage.includes('ETIMEDOUT')) {
    return 'Connection timed out. Please check your internet connection.';
  }
  if (errorMessage.includes('AbortError')) {
    return 'Request timed out after 15 seconds. Please check your internet connection and try again.';
  }
  return null;
}

/**
 * Create a safe timeout that always cleans up
 * Returns a cleanup function that MUST be called
 */
export function createSafeTimeout(
  callback: () => void,
  delayMs: number
): { timeoutId: NodeJS.Timeout; cleanup: () => void } {
  const timeoutId = setTimeout(callback, delayMs);
  let cleaned = false;

  const cleanup = () => {
    if (!cleaned) {
      clearTimeout(timeoutId);
      cleaned = true;
    }
  };

  return { timeoutId, cleanup };
}
