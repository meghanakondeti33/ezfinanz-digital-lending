import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

interface AppHeaderProps {
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
}

export const formatHeaderUserName = (email?: string): string => {
  if (!email) return 'User';
  const clean = email.toLowerCase().trim();
  if (clean.startsWith('admin')) return 'Admin';
  if (clean.includes('meghana')) return 'Meghana Kondeti';

  const userPart = clean.split('@')[0].replace(/[0-9]/g, '');
  if (!userPart) return email.split('@')[0];

  if (/[._\-]/.test(userPart)) {
    return userPart
      .split(/[._\-]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return userPart.charAt(0).toUpperCase() + userPart.slice(1).toLowerCase();
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  onToggleSidebar,
  showSidebarToggle = false,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E2DC] shadow-2xs">
      <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Mobile Toggle & Brand Logo */}
        <div className="flex items-center gap-3 sm:gap-6">
          {showSidebarToggle && onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-xl text-[#686D76] hover:text-[#14161A] hover:bg-[#F7F5F1] transition-colors focus:outline-none focus:ring-2 focus:ring-[#B5652D]/20 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          <Link to={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#B5652D] flex items-center justify-center text-white font-bold font-editorial text-lg shadow-2xs group-hover:scale-105 transition-transform">
              EZ
            </div>
            <span className="text-xl font-extrabold tracking-tight text-[#14161A] font-editorial">
              EZ<span className="text-[#B5652D]">FINANZ</span>
            </span>
          </Link>

          {/* Middle Nav Links (Desktop) */}
          {user && !isAdmin && (
            <nav className="hidden md:flex items-center gap-1 ml-4 pl-4 border-l border-[#E5E2DC]">
              <Link
                to="/dashboard"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  location.pathname === '/dashboard' && !location.hash
                    ? 'bg-[#FAF3EE] text-[#B5652D] font-bold'
                    : 'text-[#686D76] hover:text-[#14161A] hover:bg-[#F7F5F1]'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/history"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  location.pathname === '/history' || location.pathname === '/applications'
                    ? 'bg-[#FAF3EE] text-[#B5652D] font-bold'
                    : 'text-[#686D76] hover:text-[#14161A] hover:bg-[#F7F5F1]'
                }`}
              >
                History & Records
              </Link>
              <Link
                to="/documents"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  location.pathname === '/documents'
                    ? 'bg-[#FAF3EE] text-[#B5652D] font-bold'
                    : 'text-[#686D76] hover:text-[#14161A] hover:bg-[#F7F5F1]'
                }`}
              >
                Documents
              </Link>
              <Link
                to="/verification"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  location.pathname === '/verification'
                    ? 'bg-[#FAF3EE] text-[#B5652D] font-bold'
                    : 'text-[#686D76] hover:text-[#14161A] hover:bg-[#F7F5F1]'
                }`}
              >
                Verification
              </Link>
            </nav>
          )}
        </div>

        {/* Right: User Profile & Actions */}
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

              {/* Formatted User Name */}
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-[#14161A] truncate max-w-[180px]">
                  {formatHeaderUserName(user.email)}
                </span>
                <span className="text-[10px] text-[#8A8D93] truncate max-w-[180px]">
                  {user.email}
                </span>
              </div>

              {/* Admin Portal Shortcut if Admin on Customer route */}
              {isAdmin && !location.pathname.startsWith('/admin') && (
                <Link
                  to="/admin"
                  className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#14161A] hover:bg-[#25282F] text-white shadow-2xs transition-all"
                >
                  Admin Console →
                </Link>
              )}

              {/* Sign Out */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="text-xs font-semibold text-[#686D76] hover:text-[#14161A] hover:bg-[#FAF8F5]"
              >
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
                <Button variant="primary" size="sm" className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white">
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

export default AppHeader;
