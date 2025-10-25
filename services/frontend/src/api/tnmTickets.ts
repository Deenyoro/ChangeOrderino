/**
 * TNM Ticket API endpoints
 */

import apiClient from './client';
import { TNMTicket, TNMTicketFormData, TNMStatus } from '../types/tnmTicket';

export const tnmTicketsApi = {
  // Get all TNM tickets
  getAll: async (params?: {
    project_id?: string;
    status?: TNMStatus;
    search?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const response = await apiClient.get<TNMTicket[]>('v1/tnm-tickets', { params });
    return response.data;
  },

  // Get single TNM ticket
  getById: async (id: string) => {
    const response = await apiClient.get<TNMTicket>(`v1/tnm-tickets/${id}`);
    return response.data;
  },

  // Get TNM ticket by number
  getByNumber: async (tnmNumber: string) => {
    const response = await apiClient.get<TNMTicket>(`v1/tnm-tickets/number/${tnmNumber}`);
    return response.data;
  },

  // Create TNM ticket
  create: async (data: TNMTicketFormData) => {
    const response = await apiClient.post<TNMTicket>('v1/tnm-tickets', data);
    return response.data;
  },

  // Update TNM ticket
  update: async (id: string, data: Partial<TNMTicketFormData>) => {
    const response = await apiClient.put<TNMTicket>(`v1/tnm-tickets/${id}`, data);
    return response.data;
  },

  // Delete TNM ticket
  delete: async (id: string) => {
    await apiClient.delete(`v1/tnm-tickets/${id}`);
  },

  // Update status
  updateStatus: async (id: string, status: TNMStatus) => {
    const response = await apiClient.patch<TNMTicket>(`v1/tnm-tickets/${id}/status`, {
      status,
    });
    return response.data;
  },

  // Send for approval
  sendForApproval: async (id: string) => {
    const response = await apiClient.post<TNMTicket>(`v1/tnm-tickets/${id}/send`);
    return response.data;
  },

  // Generate PDF
  generatePDF: async (id: string) => {
    const response = await apiClient.get(`v1/tnm-tickets/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Send reminder
  sendReminder: async (id: string) => {
    const response = await apiClient.post<any>(`v1/tnm-tickets/${id}/remind`);
    return response.data;
  },

  // Manual approval override
  manualApprovalOverride: async (
    id: string,
    data: {
      status: 'approved' | 'denied' | 'partially_approved';
      approved_amount?: number;
      reason?: string;
      notes?: string;
    }
  ) => {
    const response = await apiClient.patch<any>(`v1/tnm-tickets/${id}/manual-approval`, data);
    return response.data;
  },
};
