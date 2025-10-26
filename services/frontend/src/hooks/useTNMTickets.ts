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
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create TNM ticket');
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
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update TNM ticket');
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
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update status');
    },
  });
};

export const useSendTNMForApproval = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { gc_email: string; gc_name?: string; message?: string } }) =>
      tnmTicketsApi.sendForApproval(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tnm-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tnm-ticket', variables.id] });
      toast.success('TNM ticket sent for approval');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send TNM ticket');
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
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete TNM ticket');
    },
  });
};

export const useSendReminder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tnmTicketsApi.sendReminder(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tnm-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tnm-ticket', id] });
      toast.success('Reminder sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send reminder');
    },
  });
};

export const useManualApprovalOverride = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        status: 'approved' | 'denied' | 'partially_approved' | 'sent';
        approved_amount?: number;
        reason?: string;
        notes?: string;
      };
    }) => tnmTicketsApi.manualApprovalOverride(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tnm-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tnm-ticket', variables.id] });
      toast.success('Approval status updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update approval status');
    },
  });
};

export const useBulkApprove = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      ticket_ids: string[];
      status: 'approved' | 'denied' | 'partially_approved' | 'sent';
      approved_amount?: number;
      reason?: string;
      notes?: string;
    }) => tnmTicketsApi.bulkApprove(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tnm-tickets'] });
      toast.success('Tickets updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to bulk approve tickets');
    },
  });
};

export const useBulkMarkAsPaid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      ticket_ids: string[];
      is_paid: boolean;
      notes?: string;
    }) => tnmTicketsApi.bulkMarkAsPaid(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tnm-tickets'] });
      toast.success('Payment status updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update payment status');
    },
  });
};

export const useEditTNMTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
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
        notes?: string;
        edit_reason?: string;
      };
    }) => tnmTicketsApi.editTicket(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tnm-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tnm-ticket', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs', 'tnm_ticket', variables.id] });
      toast.success('Ticket updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update ticket');
    },
  });
};
