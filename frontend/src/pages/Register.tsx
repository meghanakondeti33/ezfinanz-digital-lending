import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, type GoogleAuthPayload } from '../context/AuthContext';
import { extractErrorMessage } from '../lib/error-utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, loginWithGoogle, sendMobileOtp, verifyMobileOtp } = useAuth();

  // Step 1: Contact Information
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Step 2: Mobile OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState<string | null>(null);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);

  // Resend Countdown Timer
  useEffect(() => {
    let timer: any = null;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCountdown]);

  const validateMobileNumber = (val: string): boolean => {
    return /^[6-9]\d{9}$/.test(val.trim());
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOtpError(null);

    const cleanPhone = phone.trim();

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!validateMobileNumber(cleanPhone)) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const response = await sendMobileOtp(cleanPhone);
      setResendCountdown(response.resend_cooldown || 60);
      setDemoOtpHint(response.demo_otp || null);
      setOtpCode('');
      setShowOtpModal(true);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to send verification code. Please try again.'));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isSendingOtp) return;
    setOtpError(null);
    setIsSendingOtp(true);
    try {
      const response = await sendMobileOtp(phone.trim());
      setResendCountdown(response.resend_cooldown || 60);
      setDemoOtpHint(response.demo_otp || null);
    } catch (err: any) {
      setOtpError(extractErrorMessage(err, 'Failed to resend verification code. Please try again.'));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const cleanOtp = otpCode.trim();

    if (!cleanOtp) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }

    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setOtpError('Verification code must be exactly 6 numeric digits.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const result = await verifyMobileOtp(phone.trim(), cleanOtp);
      if (result.verified) {
        setIsPhoneVerified(true);
        setPhoneVerificationToken(result.phone_verification_token);
        setShowOtpModal(false);
      } else {
        setOtpError('Verification failed. Please check the code and try again.');
      }
    } catch (err: any) {
      setOtpError(extractErrorMessage(err, 'Invalid verification code. Please try again.'));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleFinalRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPhoneVerified || !phoneVerificationToken) {
      setError('Please verify your mobile number with the SMS code first.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsSubmittingRegistration(true);
    try {
      await register(email.trim().toLowerCase(), phone.trim(), password, phoneVerificationToken);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  const handleGoogleSuccess = async (payload: GoogleAuthPayload) => {
    setError(null);
    try {
      await loginWithGoogle(payload);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Google registration failed. Please try again.'));
    }
  };

  const formatMaskedPhone = (num: string) => {
    const clean = num.trim();
    if (clean.length === 10) {
      return `+91 ${clean.slice(0, 2)}XXX XX${clean.slice(7)}`;
    }
    return `+91 ${clean}`;
  };

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-[#14161A] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-[#B5652D]/20">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="text-center space-y-2 mb-8">
          <Link to="/" className="inline-flex items-center gap-1.5 group">
            <span className="text-3xl sm:text-4xl font-black tracking-tight text-[#14161A] font-editorial">
              EZ<span className="text-[#B5652D]">FINANZ</span>
            </span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#14161A] tracking-tight font-editorial">
            Create your account
          </h1>
          <p className="text-sm sm:text-base text-[#686D76] max-w-sm mx-auto">
            Get started with your personal loan application in under two minutes.
          </p>
        </div>

        {/* Card */}
        <Card variant="default" padding="lg" className="space-y-6 bg-white">
          {error && (
            <div className="p-4 rounded-xl bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32] text-sm flex items-center gap-2.5 font-medium">
              <span className="shrink-0 text-base">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Google Identity Services Sign-In Button */}
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
            buttonText="signup_with"
          />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E5E2DC]" />
            <span className="text-xs font-semibold text-[#8A8D93] uppercase">Or register with email</span>
            <div className="flex-1 h-px bg-[#E5E2DC]" />
          </div>

          {!isPhoneVerified ? (
            /* STEP 1: Phone & Email Submission */
            <form className="space-y-4" onSubmit={handleRequestOtp}>
              <Input
                label="Email Address"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="borrower@example.com"
                autoComplete="email"
              />

              <Input
                label="Mobile Number"
                type="tel"
                required
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                hint="10-digit Indian mobile starting with 6-9"
                autoComplete="tel"
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full text-base py-3"
                  isLoading={isSendingOtp}
                >
                  Send verification code →
                </Button>
              </div>
            </form>
          ) : (
            /* STEP 2: Password Setup after Mobile Verification */
            <form className="space-y-4" onSubmit={handleFinalRegistration}>
              <div className="p-3.5 bg-[#EDF7ED] border border-[#C8E6C9] rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base text-[#2E7D32]">✓</span>
                  <div>
                    <span className="text-xs font-bold text-[#1B5E20] block">Mobile Verified</span>
                    <span className="text-xs text-[#2E7D32] font-mono">+91 {phone}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsPhoneVerified(false);
                    setPhoneVerificationToken(null);
                  }}
                  className="text-xs font-semibold text-[#686D76] hover:text-[#14161A] underline cursor-pointer"
                >
                  Change
                </button>
              </div>

              <Input
                label="Email Address"
                type="email"
                disabled
                value={email}
                className="bg-[#F7F5F1] opacity-80 cursor-not-allowed"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Input
                  label="Password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars"
                  autoComplete="new-password"
                  autoFocus
                />

                <Input
                  label="Confirm"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter"
                  autoComplete="new-password"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full text-base py-3"
                  isLoading={isSubmittingRegistration}
                >
                  Create customer account →
                </Button>
              </div>
            </form>
          )}

          {/* Footer Links */}
          <div className="border-t border-[#E5E2DC] pt-4 flex items-center justify-between text-xs sm:text-sm text-[#686D76]">
            <Link to="/" className="hover:text-[#14161A] transition-colors">
              ← Return Home
            </Link>
            <div>
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#B5652D] hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        </Card>

        {/* Security Notice */}
        <div className="mt-8 text-center text-xs text-[#8A8D93] flex items-center justify-center gap-1.5">
          <span>🔒</span>
          <span>Argon2id Encrypted • Real-time SMS Verification</span>
        </div>
      </div>

      {/* Phone OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white shadow-xl">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                  Mobile Verification
                </span>
                {demoOtpHint ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-[#F9F3EE] text-[#B5652D] rounded-full border border-[#ECCBB3]">
                    Demo Mode Active
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-[#EDF7ED] text-[#2E7D32] rounded-full border border-[#C8E6C9]">
                    SMS Sent
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-[#14161A] font-editorial mt-1">
                Enter 6-Digit Code
              </h3>
              <p className="text-xs sm:text-sm text-[#686D76] mt-0.5">
                We've sent a 6-digit verification code to{' '}
                <strong className="text-[#14161A] font-mono">{formatMaskedPhone(phone)}</strong>.
              </p>
            </div>

            {otpError && (
              <div className="p-3 rounded-xl bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32] text-xs flex items-center gap-2 font-medium">
                <span>⚠️</span>
                <span>{otpError}</span>
              </div>
            )}

            {demoOtpHint && (
              <div className="p-3.5 bg-[#F7F5F1] border border-[#E5E2DC] rounded-xl text-xs text-[#686D76] flex items-center justify-between">
                <span>Demo mode: Code is <strong className="font-mono text-sm font-bold text-[#14161A]">{demoOtpHint}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setOtpCode(demoOtpHint);
                    setOtpError(null);
                  }}
                  className="text-xs font-bold text-[#B5652D] hover:underline cursor-pointer"
                >
                  Auto-fill
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <Input
                label="6-Digit Verification Code"
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (otpError) setOtpError(null);
                }}
                placeholder="• • • • • •"
                className="text-center font-mono text-2xl tracking-widest"
                required
                autoFocus
              />

              <div className="flex items-center justify-between text-xs text-[#686D76] pt-1">
                <span>Didn't receive the code?</span>
                {resendCountdown > 0 ? (
                  <span className="font-mono text-[#8A8D93]">Resend in {resendCountdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isSendingOtp}
                    className="font-bold text-[#B5652D] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    Resend code
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E2DC]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowOtpModal(false);
                    setOtpError(null);
                  }}
                  disabled={isVerifyingOtp}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isVerifyingOtp}
                >
                  Verify mobile number →
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Register;
