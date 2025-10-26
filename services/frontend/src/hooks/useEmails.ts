/**
 * Email logs hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailsApi } from '../api/emails';

export const useFailedEmails = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: ['failed-emails', params],
    queryFn: () => emailsApi.getFailedEmails(params),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useFailedEmailsStats = () => {
  return useQuery({
    queryKey: ['failed-emails-stats'],
    queryFn: () => emailsApi.getFailedEmailsStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useRecentReminders = (params?: { days?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['recent-reminders', params],
    queryFn: () => emailsApi.getRecentReminders(params),
    refetchInterval: 60000, // Refresh every 60 seconds
  });
};

export const useRetryEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emailId: string) => emailsApi.retryFailedEmail(emailId),
    onSuccess: () => {
      // Invalidate failed emails queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['failed-emails'] });
      queryClient.invalidateQueries({ queryKey: ['failed-emails-stats'] });
    },
  });
};
