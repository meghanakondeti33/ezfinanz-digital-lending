import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isCustomer = user?.role === 'CUSTOMER';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-40 bg-[#F7F5F1]/95 backdrop-blur-md border-b border-[#E5E2DC]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-1.5 group">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-[#14161A] font-editorial">
              EZ<span className="text-[#B5652D]">FINANZ</span>
            </span>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-1">
              {isCustomer && (
                <>
                  <Link
                    to="/dashboard"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      location.pathname === '/dashboard'
                        ? 'bg-white text-[#14161A] shadow-xs border border-[#E5E2DC]'
                        : 'text-[#686D76] hover:text-[#14161A] hover:bg-white/50'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/loans/new"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      location.pathname === '/loans/new'
                        ? 'bg-white text-[#B5652D] shadow-xs border border-[#E5E2DC]'
                        : 'text-[#686D76] hover:text-[#14161A] hover:bg-white/50'
                    }`}
                  >
                    + Apply for Loan
                  </Link>
                </>
              )}

              {isAdmin && (
                <Link
                  to="/admin"
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-white text-[#14161A] shadow-xs border border-[#E5E2DC]'
                      : 'text-[#686D76] hover:text-[#14161A] hover:bg-white/50'
                  }`}
                >
                  Underwriting Queue
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Right Session / Profile */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {/* Role Badge */}
              <span
                className={`hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
                  isAdmin
                    ? 'bg-[#F9F3EE] border-[#ECCBB3] text-[#9C4F1C]'
                    : 'bg-[#E8F2EE] border-[#C5E0D5] text-[#1E5C4A]'
                }`}
              >
                {user.role}
              </span>

              {/* User Name */}
              <span className="text-xs text-[#14161A] font-semibold hidden sm:inline-block max-w-[160px] truncate">
                {user.email.toLowerCase().startsWith('admin')
                  ? 'Admin'
                  : user.email.toLowerCase().includes('meghana')
                  ? 'Meghana Kondeti'
                  : user.email.split('@')[0]}
              </span>

              {/* Admin switch shortcut if user has admin role */}
              {isAdmin && !location.pathname.startsWith('/admin') && (
                <Link
                  to="/admin"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#14161A] hover:bg-[#25282F] text-white shadow-xs transition-all"
                >
                  Underwriter Portal →
                </Link>
              )}

              {/* Sign Out */}
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  Apply Now
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
