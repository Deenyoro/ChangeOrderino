/**
 * TNM Tickets list page
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, CheckSquare, DollarSign, XCircle, RotateCcw } from 'lucide-react';
import { useTNMTickets } from '../hooks/useTNMTickets';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { formatDate, formatCurrency, formatDateTime } from '../utils/formatters';
import { TNMStatus } from '../types/tnmTicket';
import { tnmTicketsApi } from '../api/tnmTickets';
import { toast } from 'react-hot-toast';

export const TNMTicketsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TNMStatus | ''>('');
  const [dueDateFilter, setDueDateFilter] = useState<'all' | 'overdue' | 'upcoming'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'due_date' | 'amount'>('date');
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: allTickets, isLoading, refetch } = useTNMTickets({
    search: search || undefined,
    status: statusFilter || undefined,
  });

  // Filter and sort tickets
  const tickets = React.useMemo(() => {
    if (!allTickets) return [];

    let filtered = [...allTickets];

    // Filter by due date
    if (dueDateFilter === 'overdue') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      filtered = filtered.filter(ticket => {
        if (!ticket.due_date || ticket.response_date) return false;
        const dueDate = new Date(ticket.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < now;
      });
    } else if (dueDateFilter === 'upcoming') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const sevenDays = new Date(now);
      sevenDays.setDate(sevenDays.getDate() + 7);
      filtered = filtered.filter(ticket => {
        if (!ticket.due_date || ticket.response_date) return false;
        const dueDate = new Date(ticket.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate >= now && dueDate <= sevenDays;
      });
    }

    // Sort
    if (sortBy === 'due_date') {
      filtered.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
    } else if (sortBy === 'amount') {
      filtered.sort((a, b) => b.proposal_amount - a.proposal_amount);
    } else {
      // Default: sort by date (newest first)
      filtered.sort((a, b) => new Date(b.proposal_date).getTime() - new Date(a.proposal_date).getTime());
    }

    return filtered;
  }, [allTickets, dueDateFilter, sortBy]);

  // Checkbox handlers
  const handleSelectAll = () => {
    if (selectedTickets.size === tickets.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(tickets.map((t) => t.id)));
    }
  };

  const handleSelectTicket = (ticketId: string) => {
    const newSelected = new Set(selectedTickets);
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId);
    } else {
      newSelected.add(ticketId);
    }
    setSelectedTickets(newSelected);
  };

  // Bulk action handlers
  const handleBulkApprove = async () => {
    if (selectedTickets.size === 0) {
      toast.error('Please select at least one ticket');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to approve ${selectedTickets.size} ticket(s)?`
    );

    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const result = await tnmTicketsApi.bulkApprove({
        ticket_ids: Array.from(selectedTickets),
        status: 'approved',
        notes: 'Bulk approved from tickets page',
      });

      if (result.successful > 0) {
        toast.success(`Successfully approved ${result.successful} ticket(s)`);
      }
      if (result.failed > 0) {
        toast.error(`Failed to approve ${result.failed} ticket(s)`);
      }

      setSelectedTickets(new Set());
      refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to approve tickets');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkMarkAsPaid = async () => {
    if (selectedTickets.size === 0) {
      toast.error('Please select at least one ticket');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to mark ${selectedTickets.size} ticket(s) as paid?`
    );

    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const result = await tnmTicketsApi.bulkMarkAsPaid({
        ticket_ids: Array.from(selectedTickets),
        is_paid: true,
        notes: 'Bulk marked as paid from tickets page',
      });

      if (result.successful > 0) {
        toast.success(`Successfully marked ${result.successful} ticket(s) as paid`);
      }
      if (result.failed > 0) {
        toast.error(`Failed to mark ${result.failed} ticket(s) as paid`);
      }

      setSelectedTickets(new Set());
      refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to mark tickets as paid');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkUndoApproval = async () => {
    if (selectedTickets.size === 0) {
      toast.error('Please select at least one ticket');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to undo approval for ${selectedTickets.size} ticket(s)? This will reset them back to 'Sent' status and clear approval/payment information.`
    );

    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const result = await tnmTicketsApi.bulkApprove({
        ticket_ids: Array.from(selectedTickets),
        status: 'sent',
        notes: 'Bulk undo approval from tickets page',
      });

      if (result.successful > 0) {
        toast.success(`Successfully undid approval for ${result.successful} ticket(s)`);
      }
      if (result.failed > 0) {
        toast.error(`Failed to undo approval for ${result.failed} ticket(s)`);
      }

      setSelectedTickets(new Set());
      refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to undo approval for tickets');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkMarkAsUnpaid = async () => {
    if (selectedTickets.size === 0) {
      toast.error('Please select at least one ticket');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to mark ${selectedTickets.size} ticket(s) as unpaid? This will clear payment tracking information.`
    );

    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const result = await tnmTicketsApi.bulkMarkAsPaid({
        ticket_ids: Array.from(selectedTickets),
        is_paid: false,
        notes: 'Bulk marked as unpaid from tickets page',
      });

      if (result.successful > 0) {
        toast.success(`Successfully marked ${result.successful} ticket(s) as unpaid`);
      }
      if (result.failed > 0) {
        toast.error(`Failed to mark ${result.failed} ticket(s) as unpaid`);
      }

      setSelectedTickets(new Set());
      refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to mark tickets as unpaid');
    } finally {
      setIsProcessing(false);
    }
  };

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

      {/* Bulk Actions Bar */}
      {selectedTickets.size > 0 && (
        <div className="card mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-blue-900">
              {selectedTickets.size} ticket{selectedTickets.size !== 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="secondary"
                onClick={handleBulkApprove}
                disabled={isProcessing}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button
                variant="secondary"
                onClick={handleBulkUndoApproval}
                disabled={isProcessing}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Undo Approval
              </Button>
              <Button
                variant="secondary"
                onClick={handleBulkMarkAsPaid}
                disabled={isProcessing}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Mark Paid
              </Button>
              <Button
                variant="secondary"
                onClick={handleBulkMarkAsUnpaid}
                disabled={isProcessing}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Mark Unpaid
              </Button>
              <Button
                variant="secondary"
                onClick={() => setSelectedTickets(new Set())}
                disabled={isProcessing}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col gap-4">
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
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <label className="text-sm font-medium text-gray-700">Due Date Filter:</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setDueDateFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dueDateFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Tickets
              </button>
              <button
                onClick={() => setDueDateFilter('overdue')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dueDateFilter === 'overdue'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Overdue Only
              </button>
              <button
                onClick={() => setDueDateFilter('upcoming')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dueDateFilter === 'upcoming'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Due Within 7 Days
              </button>
            </div>
            <div className="ml-auto">
              <label className="text-sm font-medium text-gray-700 mr-2">Sort By:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="input-field inline-block w-auto"
              >
                <option value="date">Proposal Date</option>
                <option value="due_date">Due Date</option>
                <option value="amount">Amount</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={tickets.length > 0 && selectedTickets.size === tickets.length}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RFCO / TNM #
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proposal Date
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proposal Amount
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Approved Amount
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Response Date
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reminders
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Reminder
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tickets?.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedTickets.has(ticket.id)}
                      onChange={() => handleSelectTicket(ticket.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <Link
                      to={`/tnm/${ticket.id}`}
                      className="text-sm font-medium text-primary-600 hover:text-primary-800"
                    >
                      {ticket.rfco_number || ticket.tnm_number}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <div className="text-sm text-gray-900 max-w-xs truncate" title={ticket.title}>
                      {ticket.title}
                    </div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{ticket.project_number}</div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {formatDate(ticket.proposal_date)}
                    </div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {ticket.due_date ? (
                      <>
                        <div className={`text-sm font-semibold ${
                          new Date(ticket.due_date) < new Date() && !ticket.response_date
                            ? 'text-red-600'
                            : 'text-orange-600'
                        }`}>
                          {formatDate(ticket.due_date)}
                        </div>
                        {new Date(ticket.due_date) < new Date() && !ticket.response_date && (
                          <div className="text-xs text-red-500 font-medium">OVERDUE</div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-gray-400">—</div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(ticket.proposal_amount)}
                    </div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-right">
                    <div className={`text-sm font-semibold ${ticket.approved_amount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {ticket.approved_amount > 0 ? formatCurrency(ticket.approved_amount) : '—'}
                    </div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {ticket.response_date ? formatDate(ticket.response_date) : '—'}
                    </div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-center">
                    {ticket.reminder_count > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {ticket.reminder_count}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {ticket.last_reminder_sent_at ? (
                        <span title={formatDateTime(ticket.last_reminder_sent_at)}>
                          {formatDate(ticket.last_reminder_sent_at)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
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
