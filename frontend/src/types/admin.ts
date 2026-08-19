import type {
  BankAccountData,
  DeclarationData,
  KYCData,
  SelfieData,
} from './verification';

export interface AdminDashboardStats {
  total_applications: number;
  under_review_count: number;
  approved_count: number;
  rejected_count: number;
  other_count: number;
}

export interface AdminApplicationQueueItem {
  id: string;
  application_number: string;
  customer_name?: string | null;
  customer_email: string;
  customer_phone: string;
  requested_amount?: number | null;
  purpose?: string | null;
  status: string;
  eligibility_status?: string | null;
  eligibility_score?: number | null;
  selected_offer_amount?: number | null;
  selected_offer_rate?: number | null;
  selected_offer_emi?: number | null;
  verification_status: string;
  created_at: string;
  updated_at: string;
}

export interface AdminApplicationQueueResponse {
  total: number;
  applications: AdminApplicationQueueItem[];
}

export interface AdminReviewAuditLogItem {
  id: string;
  action: string;
  actor_email?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface AdminReviewItem {
  id: string;
  admin_email: string;
  decision: string;
  remarks?: string | null;
  created_at: string;
}

export interface AdminCustomerProfile {
  user_id: string;
  email: string;
  phone: string;
  full_name?: string | null;
}

export interface AdminLoanDetails {
  requested_amount?: number | null;
  purpose?: string | null;
  monthly_income?: number | null;
  employment_type?: string | null;
  employer_name?: string | null;
  existing_debt?: number | null;
  requested_tenure_months?: number | null;
}

export interface AdminEligibilityDetails {
  status?: string | null;
  score?: number | null;
  dti_ratio?: number | null;
  reasons?: string[] | null;
  calculated_at?: string | null;
}

export interface AdminSelectedOfferDetails {
  principal?: number | null;
  interest_rate?: number | null;
  tenure_months?: number | null;
  emi?: number | null;
  processing_fee?: number | null;
  gst?: number | null;
  total_charges?: number | null;
  net_disbursement?: number | null;
  total_interest?: number | null;
  total_repayment?: number | null;
}

export interface AdminVerificationDetails {
  status: string;
  kyc?: KYCData | null;
  bank_account?: BankAccountData | null;
  selfie?: SelfieData | null;
  declaration?: DeclarationData | null;
}

export interface AdminApplicationDetail {
  id: string;
  application_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
  customer: AdminCustomerProfile;
  loan_details: AdminLoanDetails;
  eligibility?: AdminEligibilityDetails | null;
  selected_offer?: AdminSelectedOfferDetails | null;
  verification: AdminVerificationDetails;
  audit_logs: AdminReviewAuditLogItem[];
  admin_reviews: AdminReviewItem[];
}

export interface AdminDecisionPayload {
  decision: 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
  remarks?: string;
}

export interface AdminDecisionResponse {
  application_id: string;
  application_number: string;
  status: string;
  decision: string;
  remarks?: string | null;
  reviewed_at: string;
  reviewed_by: string;
}
