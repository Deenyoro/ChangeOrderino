/**
 * TNM Tickets React Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tnmTicketsApi } from '../api/tnmTickets';
import { TNMTicketFormData, TNMStatus } from '../types/tnmTicket';
import toast from 'react-hot-toast';

export const useTNMTickets = (params?: {
  project_id?: string;
  status?: TNMStatus;
  search?: string;
}) => {
  return useQuery({
    queryKey: ['tnm-tickets', params],
    queryFn: () => tnmTicketsApi.getAll(params),
  });
};

export const useTNMTicket = (id: string) => {
  return useQuery({
    queryKey: ['tnm-ticket', id],
    queryFn: () => tnmTicketsApi.getById(id),
    enabled: !!id,
  });
};

export const useTNMTicketByNumber = (tnmNumber: string) => {
  return useQuery({
    queryKey: ['tnm-ticket', 'number', tnmNumber],
    queryFn: () => tnmTicketsApi.getByNumber(tnmNumber),
    enabled: !!tnmNumber,
  });
};

export const useCreateTNMTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TNMTicketFormData) => tnmTicketsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tnm-tickets'] });
      toast.success('TNM ticket created successfully');
    },
    onError: () => {
      toast.error('Failed to create TNM ticket');
    },
  });
};

export const useUpdateTNMTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TNMTicketFormData> }) =>
      tnmTicketsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tnm-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tnm-ticket', variables.id] });
      toast.success('TNM ticket updated successfully');
    },
    onError: () => {
      toast.error('Failed to update TNM ticket');
    },
  });
};

export const useUpdateTNMStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TNMStatus }) =>
      tnmTicketsApi.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tnm-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tnm-ticket', variables.id] });
      toast.success('Status updated successfully');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });
};

export const useSendTNMForApproval = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tnmTicketsApi.sendForApproval(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tnm-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tnm-ticket', id] });
      toast.success('TNM ticket sent for approval');
    },
    onError: () => {
      toast.error('Failed to send TNM ticket');
    },
  });
};

export const useDeleteTNMTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tnmTicketsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tnm-tickets'] });
      toast.success('TNM ticket deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete TNM ticket');
    },
  });
};
