/**
 * Disbursement API client functions for Customer & Admin.
 */

import apiClient from './api-client';
import type { DisbursementDetail, DisbursementResponse } from '../types/disbursement';

/**
 * Fetch composite loan disbursement and approval details for customer.
 */
export async function fetchCustomerDisbursement(applicationId: string): Promise<DisbursementDetail> {
  const response = await apiClient.get<DisbursementDetail>(`/loans/applications/${applicationId}/disbursement`);
  return response.data;
}

/**
 * Admin: Initiate mock payout for approved loan application.
 */
export async function initiateAdminDisbursement(
  applicationId: string,
  remarks?: string
): Promise<DisbursementResponse> {
  const response = await apiClient.post<DisbursementResponse>(
    `/admin/applications/${applicationId}/disbursement/initiate`,
    { remarks }
  );
  return response.data;
}

/**
 * Admin: Confirm mock payout completion (transitions to DISBURSED).
 */
export async function confirmAdminDisbursement(
  applicationId: string,
  remarks?: string
): Promise<DisbursementResponse> {
  const response = await apiClient.post<DisbursementResponse>(
    `/admin/applications/${applicationId}/disbursement/confirm`,
    { remarks }
  );
  return response.data;
}

/**
 * Admin: Fetch full disbursement details.
 */
export async function fetchAdminDisbursement(applicationId: string): Promise<DisbursementDetail> {
  const response = await apiClient.get<DisbursementDetail>(`/admin/applications/${applicationId}/disbursement`);
  return response.data;
}
