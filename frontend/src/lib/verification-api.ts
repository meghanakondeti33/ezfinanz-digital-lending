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
    `/loans/applications/${applicationId}/verification`
  );
  return response.data;
}

export async function submitKYC(
  applicationId: string,
  payload: KYCSubmitPayload
): Promise<KYCData> {
  const response = await apiClient.post<KYCData>(
    `/loans/applications/${applicationId}/kyc`,
    payload
  );
  return response.data;
}

export async function fetchKYC(applicationId: string): Promise<KYCData> {
  const response = await apiClient.get<KYCData>(
    `/loans/applications/${applicationId}/kyc`
  );
  return response.data;
}

export async function uploadKYCDocument(
  applicationId: string,
  pdfFile: File
): Promise<{ status: string; filename: string; uploaded_at: string; message: string }> {
  const formData = new FormData();
  formData.append('file', pdfFile, pdfFile.name);

  const response = await apiClient.post<{ status: string; filename: string; uploaded_at: string; message: string }>(
    `/loans/applications/${applicationId}/kyc/document`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

export async function submitBankAccount(
  applicationId: string,
  payload: BankAccountSubmitPayload
): Promise<BankAccountData> {
  const response = await apiClient.post<BankAccountData>(
    `/loans/applications/${applicationId}/bank-account`,
    payload
  );
  return response.data;
}

export async function fetchBankAccount(applicationId: string): Promise<BankAccountData> {
  const response = await apiClient.get<BankAccountData>(
    `/loans/applications/${applicationId}/bank-account`
  );
  return response.data;
}

export async function submitSelfie(
  applicationId: string,
  payload: SelfieSubmitPayload = {}
): Promise<SelfieData> {
  const response = await apiClient.post<SelfieData>(
    `/loans/applications/${applicationId}/selfie`,
    payload
  );
  return response.data;
}

export async function uploadSelfie(
  applicationId: string,
  imageFileOrBlob: Blob | File,
  filename: string = 'camera_capture.jpg'
): Promise<SelfieData> {
  const formData = new FormData();
  formData.append('file', imageFileOrBlob, filename);

  const response = await apiClient.post<SelfieData>(
    `/loans/applications/${applicationId}/selfie/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

export async function fetchSelfie(applicationId: string): Promise<SelfieData> {
  const response = await apiClient.get<SelfieData>(
    `/loans/applications/${applicationId}/selfie`
  );
  return response.data;
}

export async function submitDeclaration(
  applicationId: string,
  payload: DeclarationSubmitPayload
): Promise<DeclarationData> {
  const response = await apiClient.post<DeclarationData>(
    `/loans/applications/${applicationId}/declaration`,
    payload
  );
  return response.data;
}

export async function fetchDeclaration(applicationId: string): Promise<DeclarationData> {
  const response = await apiClient.get<DeclarationData>(
    `/loans/applications/${applicationId}/declaration`
  );
  return response.data;
}
