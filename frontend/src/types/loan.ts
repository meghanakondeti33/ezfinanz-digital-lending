export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ELIGIBILITY_CHECKED'
  | 'OFFER_SELECTED'
  | 'BANK_ACCOUNT_ADDED'
  | 'DECLARATION_SIGNED'
  | 'SELFIE_UPLOADED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSEMENT_PROCESSING'
  | 'DISBURSED';

export type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED' | 'BUSINESS' | 'OTHER';

export type EligibilityStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'MANUAL_REVIEW';

export type OfferStatus = 'GENERATED' | 'SELECTED' | 'EXPIRED' | 'REJECTED';

export type EligibilityCheck = {
  id: string;
  application_id: string;
  status: EligibilityStatus;
  score: number | string | null;
  dti_ratio: number | string | null;
  reasons: string[] | null;
  calculated_at: string;
};

export type LoanTerm = {
  id: string;
  offer_id: string;
  tenure_months: number;
  emi: number | string;
  total_interest: number | string;
  total_repayment: number | string;
  total_charges: number | string;
  net_disbursement: number | string;
  irr: number | string | null;
  selected_at: string;
};

export type LoanOffer = {
  id: string;
  application_id: string;
  principal: number | string;
  interest_rate: number | string;
  processing_fee: number | string;
  gst: number | string;
  other_charges: number | string;
  status: OfferStatus;
  terms: LoanTerm[];
  created_at: string;
};

export type LoanApplication = {
  id: string;
  application_number: string;
  user_id: string;
  status: ApplicationStatus;
  requested_amount: number | string | null;
  purpose: string | null;
  monthly_income: number | string | null;
  employment_type: string | null;
  employer_name: string | null;
  designation: string | null;
  existing_debt: number | string | null;
  requested_tenure_months: number | null;
  credit_score: number | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};

export type LoanApplicationPayload = {
  requested_amount?: number | null;
  purpose?: string | null;
  monthly_income?: number | null;
  employment_type?: string | null;
  employer_name?: string | null;
  designation?: string | null;
  existing_debt?: number | null;
  requested_tenure_months?: number | null;
};

export type LoanApplicationListResponse = {
  items: LoanApplication[];
  total: number;
};
