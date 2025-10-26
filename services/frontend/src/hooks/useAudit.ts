/**
 * Audit log hooks
 */

import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../api/audit';

export const useEntityAuditLogs = (entityType: string, entityId: string | undefined) => {
  return useQuery({
    queryKey: ['audit-logs', entityType, entityId],
    queryFn: () => auditApi.getEntityAuditLogs(entityType, entityId!),
    enabled: !!entityId,
  });
};

export const useUserAuditLogs = (userId: string | undefined, limit: number = 100) => {
  return useQuery({
    queryKey: ['audit-logs', 'user', userId, limit],
    queryFn: () => auditApi.getUserAuditLogs(userId!, limit),
    enabled: !!userId,
  });
};
