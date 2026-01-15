/**
 * Unit tests for global error handlers
 *
 * Tests the unhandled rejection and uncaught exception handlers
 * registered in the main process to ensure they properly log errors
 * and prevent app crashes.
 *
 * @module __tests__/unit/main/error-handlers.unit.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Global Error Handlers', () => {
  let originalConsoleError: typeof console.error;
  let consoleErrorSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Save original console.error
    originalConsoleError = console.error;
    // Create spy for console.error
    consoleErrorSpy = vi.fn();
    console.error = consoleErrorSpy;
  });

  afterEach(() => {
    // Restore original console.error
    console.error = originalConsoleError;
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Unhandled Promise Rejection Handler', () => {
    it('should log rejection with error details', () => {
      const testError = new Error('Test unhandled rejection');
      const testPromise = Promise.reject(testError);

      // Emit unhandledRejection event
      process.emit('unhandledRejection', testError, testPromise);

      // Should have logged the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Main] Unhandled Promise Rejection:',
        expect.objectContaining({
          reason: 'Test unhandled rejection',
          stack: expect.stringContaining('Test unhandled rejection'),
        })
      );

      // Should have logged full details
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Main] Full rejection details:', testError);

      // Cleanup - prevent actual unhandled rejection
      testPromise.catch(() => {});
    });

    it('should handle non-Error rejections', () => {
      const testReason = 'Plain string rejection';
      const testPromise = Promise.reject(testReason);

      // Emit unhandledRejection event
      process.emit('unhandledRejection', testReason, testPromise);

      // Should have logged the rejection
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Main] Unhandled Promise Rejection:',
        expect.objectContaining({
          reason: 'Plain string rejection',
          stack: undefined,
        })
      );

      // Cleanup
      testPromise.catch(() => {});
    });

    it('should handle undefined/null rejections', () => {
      const testPromise = Promise.reject(null);

      // Emit unhandledRejection event
      process.emit('unhandledRejection', null, testPromise);

      // Should have logged without crashing
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Cleanup
      testPromise.catch(() => {});
    });
  });

  describe('Uncaught Exception Handler', () => {
    it('should log exception details', () => {
      const testError = new Error('Test uncaught exception');
      testError.stack = 'Error: Test uncaught exception\n    at test.js:1:1';

      // Mock process.exit to prevent actual exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        process.emit('uncaughtException', testError);
      } catch (e) {
        // Expected - process.exit throws
      }

      // Should have logged the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Main] Uncaught Exception:',
        expect.objectContaining({
          message: 'Test uncaught exception',
          stack: expect.stringContaining('Test uncaught exception'),
          name: 'Error',
        })
      );

      // Should have logged full error
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Main] Full exception:', testError);

      // Should have attempted to exit
      expect(exitSpy).toHaveBeenCalledWith(1);

      // Cleanup
      exitSpy.mockRestore();
    });

    it('should handle cleanup errors gracefully', () => {
      const testError = new Error('Test exception');

      // Mock process.exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        process.emit('uncaughtException', testError);
      } catch (e) {
        // Expected
      }

      // Should still have attempted to exit even if cleanup fails
      expect(exitSpy).toHaveBeenCalledWith(1);

      // Cleanup
      exitSpy.mockRestore();
    });
  });

  describe('Error Handler Robustness', () => {
    it('should handle errors with circular references', () => {
      interface CircularObject {
        self?: CircularObject;
        message: string;
      }

      const circular: CircularObject = { message: 'circular error' };
      circular.self = circular;

      const testPromise = Promise.reject(circular);

      // Should not throw when logging
      expect(() => {
        process.emit('unhandledRejection', circular, testPromise);
      }).not.toThrow();

      // Should have logged something
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Cleanup
      testPromise.catch(() => {});
    });

    it('should handle very large error stacks', () => {
      const error = new Error('Test');
      error.stack = 'Error: Test\n' + '    at frame\n'.repeat(10000);

      const testPromise = Promise.reject(error);

      // Should not throw when logging large stacks
      expect(() => {
        process.emit('unhandledRejection', error, testPromise);
      }).not.toThrow();

      // Cleanup
      testPromise.catch(() => {});
    });
  });
});
