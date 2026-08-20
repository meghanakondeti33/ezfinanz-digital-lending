import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApplications } from '../lib/loans-api';

export const CurrentLoanRedirect: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const redirectUser = async () => {
      try {
        const res = await fetchApplications();
        const apps = res.items || [];
        if (apps.length > 0) {
          navigate(`/loans/${apps[0].id}`, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } catch {
        navigate('/dashboard', { replace: true });
      }
    };
    redirectUser();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F7F5F1] flex items-center justify-center">
      <div className="flex items-center space-x-3 text-[#B5652D]">
        <div className="animate-spin h-6 w-6 border-2 border-[#B5652D] border-t-transparent rounded-full" />
        <span className="text-sm font-medium text-[#14161A]">Opening your active loan…</span>
      </div>
    </div>
  );
};

export default CurrentLoanRedirect;
