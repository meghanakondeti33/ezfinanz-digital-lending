import apiClient from './api-client';
import type { LoanApplication, LoanApplicationListResponse, LoanApplicationPayload } from '../types/loan';

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
