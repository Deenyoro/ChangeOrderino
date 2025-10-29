/**
 * TNM Tickets list page
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, CheckSquare, DollarSign, XCircle, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useTNMTickets } from '../hooks/useTNMTickets';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { formatDate, formatCurrency, formatDateTime } from '../utils/formatters';
import { TNMStatus } from '../types/tnmTicket';
import { tnmTicketsApi } from '../api/tnmTickets';
import { toast } from 'react-hot-toast';

type SortField = 'tnm_number' | 'title' | 'project_number' | 'proposal_date' | 'due_date' | 'proposal_amount' | 'approved_amount' | 'response_date' | 'status';
type SortDirection = 'asc' | 'desc';

export const TNMTicketsPage: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TNMStatus | ''>('');
  const [dueDateFilter, setDueDateFilter] = useState<'all' | 'overdue' | 'upcoming'>('all');
  const [sortField, setSortField] = useState<SortField>('proposal_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: allTickets, isLoading, refetch } = useTNMTickets({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  });

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Render sort icon for column header
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-30" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

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

    // Sort by selected field and direction
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'tnm_number':
          aValue = a.rfco_number || a.tnm_number;
          bValue = b.rfco_number || b.tnm_number;
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'project_number':
          aValue = a.project_number.toLowerCase();
          bValue = b.project_number.toLowerCase();
          break;
        case 'proposal_date':
          aValue = new Date(a.proposal_date).getTime();
          bValue = new Date(b.proposal_date).getTime();
          break;
        case 'due_date':
          aValue = a.due_date ? new Date(a.due_date).getTime() : 0;
          bValue = b.due_date ? new Date(b.due_date).getTime() : 0;
          break;
        case 'proposal_amount':
          aValue = a.proposal_amount;
          bValue = b.proposal_amount;
          break;
        case 'approved_amount':
          aValue = a.approved_amount;
          bValue = b.approved_amount;
          break;
        case 'response_date':
          aValue = a.response_date ? new Date(a.response_date).getTime() : 0;
          bValue = b.response_date ? new Date(b.response_date).getTime() : 0;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [allTickets, dueDateFilter, sortField, sortDirection]);

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
                onClick={handleBulkApprove}
                disabled={isProcessing}
                className="bg-green-600 text-white hover:bg-green-700 border-green-700 focus:ring-green-500"
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={handleBulkUndoApproval}
                disabled={isProcessing}
                className="bg-orange-600 text-white hover:bg-orange-700 border-orange-700 focus:ring-orange-500"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Undo Approval
              </Button>
              <Button
                onClick={handleBulkMarkAsPaid}
                disabled={isProcessing}
                className="bg-blue-600 text-white hover:bg-blue-700 border-blue-700 focus:ring-blue-500"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Mark Paid
              </Button>
              <Button
                onClick={handleBulkMarkAsUnpaid}
                disabled={isProcessing}
                className="bg-red-600 text-white hover:bg-red-700 border-red-700 focus:ring-red-500"
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
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
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
                  <button
                    onClick={() => handleSort('tnm_number')}
                    className="flex items-center hover:text-gray-700 transition-colors"
                  >
                    RFCO / TNM #
                    {renderSortIcon('tnm_number')}
                  </button>
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('title')}
                    className="flex items-center hover:text-gray-700 transition-colors"
                  >
                    Title
                    {renderSortIcon('title')}
                  </button>
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('project_number')}
                    className="flex items-center hover:text-gray-700 transition-colors"
                  >
                    Project
                    {renderSortIcon('project_number')}
                  </button>
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('proposal_date')}
                    className="flex items-center hover:text-gray-700 transition-colors"
                  >
                    Proposal Date
                    {renderSortIcon('proposal_date')}
                  </button>
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('due_date')}
                    className="flex items-center hover:text-gray-700 transition-colors"
                  >
                    Due Date
                    {renderSortIcon('due_date')}
                  </button>
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('proposal_amount')}
                    className="flex items-center hover:text-gray-700 transition-colors ml-auto"
                  >
                    Proposal Amount
                    {renderSortIcon('proposal_amount')}
                  </button>
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('approved_amount')}
                    className="flex items-center hover:text-gray-700 transition-colors ml-auto"
                  >
                    Approved Amount
                    {renderSortIcon('approved_amount')}
                  </button>
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('response_date')}
                    className="flex items-center hover:text-gray-700 transition-colors"
                  >
                    Response Date
                    {renderSortIcon('response_date')}
                  </button>
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reminders
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Reminder
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center hover:text-gray-700 transition-colors"
                  >
                    Status
                    {renderSortIcon('status')}
                  </button>
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
