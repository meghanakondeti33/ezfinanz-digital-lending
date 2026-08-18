import apiClient from './api-client';
import type {
  BankAccountData,
  BankAccountSubmitPayload,
  DeclarationData,
  DeclarationSubmitPayload,
  KYCData,
  KYCSubmitPayload,
  SelfieData,
  SelfieSubmitPayload,
  VerificationSummary,
} from '../types/verification';

export async function fetchVerificationSummary(applicationId: string): Promise<VerificationSummary> {
  const response = await apiClient.get<VerificationSummary>(
    `/api/v1/loans/applications/${applicationId}/verification`
  );
  return response.data;
}

export async function submitKYC(
  applicationId: string,
  payload: KYCSubmitPayload
): Promise<KYCData> {
  const response = await apiClient.post<KYCData>(
    `/api/v1/loans/applications/${applicationId}/kyc`,
    payload
  );
  return response.data;
}

export async function fetchKYC(applicationId: string): Promise<KYCData> {
  const response = await apiClient.get<KYCData>(
    `/api/v1/loans/applications/${applicationId}/kyc`
  );
  return response.data;
}

export async function submitBankAccount(
  applicationId: string,
  payload: BankAccountSubmitPayload
): Promise<BankAccountData> {
  const response = await apiClient.post<BankAccountData>(
    `/api/v1/loans/applications/${applicationId}/bank-account`,
    payload
  );
  return response.data;
}

export async function fetchBankAccount(applicationId: string): Promise<BankAccountData> {
  const response = await apiClient.get<BankAccountData>(
    `/api/v1/loans/applications/${applicationId}/bank-account`
  );
  return response.data;
}

export async function submitSelfie(
  applicationId: string,
  payload: SelfieSubmitPayload = {}
): Promise<SelfieData> {
  const response = await apiClient.post<SelfieData>(
    `/api/v1/loans/applications/${applicationId}/selfie`,
    payload
  );
  return response.data;
}

export async function fetchSelfie(applicationId: string): Promise<SelfieData> {
  const response = await apiClient.get<SelfieData>(
    `/api/v1/loans/applications/${applicationId}/selfie`
  );
  return response.data;
}

export async function submitDeclaration(
  applicationId: string,
  payload: DeclarationSubmitPayload
): Promise<DeclarationData> {
  const response = await apiClient.post<DeclarationData>(
    `/api/v1/loans/applications/${applicationId}/declaration`,
    payload
  );
  return response.data;
}

export async function fetchDeclaration(applicationId: string): Promise<DeclarationData> {
  const response = await apiClient.get<DeclarationData>(
    `/api/v1/loans/applications/${applicationId}/declaration`
  );
  return response.data;
}
