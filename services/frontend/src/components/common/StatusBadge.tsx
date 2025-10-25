/**
 * Status Badge component
 */

import React from 'react';
import { TNMStatus } from '../../types/tnmTicket';

interface StatusBadgeProps {
  status: TNMStatus | string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-800',
  },
  pending_review: {
    label: 'Pending Review',
    className: 'bg-yellow-100 text-yellow-800',
  },
  ready_to_send: {
    label: 'Ready to Send',
    className: 'bg-blue-100 text-blue-800',
  },
  sent: {
    label: 'Sent',
    className: 'bg-purple-100 text-purple-800',
  },
  viewed: {
    label: 'Viewed',
    className: 'bg-indigo-100 text-indigo-800',
  },
  partially_approved: {
    label: 'Partially Approved',
    className: 'bg-orange-100 text-orange-800',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800',
  },
  denied: {
    label: 'Denied',
    className: 'bg-red-100 text-red-800',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-600',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const config = statusConfig[status] || {
    label: status,
    className: 'bg-gray-100 text-gray-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
};
