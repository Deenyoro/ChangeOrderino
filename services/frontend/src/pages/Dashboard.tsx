/**
 * Dashboard page
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock, CheckCircle, AlertCircle, RefreshCw, DollarSign, CreditCard, AlertTriangle, Calendar } from 'lucide-react';
import { useDashboardStats, useTicketsWithDueDates } from '../hooks/useDashboard';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { formatDate, formatCurrency } from '../utils/formatters';

export const Dashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year' | '2years' | '3years' | undefined>(undefined);

  const { data: stats, isLoading, isError, refetch } = useDashboardStats({ time_range: timeRange });
  const { data: dueDateData, isLoading: dueDatesLoading } = useTicketsWithDueDates();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Error handling
  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="card max-w-md text-center">
          <div className="text-red-600 mb-4">
            <AlertCircle className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-6">Failed to load dashboard statistics.</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      name: 'Total Tickets',
      value: stats?.totals.all_tickets || 0,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Pending Review',
      value: stats?.pending.needs_review || 0,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      name: 'Awaiting GC Response',
      value: stats?.pending.awaiting_gc_response || 0,
      icon: AlertCircle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: 'Approved',
      value: (stats?.counts_by_status.approved || 0) + (stats?.counts_by_status.partially_approved || 0),
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Paid Tickets',
      value: stats?.totals.paid_ticket_count || 0,
      icon: CreditCard,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      name: 'Total Paid Amount',
      value: `$${(stats?.totals.total_paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-green-700',
      bgColor: 'bg-green-100',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">Overview of your change orders and projects</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="time-range" className="text-sm font-medium text-gray-700">
              Time Range:
            </label>
            <select
              id="time-range"
              value={timeRange || ''}
              onChange={(e) => setTimeRange(e.target.value as any || undefined)}
              className="input-field py-2"
            >
              <option value="">All Time</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
              <option value="2years">Last 2 Years</option>
              <option value="3years">Last 3 Years</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {statCards.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Due Date Alerts */}
      {!dueDatesLoading && dueDateData && (dueDateData.overdue.length > 0 || dueDateData.upcoming.length > 0) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
          {/* Overdue Tickets */}
          {dueDateData.overdue.length > 0 && (
            <div className="card border-l-4 border-red-500">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
                  <h3 className="text-lg font-semibold text-red-900">
                    Overdue Responses ({dueDateData.overdue.length})
                  </h3>
                </div>
                <Link to="/tnm-tickets" className="text-sm text-red-600 hover:text-red-800 font-medium">
                  View All →
                </Link>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {dueDateData.overdue.slice(0, 5).map((ticket) => {
                  const daysOverdue = Math.floor(
                    (new Date().getTime() - new Date(ticket.due_date!).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <Link
                      key={ticket.id}
                      to={`/tnm/${ticket.id}`}
                      className="block p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 truncate">{ticket.tnm_number}</p>
                          <p className="text-sm text-gray-600 truncate">{ticket.title}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-semibold text-red-600">
                              {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                            </span>
                            <span className="text-xs text-gray-500">
                              Due: {formatDate(ticket.due_date!)}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(ticket.proposal_amount)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
                {dueDateData.overdue.length > 5 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    +{dueDateData.overdue.length - 5} more overdue ticket{dueDateData.overdue.length - 5 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Upcoming Due Dates */}
          {dueDateData.upcoming.length > 0 && (
            <div className="card border-l-4 border-orange-500">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Calendar className="w-6 h-6 text-orange-600 mr-2" />
                  <h3 className="text-lg font-semibold text-orange-900">
                    Due Within 7 Days ({dueDateData.upcoming.length})
                  </h3>
                </div>
                <Link to="/tnm-tickets" className="text-sm text-orange-600 hover:text-orange-800 font-medium">
                  View All →
                </Link>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {dueDateData.upcoming.slice(0, 5).map((ticket) => {
                  const daysUntilDue = Math.ceil(
                    (new Date(ticket.due_date!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <Link
                      key={ticket.id}
                      to={`/tnm/${ticket.id}`}
                      className="block p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 truncate">{ticket.tnm_number}</p>
                          <p className="text-sm text-gray-600 truncate">{ticket.title}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-semibold text-orange-600">
                              Due in {daysUntilDue} day{daysUntilDue !== 1 ? 's' : ''}
                            </span>
                            <span className="text-xs text-gray-500">
                              Due: {formatDate(ticket.due_date!)}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(ticket.proposal_amount)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
                {dueDateData.upcoming.length > 5 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    +{dueDateData.upcoming.length - 5} more upcoming
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/projects"
          className="card hover:shadow-md transition-shadow cursor-pointer"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">View Projects</h3>
          <p className="text-sm text-gray-600">Manage all your construction projects</p>
        </Link>

        <Link
          to="/tnm-tickets"
          className="card hover:shadow-md transition-shadow cursor-pointer"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">TNM Tickets</h3>
          <p className="text-sm text-gray-600">Review and manage change orders</p>
        </Link>

        <Link
          to="/tnm/create"
          className="card hover:shadow-md transition-shadow cursor-pointer"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Create TNM</h3>
          <p className="text-sm text-gray-600">Submit a new change order</p>
        </Link>
      </div>
    </div>
  );
};
