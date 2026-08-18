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
  | 'DISBURSED';

export type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED' | 'BUSINESS' | 'OTHER';

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
