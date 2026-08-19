import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, type GoogleAuthPayload } from '../context/AuthContext';
import { extractErrorMessage } from '../lib/error-utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Simulated Phone OTP Verification Modal
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('123456');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }

    // Open simulated Phone OTP modal for 2-step verification requirement
    setShowOtpModal(true);
  };

  const handleConfirmRegistration = async () => {
    setError(null);
    setIsVerifyingOtp(true);

    try {
      await register(email, phone, password);
      setShowOtpModal(false);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setShowOtpModal(false);
      setError(extractErrorMessage(err, 'Registration failed. Please verify your details.'));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleGoogleSuccess = async (payload: GoogleAuthPayload) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle(payload);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Google registration failed. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
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

          {/* Real Google Identity Services Sign-In Button */}
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
            isLoading={isSubmitting}
            buttonText="signup_with"
          />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E5E2DC]" />
            <span className="text-xs font-semibold text-[#8A8D93] uppercase">Or register with email</span>
            <div className="flex-1 h-px bg-[#E5E2DC]" />
          </div>

          <form className="space-y-4" onSubmit={handleInitialSubmit}>
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
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              hint="10-digit Indian number"
              autoComplete="tel"
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
                isLoading={isSubmitting}
              >
                Verify mobile & create account →
              </Button>
            </div>
          </form>

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
          <span>Argon2id Encrypted • Strict Data Confidentiality</span>
        </div>
      </div>

      {/* Simulated Phone OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                Phone Verification
              </span>
              <h3 className="text-xl font-bold text-[#14161A] font-editorial mt-1">
                Enter 6-Digit SMS Code
              </h3>
              <p className="text-xs sm:text-sm text-[#686D76] mt-0.5">
                We sent a simulated 6-digit code to <strong className="text-[#14161A] font-mono">+91 {phone}</strong>.
              </p>
            </div>

            <div className="p-3.5 bg-[#F9F3EE] border border-[#ECCBB3] rounded-xl text-xs text-[#9C4F1C]">
              <span>Demo hint: Simulated OTP code is </span>
              <strong className="font-mono text-sm font-bold">123456</strong>
            </div>

            <Input
              label="Verification Code"
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="text-center font-mono text-xl tracking-widest"
              required
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowOtpModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                isLoading={isVerifyingOtp}
                onClick={handleConfirmRegistration}
              >
                Confirm OTP & Finish →
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Register;
