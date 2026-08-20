import apiClient from './api-client';
import type {
  AdminApplicationDetail,
  AdminApplicationQueueResponse,
  AdminDashboardStats,
  AdminDecisionPayload,
  AdminDecisionResponse,
} from '../types/admin';

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const response = await apiClient.get<AdminDashboardStats>('/admin/dashboard/stats');
  return response.data;
}

export async function fetchAdminApplications(
  status?: string,
  search?: string,
  skip = 0,
  limit = 50
): Promise<AdminApplicationQueueResponse> {
  const params: Record<string, any> = { skip, limit };
  if (status && status !== 'ALL') params.status = status;
  if (search && search.trim()) params.search = search.trim();

  const response = await apiClient.get<AdminApplicationQueueResponse>('/admin/applications', {
    params,
  });
  return response.data;
}

export async function fetchAdminApplicationDetail(id: string): Promise<AdminApplicationDetail> {
  const response = await apiClient.get<AdminApplicationDetail>(`/admin/applications/${id}`);
  return response.data;
}

export async function submitAdminDecision(
  id: string,
  payload: AdminDecisionPayload
): Promise<AdminDecisionResponse> {
  const response = await apiClient.post<AdminDecisionResponse>(
    `/admin/applications/${id}/decision`,
    payload
  );
  return response.data;
}

export async function reviewAdminSelfie(
  applicationId: string,
  action: 'APPROVE' | 'REQUEST_RETAKE',
  reason?: string
): Promise<any> {
  const response = await apiClient.post(
    `/admin/applications/${applicationId}/selfie/review`,
    { action, reason }
  );
  return response.data;
}

export async function reviewAdminKycDocument(
  applicationId: string,
  action: 'APPROVE' | 'REJECT',
  reason?: string
): Promise<any> {
  const response = await apiClient.post(
    `/admin/applications/${applicationId}/kyc/review`,
    { action, reason }
  );
  return response.data;
}

