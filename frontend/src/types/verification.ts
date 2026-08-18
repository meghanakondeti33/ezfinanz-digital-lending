export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type IDType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'DRIVING_LICENSE' | 'VOTER_ID';
export type SelfieVerificationType = 'LIVE_PHOTO' | 'DOCUMENT_MATCH';
export type SelfieVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

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
  selfie: 'NOT_STARTED' | 'VERIFIED' | 'FAILED';
  declaration: 'NOT_STARTED' | 'ACCEPTED';
  is_ready_for_review: boolean;
}
