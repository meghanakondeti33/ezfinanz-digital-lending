import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

export const Landing: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  // Interactive Live EMI Calculator State
  const [calcAmount, setCalcAmount] = useState<number>(500000);
  const [calcTenure, setCalcTenure] = useState<number>(36);
  const interestRate = 12.0; // 12% p.a. standard representative rate

  // Standard Reducing Balance EMI formula: E = P * r * (1+r)^n / ((1+r)^n - 1)
  const monthlyRate = interestRate / 12 / 100;
  const emi = Math.round(
    (calcAmount * monthlyRate * Math.pow(1 + monthlyRate, calcTenure)) /
      (Math.pow(1 + monthlyRate, calcTenure) - 1)
  );
  const totalRepayment = emi * calcTenure;
  const totalInterest = totalRepayment - calcAmount;
  const processingFee = Math.round(calcAmount * 0.02); // 2%
  const gst = Math.round(processingFee * 0.18); // 18% GST
  const netDisbursement = calcAmount - (processingFee + gst);

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-[#14161A] flex flex-col font-sans selection:bg-[#B5652D]/20">
      {/* Top Simple Header */}
      <header className="border-b border-[#E5E2DC] bg-[#F7F5F1]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5">
            <span className="text-2xl font-black tracking-tight text-[#14161A] font-editorial">
              EZ<span className="text-[#B5652D]">FINANZ</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'}>
                <Button variant="primary" size="sm">
                  {user?.role === 'ADMIN' ? 'Underwriter Console →' : 'Go to Dashboard →'}
                </Button>
              </Link>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-16 sm:space-y-20">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F9F3EE] border border-[#ECCBB3] text-xs font-semibold text-[#9C4F1C]">
            <span>•</span>
            <span>Digital Personal Lending Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-[#14161A] font-editorial leading-[1.12]">
            Personal loans made simpler.
          </h1>

          <p className="text-lg sm:text-xl text-[#686D76] font-normal leading-relaxed max-w-2xl">
            A transparent lending process with instant eligibility assessment, customized repayment structures, and direct bank settlement. No hidden fees.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
            <Link to={isAuthenticated ? '/loans/new' : '/register'}>
              <Button variant="primary" size="lg" className="w-full sm:w-auto text-base py-3 px-6">
                Apply for a personal loan →
              </Button>
            </Link>
            {!isAuthenticated && (
              <Link to="/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-base py-3 px-6">
                  Sign in to existing application
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Live Interactive Loan Calculator */}
        <div className="bg-white border border-[#E5E2DC] rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
          <div className="border-b border-[#E5E2DC] pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B5652D] font-mono">
              Live Rate Explorer
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial mt-1">
              Estimate your monthly repayment
            </h2>
            <p className="text-sm text-[#686D76] mt-0.5">
              Explore your estimated EMI and loan costs before submitting an application.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Controls */}
            <div className="lg:col-span-7 space-y-6">
              {/* Amount Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#14161A]">Loan Amount</span>
                  <span className="text-xl font-bold font-mono text-[#B5652D]">
                    ₹{calcAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <input
                  type="range"
                  min={50000}
                  max={2500000}
                  step={25000}
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(Number(e.target.value))}
                  className="w-full h-2 bg-[#F2EFE9] rounded-lg appearance-none cursor-pointer accent-[#B5652D]"
                />
                <div className="flex justify-between text-xs text-[#8A8D93] font-mono">
                  <span>₹50,000</span>
                  <span>₹25,00,000</span>
                </div>
              </div>

              {/* Tenure Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#14161A]">Repayment Tenure</span>
                  <span className="text-xl font-bold font-mono text-[#14161A]">
                    {calcTenure} Months ({calcTenure / 12} Years)
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[6, 12, 18, 24, 36, 48, 60].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCalcTenure(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                        calcTenure === t
                          ? 'bg-[#14161A] text-white border-[#14161A]'
                          : 'bg-[#F7F5F1] text-[#686D76] border-[#E5E2DC] hover:border-[#D4D0C7]'
                      }`}
                    >
                      {t}M
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Calculation Output Card */}
            <div className="lg:col-span-5 bg-[#F9F3EE] border border-[#ECCBB3] rounded-2xl p-6 space-y-5">
              <div>
                <span className="text-xs text-[#9C4F1C] font-semibold uppercase tracking-wider block">
                  Estimated Monthly EMI
                </span>
                <span className="text-4xl font-black text-[#14161A] font-mono mt-1 block">
                  ₹{emi.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-[#686D76] mt-0.5 block">at {interestRate}% representative p.a.</span>
              </div>

              <div className="space-y-2.5 text-xs text-[#686D76] border-t border-[#E5E2DC] pt-4">
                <div className="flex justify-between">
                  <span>Net amount to bank:</span>
                  <strong className="text-[#1E5C4A] font-mono">₹{netDisbursement.toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Total interest:</span>
                  <strong className="text-[#14161A] font-mono">₹{totalInterest.toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Total repayment:</span>
                  <strong className="text-[#14161A] font-mono">₹{totalRepayment.toLocaleString('en-IN')}</strong>
                </div>
              </div>

              <div className="pt-2">
                <Link to="/register" className="block">
                  <Button variant="primary" size="md" className="w-full text-sm">
                    Lock This Rate & Apply →
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* The Continuous Ledger Journey Explainer */}
        <div className="bg-white border border-[#E5E2DC] rounded-3xl p-8 sm:p-10 shadow-sm space-y-8">
          <div className="border-b border-[#E5E2DC] pb-5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B5652D] font-mono">
              The Ledger Line
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial mt-1">
              One continuous, transparent journey
            </h2>
            <p className="text-sm text-[#686D76] mt-1">
              Every financial decision is clear, connected, and visible to you from start to finish.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#14161A] text-white flex items-center justify-center text-xs font-bold font-mono">
                  1
                </span>
                <span className="text-xs font-bold text-[#14161A] uppercase tracking-wider">Apply</span>
              </div>
              <p className="text-xs text-[#686D76] leading-relaxed">
                Provide your basic income and loan requirements in a few focused questions.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#14161A] text-white flex items-center justify-center text-xs font-bold font-mono">
                  2
                </span>
                <span className="text-xs font-bold text-[#14161A] uppercase tracking-wider">Get Eligible</span>
              </div>
              <p className="text-xs text-[#686D76] leading-relaxed">
                Instant deterministic credit evaluation with clear reasoning behind your score and limit.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#14161A] text-white flex items-center justify-center text-xs font-bold font-mono">
                  3
                </span>
                <span className="text-xs font-bold text-[#14161A] uppercase tracking-wider">Choose Offer</span>
              </div>
              <p className="text-xs text-[#686D76] leading-relaxed">
                Explore repayment terms with transparent monthly EMI, total interest, and tenure trade-offs.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#14161A] text-white flex items-center justify-center text-xs font-bold font-mono">
                  4
                </span>
                <span className="text-xs font-bold text-[#14161A] uppercase tracking-wider">Verify</span>
              </div>
              <p className="text-xs text-[#686D76] leading-relaxed">
                Calm identity, bank account, and photo verification to ensure fund security.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#B5652D] text-white flex items-center justify-center text-xs font-bold font-mono">
                  5
                </span>
                <span className="text-xs font-bold text-[#B5652D] uppercase tracking-wider">Receive Funds</span>
              </div>
              <p className="text-xs text-[#686D76] leading-relaxed">
                Underwriting confirmation and electronic payout directly to your bank account.
              </p>
            </div>
          </div>
        </div>

        {/* Institutional Trust Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
          <div className="p-6 bg-white border border-[#E5E2DC] rounded-2xl space-y-2 shadow-xs">
            <h3 className="text-base font-bold text-[#14161A] font-editorial">No Black-Box Decisions</h3>
            <p className="text-xs text-[#686D76] leading-relaxed">
              We explain precisely which financial factors determined your loan eligibility and terms.
            </p>
          </div>

          <div className="p-6 bg-white border border-[#E5E2DC] rounded-2xl space-y-2 shadow-xs">
            <h3 className="text-base font-bold text-[#14161A] font-editorial">Tabular Precision</h3>
            <p className="text-xs text-[#686D76] leading-relaxed">
              Every EMI, interest charge, processing fee, and net disbursement is calculated to the rupee.
            </p>
          </div>

          <div className="p-6 bg-white border border-[#E5E2DC] rounded-2xl space-y-2 shadow-xs">
            <h3 className="text-base font-bold text-[#14161A] font-editorial">Direct Bank Settlement</h3>
            <p className="text-xs text-[#686D76] leading-relaxed">
              Funds are transferred electronically to your verified bank account upon credit approval.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E2DC] bg-[#F7F5F1] py-8 text-center text-xs text-[#8A8D93]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-editorial text-sm font-bold text-[#14161A]">
            EZ<span className="text-[#B5652D]">FINANZ</span>
          </span>
          <span>Digital Personal Lending Platform • Secure Underwriting System</span>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-[#14161A]">Sign In</Link>
            <Link to="/register" className="hover:text-[#14161A]">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
