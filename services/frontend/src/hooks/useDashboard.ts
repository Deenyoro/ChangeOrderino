/**
 * Dashboard statistics hooks
 */

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { tnmTicketsApi } from '../api/tnmTickets';
import { TNMStatus } from '../types/tnmTicket';

export const useDashboardStats = (params?: {
  project_id?: string;
  time_range?: 'week' | 'month' | 'year' | '2years' | '3years' | 'custom';
  date_from?: string;
  date_to?: string;
}) => {
  return useQuery({
    queryKey: ['dashboard-stats', params],
    queryFn: () => dashboardApi.getStats(params),
  });
};

/**
 * Hook to get tickets with overdue or upcoming due dates
 */
export const useTicketsWithDueDates = () => {
  return useQuery({
    queryKey: ['tickets-with-due-dates'],
    queryFn: async () => {
      const allTickets = await tnmTicketsApi.getAll();
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today

      const ticketsWithDueDates = allTickets.filter(ticket => ticket.due_date);

      const overdue = ticketsWithDueDates.filter(ticket => {
        const dueDate = new Date(ticket.due_date!);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < now && !ticket.response_date &&
               (ticket.status === TNMStatus.SENT || ticket.status === TNMStatus.VIEWED);
      });

      const upcoming = ticketsWithDueDates.filter(ticket => {
        const dueDate = new Date(ticket.due_date!);
        dueDate.setHours(0, 0, 0, 0);
        const sevenDaysFromNow = new Date(now);
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        return dueDate >= now && dueDate <= sevenDaysFromNow && !ticket.response_date &&
               (ticket.status === TNMStatus.SENT || ticket.status === TNMStatus.VIEWED);
      });

      return {
        overdue: overdue.sort((a, b) =>
          new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
        ),
        upcoming: upcoming.sort((a, b) =>
          new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
        ),
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });
};
