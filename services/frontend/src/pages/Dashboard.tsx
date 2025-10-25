/**
 * Dashboard page
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, FolderKanban, Clock, CheckCircle } from 'lucide-react';
import { useTNMTickets } from '../hooks/useTNMTickets';
import { useProjects } from '../hooks/useProjects';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const Dashboard: React.FC = () => {
  const { data: tickets, isLoading: ticketsLoading } = useTNMTickets();
  const { data: projects, isLoading: projectsLoading } = useProjects({ is_active: true });

  if (ticketsLoading || projectsLoading) {
    return <LoadingSpinner />;
  }

  const pendingTickets = tickets?.filter(t => t.status === 'pending_review').length || 0;
  const sentTickets = tickets?.filter(t => t.status === 'sent').length || 0;
  const approvedTickets = tickets?.filter(t => t.status === 'approved').length || 0;

  const stats = [
    {
      name: 'Active Projects',
      value: projects?.length || 0,
      icon: FolderKanban,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Pending Review',
      value: pendingTickets,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      name: 'Sent to GC',
      value: sentTickets,
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: 'Approved',
      value: approvedTickets,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">Overview of your change orders and projects</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
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
