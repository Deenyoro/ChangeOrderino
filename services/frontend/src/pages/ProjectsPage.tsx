/**
 * Projects list page
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { formatDate } from '../utils/formatters';

export const ProjectsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [showActive, setShowActive] = useState(true);

  const { data: projects, isLoading } = useProjects({
    is_active: showActive,
    search: search || undefined,
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-600">Manage your construction projects</p>
        </div>
        <Link to="/projects/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Project
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
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showActive}
                onChange={(e) => setShowActive(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Active only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <Link key={project.id} to={`/projects/${project.id}`}>
            <div className="card hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                {project.is_active && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">Project #{project.project_number}</p>
              {project.customer_company && (
                <p className="text-sm text-gray-600 mb-2">Customer: {project.customer_company}</p>
              )}
              {project.gc_company && (
                <p className="text-sm text-gray-600 mb-2">GC: {project.gc_company}</p>
              )}
              <p className="text-xs text-gray-500">
                Created: {formatDate(project.created_at)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {projects?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No projects found</p>
        </div>
      )}
    </div>
  );
};
