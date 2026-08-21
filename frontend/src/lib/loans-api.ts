import apiClient from './api-client';
import type {
  EligibilityCheck,
  LoanApplication,
  LoanApplicationListResponse,
  LoanApplicationPayload,
  LoanOffer,
} from '../types/loan';

export async function fetchApplications(skip = 0, limit = 50): Promise<LoanApplicationListResponse> {
  const response = await apiClient.get<LoanApplicationListResponse>('/loans/applications', {
    params: { skip, limit },
  });
  return response.data;
}

export async function fetchApplication(id: string): Promise<LoanApplication> {
  const response = await apiClient.get<LoanApplication>(`/loans/applications/${id}`);
  return response.data;
}

export async function createApplication(data: LoanApplicationPayload = {}): Promise<LoanApplication> {
  const response = await apiClient.post<LoanApplication>('/loans/applications', data);
  return response.data;
}

export async function updateDraft(id: string, data: LoanApplicationPayload): Promise<LoanApplication> {
  const response = await apiClient.patch<LoanApplication>(`/loans/applications/${id}`, data);
  return response.data;
}

export async function submitApplication(id: string): Promise<LoanApplication> {
  const response = await apiClient.post<LoanApplication>(`/loans/applications/${id}/submit`);
  return response.data;
}

export async function checkEligibility(applicationId: string): Promise<EligibilityCheck> {
  const response = await apiClient.post<EligibilityCheck>(`/loans/applications/${applicationId}/eligibility`);
  return response.data;
}

export async function fetchOffers(applicationId: string): Promise<{ application_id: string; offers: LoanOffer[] }> {
  const response = await apiClient.get<{ application_id: string; offers: LoanOffer[] }>(
    `/loans/applications/${applicationId}/offers`
  );
  return response.data;
}

export async function selectOffer(applicationId: string, offerId: string): Promise<LoanOffer> {
  const response = await apiClient.post<LoanOffer>(
    `/loans/applications/${applicationId}/offers/${offerId}/select`
  );
  return response.data;
}

export async function deleteApplication(id: string): Promise<{ message: string; id: string }> {
  const response = await apiClient.delete<{ message: string; id: string }>(`/loans/applications/${id}`);
  return response.data;
}
