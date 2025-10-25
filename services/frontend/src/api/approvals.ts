/**
 * Approval API endpoints (for GC approval page - no auth required)
 */

import axios from 'axios';
import { ApprovalPageData, ApprovalSubmission } from '../types/api';

// Get API base URL from runtime config with fallback to build-time env
const getApiBaseUrl = () => {
  const runtimeConfig = (window as any).__RUNTIME_CONFIG__ || {};
  return runtimeConfig.API_URL || import.meta.env.VITE_API_URL || '/api';
};

export const approvalsApi = {
  // Get approval page data (no auth required)
  getApprovalData: async (token: string) => {
    const baseURL = getApiBaseUrl();
    const response = await axios.get<ApprovalPageData>(
      `${baseURL}/v1/approvals/${token}/`
    );
    return response.data;
  },

  // Submit approval (no auth required)
  submitApproval: async (token: string, data: ApprovalSubmission) => {
    const baseURL = getApiBaseUrl();
    const response = await axios.post(
      `${baseURL}/v1/approvals/${token}/submit/`,
      data
    );
    return response.data;
  },
};
