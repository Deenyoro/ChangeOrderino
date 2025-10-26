/**
 * Email logs API client
 */

import apiClient from './client';

export interface EmailLog {
  id: string;
  tnm_ticket_id?: string;
  to_email: string;
  from_email: string;
  subject: string;
  email_type?: string;
  status: string;
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

export interface FailedEmailsStats {
  total_failed: number;
  failed_last_24h: number;
  failed_last_7d: number;
}

export const emailsApi = {
  /**
   * Get failed emails
   */
  getFailedEmails: async (params?: { limit?: number; offset?: number }): Promise<EmailLog[]> => {
    const response = await apiClient.get('v1/emails/failed', { params });
    return response.data;
  },

  /**
   * Get failed emails statistics
   */
  getFailedEmailsStats: async (): Promise<FailedEmailsStats> => {
    const response = await apiClient.get('v1/emails/failed/stats');
    return response.data;
  },

  /**
   * Get recently sent reminder emails (for verification system is working)
   */
  getRecentReminders: async (params?: { days?: number; limit?: number }): Promise<EmailLog[]> => {
    const response = await apiClient.get('v1/emails/recent-reminders', { params });
    return response.data;
  },

  /**
   * Retry a failed email
   */
  retryFailedEmail: async (emailId: string): Promise<void> => {
    await apiClient.post(`v1/emails/${emailId}/retry`);
  },
};
