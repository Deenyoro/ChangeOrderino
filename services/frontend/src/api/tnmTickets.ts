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
    const response = await apiClient.get<TNMTicket[]>('v1/tnm-tickets/', { params });
    return response.data;
  },

  // Get single TNM ticket
  getById: async (id: string) => {
    const response = await apiClient.get<TNMTicket>(`v1/tnm-tickets/${id}/`);
    return response.data;
  },

  // Get TNM ticket by number
  getByNumber: async (tnmNumber: string) => {
    const response = await apiClient.get<TNMTicket>(`v1/tnm-tickets/number/${tnmNumber}/`);
    return response.data;
  },

  // Create TNM ticket
  create: async (data: TNMTicketFormData) => {
    const response = await apiClient.post<TNMTicket>('v1/tnm-tickets/', data);
    return response.data;
  },

  // Update TNM ticket
  update: async (id: string, data: Partial<TNMTicketFormData>) => {
    const response = await apiClient.put<TNMTicket>(`v1/tnm-tickets/${id}/`, data);
    return response.data;
  },

  // Delete TNM ticket
  delete: async (id: string) => {
    await apiClient.delete(`v1/tnm-tickets/${id}/`);
  },

  // Update status
  updateStatus: async (id: string, status: TNMStatus) => {
    const response = await apiClient.patch<TNMTicket>(`v1/tnm-tickets/${id}/status/`, {
      status,
    });
    return response.data;
  },

  // Send for approval
  sendForApproval: async (id: string, data: { gc_email: string; gc_name?: string; message?: string }) => {
    const response = await apiClient.post<TNMTicket>(`v1/tnm-tickets/${id}/send/`, data);
    return response.data;
  },

  // Generate PDF
  generatePDF: async (id: string) => {
    const response = await apiClient.get(`v1/tnm-tickets/${id}/pdf/`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Send reminder
  sendReminder: async (id: string) => {
    const response = await apiClient.post<any>(`v1/tnm-tickets/${id}/remind/`);
    return response.data;
  },

  // Manual approval override
  manualApprovalOverride: async (
    id: string,
    data: {
      status: 'approved' | 'denied' | 'partially_approved' | 'sent';
      approved_amount?: number;
      reason?: string;
      notes?: string;
    }
  ) => {
    const response = await apiClient.patch<any>(`v1/tnm-tickets/${id}/manual-approval/`, data);
    return response.data;
  },

  // Mark as paid
  markAsPaid: async (
    id: string,
    data: {
      is_paid: boolean;
      notes?: string;
    }
  ) => {
    const response = await apiClient.patch<any>(`v1/tnm-tickets/${id}/mark-paid/`, data);
    return response.data;
  },

  // Bulk approve
  bulkApprove: async (data: {
    ticket_ids: string[];
    status: 'approved' | 'denied' | 'partially_approved' | 'sent';
    approved_amount?: number;
    reason?: string;
    notes?: string;
  }) => {
    const response = await apiClient.post<{
      total: number;
      successful: number;
      failed: number;
      results: Array<{
        ticket_id: string;
        tnm_number: string;
        success: boolean;
        error?: string;
      }>;
    }>('v1/tnm-tickets/bulk/approve/', data);
    return response.data;
  },

  // Bulk mark as paid
  bulkMarkAsPaid: async (data: {
    ticket_ids: string[];
    is_paid: boolean;
    notes?: string;
  }) => {
    const response = await apiClient.post<{
      total: number;
      successful: number;
      failed: number;
      results: Array<{
        ticket_id: string;
        tnm_number: string;
        success: boolean;
        error?: string;
      }>;
    }>('v1/tnm-tickets/bulk/mark-paid/', data);
    return response.data;
  },

  // Edit TNM ticket
  editTicket: async (
    id: string,
    data: {
      title?: string;
      description?: string;
      submitter_name?: string;
      submitter_email?: string;
      proposal_date?: string;
      response_date?: string;
      due_date?: string;
      material_ohp_percent?: number;
      labor_ohp_percent?: number;
      equipment_ohp_percent?: number;
      subcontractor_ohp_percent?: number;
      rate_project_manager?: number;
      rate_superintendent?: number;
      rate_carpenter?: number;
      rate_laborer?: number;
      signature_url?: string;
      notes?: string;
      edit_reason?: string;
    }
  ) => {
    const response = await apiClient.patch<TNMTicket>(`v1/tnm-tickets/${id}/edit/`, data);
    return response.data;
  },
};
