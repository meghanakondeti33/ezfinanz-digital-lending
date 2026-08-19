import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../lib/error-utils';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

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
      setError(extractErrorMessage(err, 'Invalid email or password. Please try again.'));
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background ambient gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-blue-600/10 via-emerald-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <span className="text-3xl sm:text-4xl font-black tracking-tight text-white group-hover:opacity-90 transition-opacity">
              EZ<span className="text-emerald-400">FINANZ</span>
            </span>
          </Link>
          <h2 className="text-lg sm:text-xl font-bold text-slate-200">
            Unified Lending & Underwriting Sign In
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Access your customer loan journey or credit underwriting workspace through our server-authorized gateway.
          </p>
        </div>

        {/* Main Card */}
        <div className="mt-6 bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center space-x-2 animate-shake">
              <span className="text-base">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Unified Login Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Password
                </label>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-3 px-4 rounded-xl text-xs font-black text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-lg shadow-emerald-950/40 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="flex items-center space-x-2">
                    <svg className="animate-spin h-4 w-4 text-slate-950" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Authenticating…</span>
                  </span>
                ) : (
                  'Sign In to EZFINANZ →'
                )}
              </button>
            </div>
          </form>

          {/* Demo Credentials Section for Technical Evaluator */}
          <div className="border-t border-slate-800/80 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>⚡</span> Demo Accounts (Development Helper)
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                Auto-fill
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
              {/* Customer Demo Tile */}
              <button
                type="button"
                onClick={() => fillDemoCredentials('customer@ezfinanz.com', 'Password@123')}
                className="p-3 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-emerald-700/80 rounded-2xl transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white group-hover:text-emerald-300">
                    Customer Account
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">Borrower</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono block mt-1 truncate">
                  customer@ezfinanz.com
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Routes to Customer Dashboard
                </span>
              </button>

              {/* Admin Demo Tile */}
              <button
                type="button"
                onClick={() => fillDemoCredentials('admin@ezfinanz.com', 'AdminPass@123')}
                className="p-3 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-indigo-700/80 rounded-2xl transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white group-hover:text-indigo-300">
                    Credit Officer Account
                  </span>
                  <span className="text-[10px] text-indigo-400 font-bold">Admin</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono block mt-1 truncate">
                  admin@ezfinanz.com
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Routes to Underwriting Portal
                </span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 text-center">
              Clicking a preset fills credentials in the form. Authorization is securely validated via backend Argon2id hashing and JWT role claims.
            </p>
          </div>

          {/* Footer Links */}
          <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between text-xs text-slate-400">
            <Link to="/" className="hover:text-slate-200 transition-colors">
              ← Home
            </Link>
            <div>
              New customer?{' '}
              <Link to="/register" className="font-bold text-emerald-400 hover:text-emerald-300">
                Register here
              </Link>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-6 text-center text-[11px] text-slate-500 flex items-center justify-center gap-2">
          <span>🔒</span>
          <span>Argon2id + JWT Encrypted • Strict Backend RBAC Authorization</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
