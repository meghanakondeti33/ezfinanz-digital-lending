import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type GoogleAuthPayload } from '../context/AuthContext';
import { extractErrorMessage } from '../lib/error-utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const authenticatedUser = await login(email, password);

      // Deterministic Post-Login Role Routing
      if (authenticatedUser.role === 'ADMIN') {
        const dest = from && from.startsWith('/admin') ? from : '/admin';
        navigate(dest, { replace: true });
      } else if (authenticatedUser.role === 'CUSTOMER') {
        const dest = from && !from.startsWith('/admin') ? from : '/dashboard';
        navigate(dest, { replace: true });
      } else {
        setError('Unknown role assigned to user. Access denied.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Invalid email or password. Please verify your credentials.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (payload: GoogleAuthPayload) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const authenticatedUser = await loginWithGoogle(payload);
      if (authenticatedUser.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Google sign-in failed. Please try again or use email login.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoCredentials = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
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
            Welcome back
          </h1>
          <p className="text-sm sm:text-base text-[#686D76] max-w-sm mx-auto">
            Sign in to continue your loan journey.
          </p>
        </div>

        {/* Form Container */}
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
            buttonText="continue_with"
          />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E5E2DC]" />
            <span className="text-xs font-semibold text-[#8A8D93] uppercase">Or with email</span>
            <div className="flex-1 h-px bg-[#E5E2DC]" />
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full text-base py-3"
                isLoading={isSubmitting}
              >
                Sign in to your account →
              </Button>
            </div>
          </form>

          {/* Quick Preset Selector for Development */}
          <div className="border-t border-[#E5E2DC] pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#686D76]">
                Demo Access
              </span>
              <span className="text-xs text-[#8A8D93]">Click to auto-fill</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => fillDemoCredentials('customer@ezfinanz.com', 'Password@123')}
                className="p-3 bg-[#F7F5F1] hover:bg-[#EFECE6] border border-[#D4D0C7] rounded-xl transition-all text-left group cursor-pointer"
              >
                <span className="text-xs font-bold text-[#14161A] block">Customer</span>
                <span className="text-[11px] text-[#686D76] font-mono block mt-0.5 truncate">
                  customer@ezfinanz.com
                </span>
              </button>

              <button
                type="button"
                onClick={() => fillDemoCredentials('admin@ezfinanz.com', 'AdminPass@123')}
                className="p-3 bg-[#F7F5F1] hover:bg-[#EFECE6] border border-[#D4D0C7] rounded-xl transition-all text-left group cursor-pointer"
              >
                <span className="text-xs font-bold text-[#14161A] block">Credit Officer</span>
                <span className="text-[11px] text-[#686D76] font-mono block mt-0.5 truncate">
                  admin@ezfinanz.com
                </span>
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="border-t border-[#E5E2DC] pt-4 flex items-center justify-between text-xs sm:text-sm text-[#686D76]">
            <Link to="/" className="hover:text-[#14161A] transition-colors">
              ← Return Home
            </Link>
            <div>
              New to EZFINANZ?{' '}
              <Link to="/register" className="font-semibold text-[#B5652D] hover:underline">
                Create account
              </Link>
            </div>
          </div>
        </Card>

        {/* Security footer */}
        <div className="mt-8 text-center text-xs text-[#8A8D93] flex items-center justify-center gap-1.5">
          <span>🔒</span>
          <span>Argon2id Encrypted • Strict Server-Side Authorization</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
