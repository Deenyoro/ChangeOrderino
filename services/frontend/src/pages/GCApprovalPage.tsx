/**
 * GC Approval Page - Public (no auth), accessed via email link with token
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, FileText, Clock } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { approvalsApi } from '../api/approvals';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { formatDate, formatCurrency } from '../utils/formatters';
import { TNMSummary } from '../components/tnm/TNMSummary';
import { ApprovalStatus } from '../types/tnmTicket';

export const GCApprovalPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [lineItemApprovals, setLineItemApprovals] = useState<Array<{
    line_item_type: string;
    line_item_id: string;
    status: string;
    approved_amount?: number;
    gc_comment?: string;
  }>>([]);
  const [gcComment, setGcComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['approval', token],
    queryFn: () => approvalsApi.getApprovalData(token!),
    enabled: !!token,
  });

  const submitMutation = useMutation({
    mutationFn: (approvalData: any) => approvalsApi.submitApproval(token!, approvalData),
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  // Initialize line item approvals when data loads
  useEffect(() => {
    if (data?.tnm_ticket) {
      const ticket = data.tnm_ticket;
      const approvals: typeof lineItemApprovals = [];

      // Labor items
      ticket.labor_items?.forEach((item: any) => {
        approvals.push({
          line_item_type: 'labor',
          line_item_id: item.id,
          status: ApprovalStatus.PENDING,
          approved_amount: item.subtotal,
        });
      });

      // Material items
      ticket.material_items?.forEach((item: any) => {
        approvals.push({
          line_item_type: 'material',
          line_item_id: item.id,
          status: ApprovalStatus.PENDING,
          approved_amount: item.subtotal,
        });
      });

      // Equipment items
      ticket.equipment_items?.forEach((item: any) => {
        approvals.push({
          line_item_type: 'equipment',
          line_item_id: item.id,
          status: ApprovalStatus.PENDING,
          approved_amount: item.subtotal,
        });
      });

      // Subcontractor items
      ticket.subcontractor_items?.forEach((item: any) => {
        approvals.push({
          line_item_type: 'subcontractor',
          line_item_id: item.id,
          status: ApprovalStatus.PENDING,
          approved_amount: item.amount,
        });
      });

      setLineItemApprovals(approvals);
    }
  }, [data]);

  const handleApproveAll = () => {
    setLineItemApprovals(approvals =>
      approvals.map(a => ({ ...a, status: ApprovalStatus.APPROVED }))
    );
  };

  const handleDenyAll = () => {
    setLineItemApprovals(approvals =>
      approvals.map(a => ({ ...a, status: ApprovalStatus.DENIED }))
    );
  };

  const handleSubmit = async () => {
    await submitMutation.mutateAsync({
      line_item_approvals: lineItemApprovals,
      gc_comment: gcComment,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <div className="text-red-600 mb-4">
            <XCircle className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-gray-600">
            This approval link is invalid or has expired. Please contact the project manager.
          </p>
        </div>
      </div>
    );
  }

  if (data.is_expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <div className="text-orange-600 mb-4">
            <Clock className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h2>
          <p className="text-gray-600">
            This approval link has expired. Please contact the project manager for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (data.already_responded || submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <div className="text-green-600 mb-4">
            <CheckCircle className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Response Submitted</h2>
          <p className="text-gray-600">
            Thank you! Your response has been recorded and the project team has been notified.
          </p>
        </div>
      </div>
    );
  }

  const ticket = data.tnm_ticket;
  const project = data.project;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Change Order Approval Request
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                From: {project?.customer_company || 'TRE Construction'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">RFCO #{ticket.tnm_number}</div>
              <div className="text-sm text-gray-600">{formatDate(ticket.proposal_date)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Project & Ticket Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-600">Project</dt>
                <dd className="font-medium text-gray-900">{project?.name}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Project Number</dt>
                <dd className="font-medium text-gray-900">{project?.project_number}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Order Details</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-600">Title</dt>
                <dd className="font-medium text-gray-900">{ticket.title}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Proposal Date</dt>
                <dd className="font-medium text-gray-900">{formatDate(ticket.proposal_date)}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Total Amount</dt>
                <dd className="font-bold text-xl text-primary-600">{formatCurrency(ticket.proposal_amount)}</dd>
              </div>
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

        {/* Line Items with Approval Controls */}
        <div className="space-y-6 mb-6">
          {ticket.labor_items && ticket.labor_items.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Labor Items</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Approval</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ticket.labor_items.map((item: any) => {
                      const approval = lineItemApprovals.find(a => a.line_item_id === item.id);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-900">{item.description}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.hours}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.labor_type}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{formatCurrency(item.rate_per_hour)}</td>
                          <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.subtotal)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setLineItemApprovals(approvals =>
                                    approvals.map(a =>
                                      a.line_item_id === item.id ? { ...a, status: ApprovalStatus.APPROVED } : a
                                    )
                                  );
                                }}
                                className={`px-3 py-1 rounded text-sm font-medium min-h-[36px] min-w-[36px] ${
                                  approval?.status === ApprovalStatus.APPROVED
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                                }`}
                              >
                                <CheckCircle className="w-4 h-4 inline" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLineItemApprovals(approvals =>
                                    approvals.map(a =>
                                      a.line_item_id === item.id ? { ...a, status: ApprovalStatus.DENIED } : a
                                    )
                                  );
                                }}
                                className={`px-3 py-1 rounded text-sm font-medium min-h-[36px] min-w-[36px] ${
                                  approval?.status === ApprovalStatus.DENIED
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                                }`}
                              >
                                <XCircle className="w-4 h-4 inline" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {ticket.material_items && ticket.material_items.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Material Items</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Approval</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ticket.material_items.map((item: any) => {
                      const approval = lineItemApprovals.find(a => a.line_item_id === item.id);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-900">{item.description}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.quantity}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.unit}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{formatCurrency(item.unit_price)}</td>
                          <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.subtotal)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setLineItemApprovals(approvals =>
                                    approvals.map(a =>
                                      a.line_item_id === item.id ? { ...a, status: ApprovalStatus.APPROVED } : a
                                    )
                                  );
                                }}
                                className={`px-3 py-1 rounded text-sm font-medium min-h-[36px] min-w-[36px] ${
                                  approval?.status === ApprovalStatus.APPROVED
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                                }`}
                              >
                                <CheckCircle className="w-4 h-4 inline" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLineItemApprovals(approvals =>
                                    approvals.map(a =>
                                      a.line_item_id === item.id ? { ...a, status: ApprovalStatus.DENIED } : a
                                    )
                                  );
                                }}
                                className={`px-3 py-1 rounded text-sm font-medium min-h-[36px] min-w-[36px] ${
                                  approval?.status === ApprovalStatus.DENIED
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                                }`}
                              >
                                <XCircle className="w-4 h-4 inline" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {ticket.equipment_items && ticket.equipment_items.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Equipment Items</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty/Hours</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Approval</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ticket.equipment_items.map((item: any) => {
                      const approval = lineItemApprovals.find(a => a.line_item_id === item.id);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-900">{item.description}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.quantity}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.unit}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{formatCurrency(item.unit_price)}</td>
                          <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.subtotal)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setLineItemApprovals(approvals =>
                                    approvals.map(a =>
                                      a.line_item_id === item.id ? { ...a, status: ApprovalStatus.APPROVED } : a
                                    )
                                  );
                                }}
                                className={`px-3 py-1 rounded text-sm font-medium min-h-[36px] min-w-[36px] ${
                                  approval?.status === ApprovalStatus.APPROVED
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                                }`}
                              >
                                <CheckCircle className="w-4 h-4 inline" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLineItemApprovals(approvals =>
                                    approvals.map(a =>
                                      a.line_item_id === item.id ? { ...a, status: ApprovalStatus.DENIED } : a
                                    )
                                  );
                                }}
                                className={`px-3 py-1 rounded text-sm font-medium min-h-[36px] min-w-[36px] ${
                                  approval?.status === ApprovalStatus.DENIED
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                                }`}
                              >
                                <XCircle className="w-4 h-4 inline" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {ticket.subcontractor_items && ticket.subcontractor_items.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Subcontractor Items</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name/Company</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proposal Date</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Approval</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ticket.subcontractor_items.map((item: any) => {
                      const approval = lineItemApprovals.find(a => a.line_item_id === item.id);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-900">{item.subcontractor_name}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.description}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{item.proposal_date || '-'}</td>
                          <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.amount)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setLineItemApprovals(approvals =>
                                    approvals.map(a =>
                                      a.line_item_id === item.id ? { ...a, status: ApprovalStatus.APPROVED } : a
                                    )
                                  );
                                }}
                                className={`px-3 py-1 rounded text-sm font-medium min-h-[36px] min-w-[36px] ${
                                  approval?.status === ApprovalStatus.APPROVED
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                                }`}
                              >
                                <CheckCircle className="w-4 h-4 inline" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLineItemApprovals(approvals =>
                                    approvals.map(a =>
                                      a.line_item_id === item.id ? { ...a, status: ApprovalStatus.DENIED } : a
                                    )
                                  );
                                }}
                                className={`px-3 py-1 rounded text-sm font-medium min-h-[36px] min-w-[36px] ${
                                  approval?.status === ApprovalStatus.DENIED
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                                }`}
                              >
                                <XCircle className="w-4 h-4 inline" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="mb-8">
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

        {/* Approval Actions */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Response</h3>

          <div className="space-y-6">
            {/* Quick Actions */}
            <div>
              <p className="text-sm text-gray-600 mb-3">
                Review each line item above and use the approve/deny buttons next to each item, or use the quick actions below to approve/deny all at once.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleApproveAll}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve All Line Items
                </Button>
                <Button variant="danger" onClick={handleDenyAll}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Deny All Line Items
                </Button>
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="label">Comments (optional)</label>
              <textarea
                className="input-field min-h-[100px]"
                placeholder="Add any comments or conditions for approval..."
                value={gcComment}
                onChange={(e) => setGcComment(e.target.value)}
              />
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <Button
                onClick={handleSubmit}
                size="lg"
                isLoading={submitMutation.isPending}
              >
                <FileText className="w-5 h-5 mr-2" />
                Submit Response
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            This is a secure approval link. If you have any questions, please contact the project manager.
          </p>
          <p className="mt-2">
            Generated with ChangeOrderino - Construction Change Order Management
          </p>
        </div>
      </div>
    </div>
  );
};
