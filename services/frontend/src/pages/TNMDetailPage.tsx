/**
 * TNM Ticket Detail/Review Page - Admin view with full controls
 */

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit, Trash2, Send, Mail, FileDown, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  useTNMTicket,
  useUpdateTNMStatus,
  useSendTNMForApproval,
  useDeleteTNMTicket,
  useUpdateTNMTicket,
  useSendReminder,
  useManualApprovalOverride,
} from '../hooks/useTNMTickets';
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
  const [isManualApprovalModalOpen, setIsManualApprovalModalOpen] = useState(false);
  const [gcEmail, setGcEmail] = useState('');
  const [customOHP, setCustomOHP] = useState({
    labor: 0,
    material: 0,
    equipment: 0,
    subcontractor: 0,
  });
  const [manualApprovalData, setManualApprovalData] = useState({
    status: 'approved' as 'approved' | 'denied' | 'partially_approved',
    approved_amount: 0,
    reason: '',
    notes: '',
  });

  const { data: ticket, isLoading } = useTNMTicket(id!);
  const { data: project } = useProject(ticket?.project_id || '');
  const updateStatusMutation = useUpdateTNMStatus();
  const sendMutation = useSendTNMForApproval();
  const deleteMutation = useDeleteTNMTicket();
  const updateMutation = useUpdateTNMTicket();
  const remindMutation = useSendReminder();
  const manualApprovalMutation = useManualApprovalOverride();

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
      toast.error('Please enter GC email address');
      return;
    }
    await sendMutation.mutateAsync(ticket.id);
    setIsSendModalOpen(false);
  };

  const handleRemindNow = async () => {
    try {
      await remindMutation.mutateAsync(ticket.id);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleManualApproval = async () => {
    try {
      await manualApprovalMutation.mutateAsync({
        id: ticket.id,
        data: manualApprovalData,
      });
      setIsManualApprovalModalOpen(false);
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
          {(ticket.status === TNMStatus.SENT ||
            ticket.status === TNMStatus.VIEWED ||
            ticket.status === TNMStatus.PARTIALLY_APPROVED) && (
            <Button
              variant="secondary"
              onClick={() => {
                setManualApprovalData({
                  status: 'approved',
                  approved_amount: ticket.proposal_amount,
                  reason: '',
                  notes: '',
                });
                setIsManualApprovalModalOpen(true);
              }}
            >
              <Edit className="w-4 h-4 mr-2" />
              Manual Override
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

        {/* Summary - Moved to bottom of page */}
        <div className="card">
          <TNMSummary
            laborItems={ticket.labor_items || []}
            materialItems={ticket.material_items || []}
            equipmentItems={ticket.equipment_items || []}
            subcontractorItems={ticket.subcontractor_items || []}
            laborOHP={Number(ticket.labor_ohp_percent) || 0}
            materialOHP={Number(ticket.material_ohp_percent) || 0}
            equipmentOHP={Number(ticket.equipment_ohp_percent) || 0}
            subcontractorOHP={Number(ticket.subcontractor_ohp_percent) || 0}
          />
        </div>
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

      {/* Manual Approval Override Modal */}
      <Modal
        isOpen={isManualApprovalModalOpen}
        onClose={() => setIsManualApprovalModalOpen(false)}
        title="Manual Approval Override"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsManualApprovalModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualApproval} isLoading={manualApprovalMutation.isPending}>
              Submit Override
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Enhanced intro with icon */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">Manual Override</p>
              <p className="text-sm text-blue-700">
                Record offline approvals from phone calls, emails, or in-person meetings.
              </p>
            </div>
          </div>

          {/* Enhanced status selection with visual cards */}
          <div>
            <label className="label mb-3">Approval Status *</label>
            <div className="grid grid-cols-1 gap-2">
              {/* Approved Option */}
              <button
                type="button"
                onClick={() => setManualApprovalData({ ...manualApprovalData, status: 'approved', approved_amount: ticket.proposal_amount })}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  manualApprovalData.status === 'approved'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className={`w-6 h-6 ${manualApprovalData.status === 'approved' ? 'text-green-600' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <div className={`font-semibold ${manualApprovalData.status === 'approved' ? 'text-green-900' : 'text-gray-900'}`}>
                      Approved
                    </div>
                    <div className="text-sm text-gray-600">Full proposal amount approved</div>
                  </div>
                  {manualApprovalData.status === 'approved' && (
                    <div className="text-sm font-semibold text-green-600">Selected</div>
                  )}
                </div>
              </button>

              {/* Partially Approved Option */}
              <button
                type="button"
                onClick={() => setManualApprovalData({ ...manualApprovalData, status: 'partially_approved', approved_amount: ticket.proposal_amount * 0.8 })}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  manualApprovalData.status === 'partially_approved'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-gray-200 hover:border-yellow-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className={`w-6 h-6 ${manualApprovalData.status === 'partially_approved' ? 'text-yellow-600' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <div className={`font-semibold ${manualApprovalData.status === 'partially_approved' ? 'text-yellow-900' : 'text-gray-900'}`}>
                      Partially Approved
                    </div>
                    <div className="text-sm text-gray-600">Custom approved amount</div>
                  </div>
                  {manualApprovalData.status === 'partially_approved' && (
                    <div className="text-sm font-semibold text-yellow-600">Selected</div>
                  )}
                </div>
              </button>

              {/* Denied Option */}
              <button
                type="button"
                onClick={() => setManualApprovalData({ ...manualApprovalData, status: 'denied', approved_amount: 0 })}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  manualApprovalData.status === 'denied'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-red-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <XCircle className={`w-6 h-6 ${manualApprovalData.status === 'denied' ? 'text-red-600' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <div className={`font-semibold ${manualApprovalData.status === 'denied' ? 'text-red-900' : 'text-gray-900'}`}>
                      Denied
                    </div>
                    <div className="text-sm text-gray-600">Proposal not approved</div>
                  </div>
                  {manualApprovalData.status === 'denied' && (
                    <div className="text-sm font-semibold text-red-600">Selected</div>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Approved Amount (only for approved/partial) */}
          {manualApprovalData.status !== 'denied' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <Input
                label="Approved Amount"
                type="number"
                step="0.01"
                min="0"
                value={manualApprovalData.approved_amount}
                onChange={(e) =>
                  setManualApprovalData({
                    ...manualApprovalData,
                    approved_amount: parseFloat(e.target.value) || 0,
                  })
                }
                helperText={`Original proposal: ${formatCurrency(ticket.proposal_amount)}`}
              />
              {manualApprovalData.status === 'partially_approved' && manualApprovalData.approved_amount < ticket.proposal_amount && (
                <div className="mt-2 text-sm text-yellow-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Difference: {formatCurrency(ticket.proposal_amount - manualApprovalData.approved_amount)} not approved
                  </span>
                </div>
              )}
            </div>
          )}

          <Input
            label="Reason for Override"
            value={manualApprovalData.reason}
            onChange={(e) =>
              setManualApprovalData({ ...manualApprovalData, reason: e.target.value })
            }
            placeholder="e.g., Approved via phone call"
            helperText="Brief explanation of why this is being manually overridden"
          />

          <div>
            <label className="label">Additional Notes (optional)</label>
            <textarea
              className="input-field min-h-[80px]"
              value={manualApprovalData.notes}
              onChange={(e) =>
                setManualApprovalData({ ...manualApprovalData, notes: e.target.value })
              }
              placeholder="Any additional context or details..."
            />
          </div>

          {/* Enhanced audit warning */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-900 mb-1">Audit Trail</p>
                <p className="text-sm text-yellow-800">
                  This override will be permanently logged with your email, timestamp, and reason.
                </p>
              </div>
            </div>
          </div>

          {/* Preview summary */}
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Review Changes:</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">New Status:</span>
                <span className={`font-semibold ${
                  manualApprovalData.status === 'approved' ? 'text-green-600' :
                  manualApprovalData.status === 'denied' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {manualApprovalData.status === 'approved' && 'APPROVED'}
                  {manualApprovalData.status === 'denied' && 'DENIED'}
                  {manualApprovalData.status === 'partially_approved' && 'PARTIALLY APPROVED'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Approved Amount:</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(manualApprovalData.approved_amount)}
                </span>
              </div>
              {manualApprovalData.reason && (
                <div className="pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Reason: </span>
                  <span className="text-gray-900">{manualApprovalData.reason}</span>
                </div>
              )}
            </div>
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
