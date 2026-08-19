import React, { useEffect, useRef, useState } from 'react';
import { extractErrorMessage } from '../../lib/error-utils';
import type { GoogleAuthPayload } from '../../context/AuthContext';

interface GoogleSignInButtonProps {
  onSuccess: (payload: GoogleAuthPayload) => Promise<void>;
  onError: (errorMsg: string) => void;
  isLoading?: boolean;
  buttonText?: 'continue_with' | 'signin_with' | 'signup_with';
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  isLoading = false,
  buttonText = 'continue_with',
}) => {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [isGsiLoaded, setIsGsiLoaded] = useState<boolean>(false);
  const tokenClientRef = useRef<any>(null);

  useEffect(() => {
    if (!clientId || clientId.trim() === '') {
      return;
    }

    let intervalId: any = null;

    const setupGoogleAuth = () => {
      if (window.google?.accounts && buttonContainerRef.current) {
        if (intervalId) clearInterval(intervalId);

        try {
          // 1. Initialize GIS ID token client & render button
          if (window.google.accounts.id) {
            window.google.accounts.id.initialize({
              client_id: clientId.trim(),
              callback: async (response) => {
                if (response && response.credential) {
                  try {
                    await onSuccess({ credential: response.credential });
                  } catch (err: any) {
                    onError(extractErrorMessage(err, 'Google verification failed on server.'));
                  }
                } else {
                  onError('Google sign-in was cancelled. You can try again or sign in with email.');
                }
              },
              auto_select: false,
              cancel_on_tap_outside: true,
            });

            if (buttonContainerRef.current) {
              buttonContainerRef.current.innerHTML = '';
              window.google.accounts.id.renderButton(buttonContainerRef.current, {
                theme: 'outline',
                size: 'large',
                type: 'standard',
                text: buttonText,
                shape: 'rectangular',
                width: 384,
                logo_alignment: 'left',
              });
            }
          }

          // 2. Initialize OAuth2 Token Client for direct account-selection popup
          if (window.google.accounts.oauth2) {
            tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
              client_id: clientId.trim(),
              scope: 'openid email profile',
              prompt: 'select_account',
              callback: async (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                  try {
                    await onSuccess({ access_token: tokenResponse.access_token });
                  } catch (err: any) {
                    onError(extractErrorMessage(err, 'Google authentication failed on server.'));
                  }
                } else if (tokenResponse?.error) {
                  onError('Google sign-in was cancelled. You can try again or sign in with email.');
                }
              },
            });
          }

          setIsGsiLoaded(true);
        } catch (err) {
          console.error('Error initializing Google services:', err);
        }
      }
    };

    setupGoogleAuth();
    intervalId = setInterval(setupGoogleAuth, 250);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [clientId, onSuccess, onError, buttonText]);

  const handleCustomButtonClick = () => {
    if (!clientId || clientId.trim() === '') {
      onError('Google Client ID is not configured. Please check VITE_GOOGLE_CLIENT_ID in frontend/.env.');
      return;
    }

    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
    } else if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      onError('Google authentication library is loading. Please wait a moment.');
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Official Google GSI Button Container */}
      <div
        ref={buttonContainerRef}
        className="w-full flex justify-center min-h-[44px]"
      />

      {/* Fallback button if GSI container is loading */}
      {!isGsiLoaded && (
        <button
          type="button"
          onClick={handleCustomButtonClick}
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-white border border-[#D4D0C7] hover:bg-[#F7F5F1] rounded-xl text-sm font-semibold text-[#14161A] flex items-center justify-center gap-2.5 transition-all shadow-xs cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>
      )}
    </div>
  );
};

export default GoogleSignInButton;
