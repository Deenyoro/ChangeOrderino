/**
 * Project detail page
 */

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit, Trash2, Archive, ArchiveRestore, FileText } from 'lucide-react';
import { useProject, useDeleteProject, useUpdateProject } from '../hooks/useProjects';
import { useTNMTickets } from '../hooks/useTNMTickets';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { ProjectForm } from '../components/projects/ProjectForm';
import { formatDate, formatCurrency } from '../utils/formatters';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { data: project, isLoading } = useProject(id!);
  const { data: tickets } = useTNMTickets({ project_id: id });
  const deleteMutation = useDeleteProject();
  const updateMutation = useUpdateProject();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Project not found</p>
      </div>
    );
  }

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(project.id);
    navigate('/projects');
  };

  const handleToggleActive = async () => {
    await updateMutation.mutateAsync({
      id: project.id,
      data: { is_active: !project.is_active },
    });
  };

  const totalProposalAmount = tickets?.reduce((sum, t) => sum + Number(t.proposal_amount), 0) || 0;
  const approvedAmount = tickets?.reduce((sum, t) => sum + Number(t.approved_amount), 0) || 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-sm text-gray-600">Project #{project.project_number}</p>
          </div>
          <div className="flex items-center gap-2">
            {project.is_active && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                Active
              </span>
            )}
            {!project.is_active && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                Archived
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button onClick={() => setIsEditModalOpen(true)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Project
        </Button>
        <Button variant="secondary" onClick={handleToggleActive}>
          {project.is_active ? (
            <>
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </>
          ) : (
            <>
              <ArchiveRestore className="w-4 h-4 mr-2" />
              Restore
            </>
          )}
        </Button>
        <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
        <Link to={`/tnm/create?project_id=${project.id}`}>
          <Button variant="primary">
            <FileText className="w-4 h-4 mr-2" />
            New TNM Ticket
          </Button>
        </Link>
      </div>

      {/* Project Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Basic Info */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-600">Project Name</dt>
              <dd className="font-medium text-gray-900">{project.name}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Project Number</dt>
              <dd className="font-medium text-gray-900">{project.project_number}</dd>
            </div>
            {project.project_manager_name && (
              <div>
                <dt className="text-gray-600">Project Manager</dt>
                <dd className="font-medium text-gray-900">{project.project_manager_name}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-600">Created</dt>
              <dd className="font-medium text-gray-900">{formatDate(project.created_at)}</dd>
            </div>
          </dl>
        </div>

        {/* Customer & GC */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer & GC</h3>
          <dl className="space-y-2 text-sm">
            {project.customer_company && (
              <div>
                <dt className="text-gray-600">Customer</dt>
                <dd className="font-medium text-gray-900">{project.customer_company}</dd>
              </div>
            )}
            {project.gc_company && (
              <div>
                <dt className="text-gray-600">GC Company</dt>
                <dd className="font-medium text-gray-900">{project.gc_company}</dd>
              </div>
            )}
            {project.gc_contact_name && (
              <div>
                <dt className="text-gray-600">GC Contact</dt>
                <dd className="font-medium text-gray-900">{project.gc_contact_name}</dd>
              </div>
            )}
            {project.gc_email && (
              <div>
                <dt className="text-gray-600">GC Email</dt>
                <dd className="font-medium text-gray-900">
                  <a href={`mailto:${project.gc_email}`} className="text-primary-600 hover:underline">
                    {project.gc_email}
                  </a>
                </dd>
              </div>
            )}
            {project.gc_phone && (
              <div>
                <dt className="text-gray-600">GC Phone</dt>
                <dd className="font-medium text-gray-900">{project.gc_phone}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* OH&P Defaults */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Default OH&P</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Materials</dt>
              <dd className="font-medium text-gray-900">{project.material_ohp_percent}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Labor</dt>
              <dd className="font-medium text-gray-900">{project.labor_ohp_percent}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Equipment</dt>
              <dd className="font-medium text-gray-900">{project.equipment_ohp_percent}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Subcontractor</dt>
              <dd className="font-medium text-gray-900">{project.subcontractor_ohp_percent}%</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Project Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <div className="text-sm text-gray-600">Total TNM Tickets</div>
          <div className="text-3xl font-bold text-gray-900">{tickets?.length || 0}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-600">Total Proposal Amount</div>
          <div className="text-3xl font-bold text-gray-900">{formatCurrency(totalProposalAmount)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-600">Total Approved Amount</div>
          <div className="text-3xl font-bold text-green-600">{formatCurrency(approvedAmount)}</div>
        </div>
      </div>

      {/* TNM Tickets */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">TNM Tickets</h3>
        {tickets && tickets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">TNM #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proposal Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/tnm/${ticket.id}`} className="text-primary-600 hover:text-primary-800 font-medium">
                        {ticket.tnm_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4">{ticket.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {formatCurrency(ticket.proposal_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(ticket.proposal_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No TNM tickets yet for this project
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Project"
        size="xl"
      >
        <ProjectForm
          project={project}
          onSuccess={() => setIsEditModalOpen(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Project"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleteMutation.isPending}>
              Delete Project
            </Button>
          </>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to delete this project? This will also delete all associated TNM tickets.
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};
