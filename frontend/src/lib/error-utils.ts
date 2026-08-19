/**
 * Reusable Frontend API Error Extraction Utility.
 * 
 * Safely normalizes errors from Axios, FastAPI, network failures,
 * structured JSON responses, and standard JavaScript Error objects
 * into clean, user-friendly, human-readable strings.
 * 
 * Prevents `[object Object]` from ever rendering in the UI.
 */

export function extractErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!error) return fallback;

  // 1. Primitive string error
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed && trimmed !== '[object Object]' ? trimmed : fallback;
  }

  const err = error as any;

  // 2. Axios Response Error
  if (err.response) {
    const data = err.response.data;
    const status = err.response.status;

    if (data) {
      // 2a. Backend custom AppException shape: { error: { message: "...", status_code: 409 } }
      if (data.error && typeof data.error === 'object' && typeof data.error.message === 'string') {
        const msg = data.error.message.trim();
        if (msg) return msg;
      }

      // 2b. Direct detail field as string: { detail: "..." }
      if (typeof data.detail === 'string') {
        const msg = data.detail.trim();
        if (msg) return msg;
      }

      // 2c. FastAPI 422 Validation Error array: { detail: [ { loc: [...], msg: "field required" } ] }
      if (Array.isArray(data.detail) && data.detail.length > 0) {
        const formattedErrors = data.detail
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
              const field = Array.isArray(item.loc)
                ? item.loc.filter((p: any) => p !== 'body').join(' ')
                : '';
              const msg = item.msg || item.message || 'Invalid value';
              return field ? `${field}: ${msg}` : msg;
            }
            return null;
          })
          .filter(Boolean);

        if (formattedErrors.length > 0) {
          return `Validation error: ${formattedErrors.join(', ')}`;
        }
      }

      // 2d. Detail as object
      if (data.detail && typeof data.detail === 'object' && typeof data.detail.message === 'string') {
        const msg = data.detail.message.trim();
        if (msg) return msg;
      }

      // 2e. Direct message field: { message: "..." }
      if (typeof data.message === 'string') {
        const msg = data.message.trim();
        if (msg) return msg;
      }
    }

    // Status code fallback mapping
    switch (status) {
      case 400:
        return 'Please check the information you entered.';
      case 401:
        return 'Invalid email or password.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'A record with this information already exists.';
      case 422:
        return 'Please correct the highlighted fields and try again.';
      case 500:
      case 502:
      case 503:
        return 'Our server encountered an issue. Please try again shortly.';
      default:
        break;
    }
  }

  // 3. Network or timeout failure (no response received)
  if (err.request && !err.response) {
    return 'Unable to reach the server. Please check your internet connection.';
  }

  // 4. Standard JavaScript Error
  if (err instanceof Error || typeof err.message === 'string') {
    const msg = String(err.message || '').trim();
    if (msg && msg !== '[object Object]' && !msg.includes('status code')) {
      return msg;
    }
  }

  return fallback;
}
