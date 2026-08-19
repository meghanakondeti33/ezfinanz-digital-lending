/**
 * Real Google OAuth 2.0 Account Selection Popup.
 * Opens Google's native Account Chooser with prompt=select_account.
 * Works seamlessly in all modern browsers regardless of third-party cookie restrictions or One-Tap cooldowns.
 */

export function openGoogleOAuthPopup(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!clientId) {
      reject(new Error('Google Client ID is not configured.'));
      return;
    }

    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const redirectUri = window.location.origin;

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId.trim());
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'id_token');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('nonce', nonce);
    authUrl.searchParams.set('prompt', 'select_account');

    const width = 500;
    const height = 620;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl.toString(),
      'GoogleAccountChooser',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=1`
    );

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for localhost to use Google Sign-In.'));
      return;
    }

    // Poll the popup window for the returned credential in the URL fragment (#id_token=...)
    const pollTimer = setInterval(() => {
      try {
        if (!popup || popup.closed) {
          clearInterval(pollTimer);
          reject(new Error('Google sign-in was cancelled. You can try again or sign in with email.'));
          return;
        }

        const currentUrl = popup.location.href;
        if (currentUrl && currentUrl.includes(redirectUri)) {
          const hash = popup.location.hash;
          if (hash && hash.includes('id_token=')) {
            clearInterval(pollTimer);
            popup.close();

            const params = new URLSearchParams(hash.replace(/^#/, ''));
            const idToken = params.get('id_token');

            if (idToken) {
              resolve(idToken);
            } else {
              reject(new Error('No ID token returned by Google.'));
            }
          }
        }
      } catch {
        // Cross-origin access while navigating Google's domain is expected until redirect
      }
    }, 200);
  });
}
