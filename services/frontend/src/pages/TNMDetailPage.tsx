/**
 * TNM Ticket Detail/Review Page - Admin view with full controls
 */

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Send, Mail, FileDown } from 'lucide-react';
import { useTNMTicket, useUpdateTNMStatus, useSendTNMForApproval, useDeleteTNMTicket, useUpdateTNMTicket } from '../hooks/useTNMTickets';
import { useProject } from '../hooks/useProjects';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { LaborItemTable } from '../components/tnm/LaborItemTable';
import { MaterialItemTable } from '../components/tnm/MaterialItemTable';
import { EquipmentItemTable } from '../components/tnm/EquipmentItemTable';
import { SubcontractorItemTable } from '../components/tnm/SubcontractorItemTable';
import { TNMSummary } from '../components/tnm/TNMSummary';
import { SignatureDisplay } from '../components/common/SignaturePad';
import { formatDate, formatDateTime, formatCurrency } from '../utils/formatters';
import { TNMStatus } from '../types/tnmTicket';

export const TNMDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isOHPEditModalOpen, setIsOHPEditModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [gcEmail, setGcEmail] = useState('');
  const [customOHP, setCustomOHP] = useState({
    labor: 0,
    material: 0,
    equipment: 0,
    subcontractor: 0,
  });

  const { data: ticket, isLoading } = useTNMTicket(id!);
  const { data: project } = useProject(ticket?.project_id || '');
  const updateStatusMutation = useUpdateTNMStatus();
  const sendMutation = useSendTNMForApproval();
  const deleteMutation = useDeleteTNMTicket();
  const updateMutation = useUpdateTNMTicket();

  React.useEffect(() => {
    if (ticket) {
      setCustomOHP({
        labor: ticket.labor_ohp_percent,
        material: ticket.material_ohp_percent,
        equipment: ticket.equipment_ohp_percent,
        subcontractor: ticket.subcontractor_ohp_percent,
      });
    }
  }, [ticket]);

  React.useEffect(() => {
    if (project) {
      setGcEmail(project.gc_email || '');
    }
  }, [project]);

  if (isLoading || !ticket) {
    return <LoadingSpinner />;
  }

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(ticket.id);
    navigate('/tnm-tickets');
  };

  const handleUpdateStatus = async (status: TNMStatus) => {
    await updateStatusMutation.mutateAsync({ id: ticket.id, status });
  };

  const handleSaveOHP = async () => {
    await updateMutation.mutateAsync({
      id: ticket.id,
      data: {
        labor_ohp_percent: customOHP.labor,
        material_ohp_percent: customOHP.material,
        equipment_ohp_percent: customOHP.equipment,
        subcontractor_ohp_percent: customOHP.subcontractor,
      } as any,
    });
    setIsOHPEditModalOpen(false);
  };

  const handleSend = async () => {
    if (!gcEmail) {
      alert('Please enter GC email address');
      return;
    }
    await sendMutation.mutateAsync(ticket.id);
    setIsSendModalOpen(false);
  };

  const handleRemindNow = async () => {
    // Trigger reminder email
    try {
      await sendMutation.mutateAsync(ticket.id);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const canEdit = ticket.status === TNMStatus.DRAFT || ticket.status === TNMStatus.PENDING_REVIEW;
  const canSend = ticket.status === TNMStatus.READY_TO_SEND || ticket.status === TNMStatus.PENDING_REVIEW;
  const canRemind = ticket.status === TNMStatus.SENT || ticket.status === TNMStatus.VIEWED;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/tnm-tickets"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to TNM Tickets
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {ticket.tnm_number}
            </h1>
            <p className="mt-1 text-lg text-gray-600">{ticket.title}</p>
            <div className="mt-2 flex items-center gap-3">
              <StatusBadge status={ticket.status} />
              <span className="text-sm text-gray-500">
                Project: {ticket.project_number}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="secondary" onClick={() => navigate(`/tnm/${ticket.id}/edit`)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
            <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {ticket.status === TNMStatus.DRAFT && (
            <Button onClick={() => handleUpdateStatus(TNMStatus.PENDING_REVIEW)}>
              Submit for Review
            </Button>
          )}
          {ticket.status === TNMStatus.PENDING_REVIEW && (
            <>
              <Button onClick={() => setIsOHPEditModalOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit OH&P
              </Button>
              <Button onClick={() => handleUpdateStatus(TNMStatus.READY_TO_SEND)}>
                Mark Ready to Send
              </Button>
            </>
          )}
          {canSend && (
            <Button onClick={() => setIsSendModalOpen(true)}>
              <Send className="w-4 h-4 mr-2" />
              Send to GC
            </Button>
          )}
          {canRemind && (
            <Button variant="secondary" onClick={handleRemindNow}>
              <Mail className="w-4 h-4 mr-2" />
              Remind Now
            </Button>
          )}
          <Button variant="secondary" onClick={() => {/* Generate PDF */}}>
            <FileDown className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Ticket Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Basic Info */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ticket Information</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-600">TNM Number</dt>
              <dd className="font-medium text-gray-900">{ticket.tnm_number}</dd>
            </div>
            {ticket.rfco_number && (
              <div>
                <dt className="text-gray-600">RFCO Number</dt>
                <dd className="font-medium text-gray-900">{ticket.rfco_number}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-600">Title</dt>
              <dd className="font-medium text-gray-900">{ticket.title}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Proposal Date</dt>
              <dd className="font-medium text-gray-900">{formatDate(ticket.proposal_date)}</dd>
            </div>
            {ticket.response_date && (
              <div>
                <dt className="text-gray-600">Response Date</dt>
                <dd className="font-medium text-gray-900">{formatDate(ticket.response_date)}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-600">Submitted By</dt>
              <dd className="font-medium text-gray-900">{ticket.submitter_name}</dd>
              <dd className="text-xs text-gray-500">{ticket.submitter_email}</dd>
            </div>
          </dl>
        </div>

        {/* Financial Summary */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Proposal Amount</dt>
              <dd className="font-bold text-lg text-gray-900">{formatCurrency(ticket.proposal_amount)}</dd>
            </div>
            {ticket.approved_amount > 0 && (
              <div className="flex justify-between pt-2 border-t">
                <dt className="text-gray-600">Approved Amount</dt>
                <dd className="font-bold text-lg text-green-600">{formatCurrency(ticket.approved_amount)}</dd>
              </div>
            )}
            <div className="pt-2 border-t">
              <dt className="text-gray-600 mb-1">OH&P Rates</dt>
              <dd className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Labor:</span>
                  <span className="font-medium">{ticket.labor_ohp_percent}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Material:</span>
                  <span className="font-medium">{ticket.material_ohp_percent}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Equipment:</span>
                  <span className="font-medium">{ticket.equipment_ohp_percent}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Subcontractor:</span>
                  <span className="font-medium">{ticket.subcontractor_ohp_percent}%</span>
                </div>
              </dd>
            </div>
          </dl>
        </div>

        {/* Email Tracking */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Tracking</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-600">Times Sent</dt>
              <dd className="font-medium text-gray-900">{ticket.email_sent_count}</dd>
            </div>
            {ticket.last_email_sent_at && (
              <div>
                <dt className="text-gray-600">Last Sent</dt>
                <dd className="font-medium text-gray-900">{formatDateTime(ticket.last_email_sent_at)}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-600">Reminders Sent</dt>
              <dd className="font-medium text-gray-900">{ticket.reminder_count}</dd>
            </div>
            {ticket.last_reminder_sent_at && (
              <div>
                <dt className="text-gray-600">Last Reminder</dt>
                <dd className="font-medium text-gray-900">{formatDateTime(ticket.last_reminder_sent_at)}</dd>
              </div>
            )}
            {ticket.viewed_at && (
              <div>
                <dt className="text-gray-600">GC Viewed At</dt>
                <dd className="font-medium text-gray-900">{formatDateTime(ticket.viewed_at)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Description */}
      {ticket.description && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
        </div>
      )}

      {/* Line Items */}
      <div className="space-y-6 mb-6">
        {ticket.labor_items && ticket.labor_items.length > 0 && (
          <div className="card">
            <LaborItemTable items={ticket.labor_items} onChange={() => {}} readonly />
          </div>
        )}
        {ticket.material_items && ticket.material_items.length > 0 && (
          <div className="card">
            <MaterialItemTable items={ticket.material_items} onChange={() => {}} readonly />
          </div>
        )}
        {ticket.equipment_items && ticket.equipment_items.length > 0 && (
          <div className="card">
            <EquipmentItemTable items={ticket.equipment_items} onChange={() => {}} readonly />
          </div>
        )}
        {ticket.subcontractor_items && ticket.subcontractor_items.length > 0 && (
          <div className="card">
            <SubcontractorItemTable items={ticket.subcontractor_items} onChange={() => {}} readonly />
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="lg:fixed lg:top-20 lg:right-8 lg:w-96">
        <TNMSummary
          laborItems={ticket.labor_items || []}
          materialItems={ticket.material_items || []}
          equipmentItems={ticket.equipment_items || []}
          subcontractorItems={ticket.subcontractor_items || []}
          laborOHP={ticket.labor_ohp_percent}
          materialOHP={ticket.material_ohp_percent}
          equipmentOHP={ticket.equipment_ohp_percent}
          subcontractorOHP={ticket.subcontractor_ohp_percent}
        />
      </div>

      {/* Signature & Photos */}
      {(ticket.signature_url || (ticket.photo_urls && ticket.photo_urls.length > 0)) && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Attachments</h3>
          <div className="space-y-4">
            {ticket.signature_url && (
              <SignatureDisplay signature={ticket.signature_url} label="GC Signature" />
            )}
            {ticket.photo_urls && ticket.photo_urls.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Photos</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {ticket.photo_urls.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Photo ${index + 1}`}
                      className="rounded-lg border border-gray-300"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit OH&P Modal */}
      <Modal
        isOpen={isOHPEditModalOpen}
        onClose={() => setIsOHPEditModalOpen(false)}
        title="Edit OH&P Percentages"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsOHPEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOHP}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Adjust overhead & profit percentages before sending to GC. Defaults are from the project settings.
          </p>
          <Input
            label="Labor OH&P %"
            type="number"
            step="0.01"
            value={customOHP.labor}
            onChange={(e) => setCustomOHP({ ...customOHP, labor: parseFloat(e.target.value) })}
          />
          <Input
            label="Material OH&P %"
            type="number"
            step="0.01"
            value={customOHP.material}
            onChange={(e) => setCustomOHP({ ...customOHP, material: parseFloat(e.target.value) })}
          />
          <Input
            label="Equipment OH&P %"
            type="number"
            step="0.01"
            value={customOHP.equipment}
            onChange={(e) => setCustomOHP({ ...customOHP, equipment: parseFloat(e.target.value) })}
          />
          <Input
            label="Subcontractor OH&P %"
            type="number"
            step="0.01"
            value={customOHP.subcontractor}
            onChange={(e) => setCustomOHP({ ...customOHP, subcontractor: parseFloat(e.target.value) })}
          />
        </div>
      </Modal>

      {/* Send to GC Modal */}
      <Modal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        title="Send to GC for Approval"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsSendModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} isLoading={sendMutation.isPending}>
              <Send className="w-4 h-4 mr-2" />
              Send Email
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This will send an email to the GC with the TNM details, PDF attachment, and secure approval link.
          </p>
          <Input
            label="GC Email Address"
            type="email"
            value={gcEmail}
            onChange={(e) => setGcEmail(e.target.value)}
            placeholder="gc@example.com"
            required
          />
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Email will include:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• TNM #{ticket.tnm_number} - {ticket.title}</li>
              <li>• Proposal Amount: {formatCurrency(ticket.proposal_amount)}</li>
              <li>• PDF attachment with all line items</li>
              <li>• Secure approval link (no login required)</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete TNM Ticket"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleteMutation.isPending}>
              Delete Ticket
            </Button>
          </>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to delete this TNM ticket? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};
