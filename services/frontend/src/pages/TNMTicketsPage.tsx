/**
 * TNM Tickets list page
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useTNMTickets } from '../hooks/useTNMTickets';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { formatDate, formatCurrency } from '../utils/formatters';
import { TNMStatus } from '../types/tnmTicket';

export const TNMTicketsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TNMStatus | ''>('');

  const { data: tickets, isLoading } = useTNMTickets({
    search: search || undefined,
    status: statusFilter || undefined,
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TNM Tickets</h1>
          <p className="mt-1 text-sm text-gray-600">Manage change order tickets</p>
        </div>
        <Link to="/tnm/create">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New TNM Ticket
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search TNM tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TNMStatus | '')}
              className="input-field"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_review">Pending Review</option>
              <option value="ready_to_send">Ready to Send</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RFCO / TNM #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proposal Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proposal Amount
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Approved Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Response Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tickets?.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <Link
                      to={`/tnm/${ticket.id}`}
                      className="text-sm font-medium text-primary-600 hover:text-primary-800"
                    >
                      {ticket.rfco_number || ticket.tnm_number}
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate" title={ticket.title}>
                      {ticket.title}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{ticket.project_number}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {formatDate(ticket.proposal_date)}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(ticket.proposal_amount)}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <div className={`text-sm font-semibold ${ticket.approved_amount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {ticket.approved_amount > 0 ? formatCurrency(ticket.approved_amount) : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {ticket.response_date ? formatDate(ticket.response_date) : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <StatusBadge status={ticket.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {tickets?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No TNM tickets found</p>
        </div>
      )}
    </div>
  );
};
