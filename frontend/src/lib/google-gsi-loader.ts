/**
 * Google Identity Services (GIS) Script Loader Utility.
 * Dynamically loads and guarantees availability of window.google.accounts.id without race conditions.
 */

let gsiLoadingPromise: Promise<typeof window.google> | null = null;

export function loadGoogleGsiScript(): Promise<typeof window.google> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is undefined'));
  }

  // If already loaded and ready
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  // If loading is in progress, reuse existing promise
  if (gsiLoadingPromise) {
    return gsiLoadingPromise;
  }

  gsiLoadingPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists in DOM
    const SCRIPT_ID = 'google-gsi-client-script';
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    const onScriptLoaded = () => {
      // Poll briefly to ensure window.google.accounts.id is parsed
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.id) {
          clearInterval(checkInterval);
          resolve(window.google);
        } else if (attempts > 30) {
          clearInterval(checkInterval);
          reject(new Error('Google Identity Services script loaded but google.accounts.id not initialized.'));
        }
      }, 50);
    };

    const onScriptError = () => {
      gsiLoadingPromise = null;
      reject(new Error('Failed to load Google Identity Services script.'));
    };

    if (script) {
      if (window.google?.accounts?.id) {
        resolve(window.google);
      } else {
        script.addEventListener('load', onScriptLoaded, { once: true });
        script.addEventListener('error', onScriptError, { once: true });
      }
      return;
    }

    // Create and append script tag
    script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = onScriptLoaded;
    script.onerror = onScriptError;

    document.head.appendChild(script);
  });

  return gsiLoadingPromise;
}
