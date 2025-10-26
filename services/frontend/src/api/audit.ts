/**
 * Audit Log API endpoints
 */

import apiClient from './client';

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const auditApi = {
  // Get audit logs for a specific entity
  getEntityAuditLogs: async (entityType: string, entityId: string) => {
    const response = await apiClient.get<AuditLog[]>(`v1/audit/${entityType}/${entityId}`);
    return response.data;
  },

  // Get audit logs for a specific user
  getUserAuditLogs: async (userId: string, limit: number = 100) => {
    const response = await apiClient.get<AuditLog[]>(`v1/audit/user/${userId}`, {
      params: { limit },
    });
    return response.data;
  },

  // List all audit logs with filters
  listAuditLogs: async (params?: {
    skip?: number;
    limit?: number;
    entity_type?: string;
    action?: string;
  }) => {
    const response = await apiClient.get<AuditLog[]>('v1/audit/', { params });
    return response.data;
  },
};
