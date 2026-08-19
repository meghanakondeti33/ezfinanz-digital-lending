/**
 * TypeScript Interfaces for Phase 7 Loan Disbursement Lifecycle.
 */

export type DisbursementStatus = 'PENDING' | 'INITIATED' | 'SUCCESS' | 'FAILED';

export interface DisbursementResponse {
  disbursement_id: string;
  application_id: string;
  application_number: string;
  approved_amount: number | string;
  net_disbursement_amount: number | string;
  disbursement_reference: string;
  destination_account_summary: string | null;
  status: DisbursementStatus;
  application_status: string;
  initiated_at: string;
  completed_at: string | null;
}

export interface DisbursementDetail {
  application_id: string;
  application_number: string;
  application_status: string;
  approved_amount: number;
  net_disbursement_amount: number;
  selected_offer_id: string | null;
  interest_rate: number | null;
  tenure_months: number | null;
  emi: number | null;
  processing_fee: number | null;
  gst: number | null;
  total_interest: number | null;
  total_repayment: number | null;
  approval_date: string | null;
  reviewed_by: string | null;
  disbursement_id: string | null;
  disbursement_reference: string | null;
  disbursement_status: DisbursementStatus | string | null;
  destination_bank_name: string | null;
  destination_account_last4: string | null;
  destination_ifsc: string | null;
  account_holder_name: string | null;
  initiated_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
}
