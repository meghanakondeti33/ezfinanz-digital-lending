import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../lib/api-client';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../lib/error-utils';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, refetchUser } = useAuth();

  const [verifying, setVerifying] = useState<boolean>(!!token);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>(token ? 'idle' : 'error');
  const [message, setMessage] = useState<string>(
    token ? 'Validating your verification token...' : 'No verification token provided in link.'
  );

  const [resending, setResending] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!token) return;

    const verifyToken = async () => {
      try {
        setVerifying(true);
        const res = await apiClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        setStatus('success');
        setMessage(res.data.message || 'Email verified successfully!');
        if (refetchUser) {
          await refetchUser();
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(extractErrorMessage(err, 'Invalid or expired verification link.'));
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token, refetchUser]);

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    try {
      setResending(true);
      setResendMessage(null);
      const res = await apiClient.post('/auth/send-email-verification', {
        email: user?.email,
      });
      setResendMessage(res.data.message || 'Verification email sent! Check your inbox.');
      setResendCooldown(60);
    } catch (err: any) {
      setResendMessage(extractErrorMessage(err, 'Failed to send verification email.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F1] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-xl bg-[#B5652D] flex items-center justify-center text-white font-bold text-lg shadow-xs">
            EZ
          </div>
          <span className="font-editorial text-2xl font-bold text-[#14161A] tracking-tight">
            EZFINANZ
          </span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Card variant="elevated" padding="lg" className="space-y-6 bg-white text-center">
          <CardHeader
            tagline="Account Security"
            title="Email Verification"
            description="Confirming your registered email address for account security and loan updates."
          />

          {verifying && (
            <div className="py-8 space-y-4">
              <div className="animate-spin h-8 w-8 border-3 border-[#B5652D] border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-[#686D76] font-medium">{message}</p>
            </div>
          )}

          {!verifying && status === 'success' && (
            <div className="py-6 space-y-4">
              <div className="h-14 w-14 bg-[#E8F2EE] text-[#1E5C4A] rounded-full flex items-center justify-center text-2xl mx-auto border border-[#C5E0D5]">
                ✓
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#14161A]">Email Verified!</h3>
                <p className="text-sm text-[#1E5C4A] font-medium">{message}</p>
              </div>
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard →
              </Button>
            </div>
          )}

          {!verifying && status === 'error' && (
            <div className="py-6 space-y-4">
              <div className="h-14 w-14 bg-[#FBEFEC] text-[#8C3A32] rounded-full flex items-center justify-center text-2xl mx-auto border border-[#F0D0CB]">
                ⚠️
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#14161A]">Verification Failed</h3>
                <p className="text-sm text-[#8C3A32] font-medium">{message}</p>
              </div>

              {resendMessage && (
                <div className="p-3 bg-[#F7F5F1] rounded-xl text-xs text-[#14161A] font-medium border border-[#E5E2DC]">
                  {resendMessage}
                </div>
              )}

              <div className="pt-2 space-y-2">
                <Button
                  variant="outline"
                  size="md"
                  className="w-full"
                  disabled={resendCooldown > 0 || resending}
                  isLoading={resending}
                  onClick={handleResend}
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend Verification Email'}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate('/dashboard')}
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default VerifyEmail;
