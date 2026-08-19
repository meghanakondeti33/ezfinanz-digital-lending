export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type IDType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'DRIVING_LICENSE' | 'VOTER_ID';
export type SelfieVerificationType = 'LIVE_PHOTO' | 'DOCUMENT_MATCH';
export type SelfieVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'PHOTO_PENDING_REVIEW'
  | 'PHOTO_APPROVED'
  | 'PHOTO_RETAKE_REQUIRED';

export interface KYCData {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  pincode: string;
  id_type: IDType;
  id_number_masked: string;
  status: string;
  document_status?: string | null;
  document_filename?: string | null;
  document_rejection_reason?: string | null;
  document_uploaded_at?: string | null;
  created_at: string;
}

export interface KYCSubmitPayload {
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  pincode: string;
  id_type: IDType;
  id_number: string;
  document_storage_key?: string;
}

export interface BankAccountData {
  id: string;
  application_id: string;
  account_holder_name: string;
  account_number_masked: string;
  account_number_last4: string;
  ifsc: string;
  bank_name: string;
  status: string;
  created_at: string;
}

export interface BankAccountSubmitPayload {
  account_holder_name: string;
  account_number: string;
  ifsc: string;
  bank_name: string;
}

export interface SelfieData {
  id: string;
  application_id: string;
  verification_type: SelfieVerificationType;
  status: SelfieVerificationStatus;
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  photo_url?: string | null;
  submitted_at: string;
}

export interface SelfieSubmitPayload {
  storage_key?: string;
  verification_type?: SelfieVerificationType;
}

export interface DeclarationData {
  id: string;
  application_id: string;
  accepted: boolean;
  declaration_version: string;
  accepted_at: string;
}

export interface DeclarationSubmitPayload {
  accepted: boolean;
  declaration_version?: string;
}

export interface VerificationSummary {
  application_id: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  kyc: 'NOT_STARTED' | 'VERIFIED' | 'FAILED';
  bank_account: 'NOT_STARTED' | 'VERIFIED' | 'FAILED';
  selfie:
    | 'NOT_STARTED'
    | 'PHOTO_PENDING_REVIEW'
    | 'PHOTO_APPROVED'
    | 'PHOTO_RETAKE_REQUIRED'
    | 'VERIFIED'
    | 'FAILED';
  selfie_details?: SelfieData | null;
  declaration: 'NOT_STARTED' | 'ACCEPTED';
  is_ready_for_review: boolean;
}
