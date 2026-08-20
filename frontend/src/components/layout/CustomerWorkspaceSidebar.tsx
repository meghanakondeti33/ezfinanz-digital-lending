import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface CustomerWorkspaceSidebarProps {
  primaryApplicationId?: string;
  hasActiveApplication?: boolean;
  hasActionRequired?: boolean;
  activeNav?: string;
  onSelectNav?: (navId: string) => void;
  className?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: string;
  badgeVariant?: 'alert' | 'default';
}

export const CustomerWorkspaceSidebar: React.FC<CustomerWorkspaceSidebarProps> = ({
  primaryApplicationId,
  hasActionRequired = false,
  activeNav,
  onSelectNav,
  className = '',
}) => {
  const location = useLocation();

  const currentLoanPath = primaryApplicationId
    ? `/loans/${primaryApplicationId}`
    : '/dashboard';

  const verificationPath = primaryApplicationId
    ? `/loans/${primaryApplicationId}?step=kyc`
    : '/verification';

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '⌂',
      path: '/dashboard',
      badge: hasActionRequired ? 'Action Req.' : undefined,
      badgeVariant: 'alert',
    },
    {
      id: 'current-loan',
      label: 'Current Loan',
      icon: '💰',
      path: currentLoanPath,
    },
    {
      id: 'history',
      label: 'My Records & History',
      icon: '📜',
      path: '/history',
    },
    {
      id: 'verification',
      label: 'Verification Dossier',
      icon: '🛡️',
      path: verificationPath,
      badge: hasActionRequired ? '⚠️' : undefined,
      badgeVariant: 'alert',
    },
    {
      id: 'documents',
      label: 'Document Vault',
      icon: '📁',
      path: '/documents',
    },
  ];

  return (
    <div className={`w-[245px] bg-white border-r border-[#E5E2DC] py-6 px-4 flex flex-col justify-between h-full ${className}`}>
      <div className="space-y-5">
        {/* Brand Header */}
        <div className="px-2 pb-2.5 border-b border-[#EAE7E1]">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B5652D] block">
            EZFINANZ CUSTOMER
          </span>
          <span className="text-xs text-[#8A8D93] mt-0.5 block">
            Borrower Workspace
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const isCurrent =
              activeNav === item.id ||
              (item.id === 'dashboard' && location.pathname === '/dashboard' && !location.hash) ||
              (item.id === 'current-loan' && location.pathname.startsWith('/loans/') && !location.search.includes('step=kyc')) ||
              (item.id === 'history' && (location.pathname === '/history' || location.pathname === '/applications')) ||
              (item.id === 'verification' && (location.pathname === '/verification' || location.search.includes('step=kyc') || location.search.includes('step=photo'))) ||
              (item.id === 'documents' && location.pathname === '/documents');

            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => onSelectNav && onSelectNav(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-[#FAF3EE] text-[#B5652D] font-bold border border-[#F3D7C4] shadow-2xs'
                    : 'text-[#686D76] hover:bg-[#F7F5F1] hover:text-[#14161A]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-base sm:text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      item.badgeVariant === 'alert'
                        ? 'bg-[#8C3A32] text-white'
                        : 'bg-[#FAF3EE] text-[#B5652D] border border-[#F3D7C4]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Support Info */}
      <div className="pt-4 border-t border-[#EAE7E1] px-2 text-xs text-[#8A8D93] space-y-1">
        <span className="font-semibold text-[#14161A] block text-xs">Need help?</span>
        <a
          href="mailto:support@ezfinanz.com"
          className="text-[#B5652D] font-medium hover:underline block truncate text-xs"
        >
          support@ezfinanz.com
        </a>
      </div>
    </div>
  );
};

export default CustomerWorkspaceSidebar;
