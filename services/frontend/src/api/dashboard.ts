/**
 * Dashboard statistics API endpoints
 */

import apiClient from './client';

export interface DashboardStats {
  counts_by_status: Record<string, number>;
  totals: {
    all_tickets: number;
    total_proposal_amount: number;
    total_approved_amount: number;
    approval_rate: number;
    paid_ticket_count: number;
    total_paid_amount: number;
  };
  recent_activity: {
    created_this_week: number;
    created_this_month: number;
    sent_this_week: number;
    approved_this_week: number;
  };
  pending: {
    needs_review: number;
    awaiting_gc_response: number;
    overdue_responses: number;
  };
  performance: {
    avg_review_time_hours: number;
    avg_response_time_days: number;
    fastest_approval_days: number;
    slowest_approval_days: number;
  };
  by_project: Array<{
    project_id: string;
    project_name: string;
    project_number: string;
    ticket_count: number;
    total_amount: number;
    approved_amount: number;
  }>;
}

export const dashboardApi = {
  // Get dashboard statistics
  getStats: async (params?: {
    project_id?: string;
    time_range?: 'week' | 'month' | 'year' | '2years' | '3years' | 'custom';
    date_from?: string;
    date_to?: string;
  }) => {
    const response = await apiClient.get<DashboardStats>('v1/dashboard/stats', { params });
    return response.data;
  },
};
