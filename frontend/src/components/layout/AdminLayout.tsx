import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeFilter?: string;
  onSelectFilter?: (filter: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activeFilter = 'ALL',
  onSelectFilter,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'All Applications', filter: 'ALL', icon: '📋' },
    { label: 'Underwriting Queue', filter: 'UNDER_REVIEW', icon: '⚖️', badge: 'Active' },
    { label: 'Verification Cases', filter: 'OFFER_SELECTED', icon: '🛡️' },
    { label: 'Approved Loans', filter: 'APPROVED', icon: '✓' },
    { label: 'Disbursed Payouts', filter: 'DISBURSED', icon: '💸' },
    { label: 'Draft Applications', filter: 'DRAFT', icon: '📝' },
  ];

  const handleNavClick = (filter: string) => {
    if (location.pathname !== '/admin') {
      navigate(`/admin?filter=${filter}`);
    } else if (onSelectFilter) {
      onSelectFilter(filter);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-[#14161A] flex flex-col font-sans selection:bg-[#B5652D]/20">
      <AppHeader
        showSidebarToggle
        onToggleSidebar={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <div className="flex-1 w-full flex flex-col lg:flex-row">
        {/* Desktop Admin Left Navigation */}
        <aside className="hidden lg:block w-[260px] shrink-0 bg-white border-r border-[#E5E2DC] py-6 px-4">
          <div className="sticky top-20 space-y-6">
            <div className="px-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#9C4F1C] block">
                Credit Officer Workspace
              </span>
              <span className="text-sm font-bold text-[#14161A] font-editorial">
                Underwriting Desk
              </span>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive =
                  location.pathname === '/admin' && activeFilter === item.filter;

                return (
                  <button
                    key={item.filter}
                    type="button"
                    onClick={() => handleNavClick(item.filter)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-[#F9F3EE] text-[#9C4F1C] border border-[#ECCBB3] shadow-xs'
                        : 'text-[#686D76] hover:bg-[#F7F5F1] hover:text-[#14161A]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-[#9C4F1C] text-white">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="pt-6 border-t border-[#E5E2DC] px-2 text-[11px] text-[#8A8D93] space-y-1">
              <span className="font-bold text-[#14161A] block">Risk & Policy Engine</span>
              <p>Underwriting decisions generate immutable cryptographically-signed audit records.</p>
            </div>
          </div>
        </aside>

        {/* Mobile Slide-Over Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-full max-w-xs bg-white shadow-2xl h-full p-4 flex flex-col z-10 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-3">
                <span className="font-bold text-sm text-[#14161A] font-editorial">
                  Underwriter Navigation
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-[#686D76] hover:bg-[#F7F5F1]"
                >
                  ✕
                </button>
              </div>

              <nav className="space-y-1 flex-1">
                {navItems.map((item) => (
                  <button
                    key={item.filter}
                    type="button"
                    onClick={() => {
                      handleNavClick(item.filter);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      activeFilter === item.filter
                        ? 'bg-[#F9F3EE] text-[#9C4F1C] border border-[#ECCBB3]'
                        : 'text-[#686D76] hover:bg-[#F7F5F1]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Full-Screen Main Content Area */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8 w-full">
          {children}
        </main>
      </div>
    </div>
  );
};
