/**
 * GC Approval Page - Public (no auth), accessed via email link with token
 * Enhanced with prominent buttons, 44px touch targets, and mobile-optimized layout
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, FileText, Clock, MessageSquare, ThumbsUp } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { approvalsApi } from '../api/approvals';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
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
    // Validate: at least one item must be approved or denied (not pending)
    const hasDecisions = lineItemApprovals.some(
      item => item.status === ApprovalStatus.APPROVED || item.status === ApprovalStatus.DENIED
    );

    if (!hasDecisions) {
      toast.error('Please approve or deny at least one line item before submitting');
      return;
    }

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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="card max-w-md text-center animate-fade-in">
          <div className="text-green-600 mb-6 animate-scale-in">
            <CheckCircle className="w-24 h-24 mx-auto drop-shadow-lg" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Response Submitted!</h2>
          <p className="text-lg text-gray-700 mb-6">
            Thank you! Your response has been recorded and the project team has been notified.
          </p>
          <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded-r-lg">
            <p className="text-sm text-green-800">
              You will receive a confirmation email shortly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const ticket = data.tnm_ticket;
  const project = data.project;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header - Enhanced with gradient and better visual hierarchy */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 border-b-4 border-blue-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-8 h-8 text-blue-100" />
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  Change Order Approval
                </h1>
              </div>
              <p className="text-base text-blue-100">
                From: {project?.customer_company || 'TRE Construction'}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/20">
              <div className="text-xs uppercase tracking-wider text-blue-200 mb-1">RFCO Number</div>
              <div className="text-2xl font-bold text-white">#{ticket.tnm_number}</div>
              <div className="text-sm text-blue-100 mt-2">{formatDate(ticket.proposal_date)}</div>
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
                            <div className="flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setLineItemApprovals(approvals =>
                                    approvals.map(a =>
                                      a.line_item_id === item.id ? { ...a, status: ApprovalStatus.APPROVED } : a
                                    )
                                  );
                                }}
                                className={`rounded-lg font-semibold transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                  approval?.status === ApprovalStatus.APPROVED
                                    ? 'bg-green-600 text-white shadow-lg scale-110'
                                    : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:scale-105 hover:shadow-md'
                                }`}
                                title="Approve this item"
                              >
                                <CheckCircle className="w-6 h-6" />
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
                                className={`rounded-lg font-semibold transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                  approval?.status === ApprovalStatus.DENIED
                                    ? 'bg-red-600 text-white shadow-lg scale-110'
                                    : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:scale-105 hover:shadow-md'
                                }`}
                                title="Deny this item"
                              >
                                <XCircle className="w-6 h-6" />
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
                            <div className="flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setLineItemApprovals(approvals =>
                                    approvals.map(a =>
                                      a.line_item_id === item.id ? { ...a, status: ApprovalStatus.APPROVED } : a
                                    )
                                  );
                                }}
                                className={`rounded-lg font-semibold transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                  approval?.status === ApprovalStatus.APPROVED
                                    ? 'bg-green-600 text-white shadow-lg scale-110'
                                    : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:scale-105 hover:shadow-md'
                                }`}
                                title="Approve this item"
                              >
                                <CheckCircle className="w-6 h-6" />
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
                                className={`rounded-lg font-semibold transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                  approval?.status === ApprovalStatus.DENIED
                                    ? 'bg-red-600 text-white shadow-lg scale-110'
                                    : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:scale-105 hover:shadow-md'
                                }`}
                                title="Deny this item"
                              >
                                <XCircle className="w-6 h-6" />
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
                            <div className="flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setLineItemApprovals(approvals =>
                                    approvals.map(a =>
                                      a.line_item_id === item.id ? { ...a, status: ApprovalStatus.APPROVED } : a
                                    )
                                  );
                                }}
                                className={`rounded-lg font-semibold transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                  approval?.status === ApprovalStatus.APPROVED
                                    ? 'bg-green-600 text-white shadow-lg scale-110'
                                    : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:scale-105 hover:shadow-md'
                                }`}
                                title="Approve this item"
                              >
                                <CheckCircle className="w-6 h-6" />
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
                                className={`rounded-lg font-semibold transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                  approval?.status === ApprovalStatus.DENIED
                                    ? 'bg-red-600 text-white shadow-lg scale-110'
                                    : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:scale-105 hover:shadow-md'
                                }`}
                                title="Deny this item"
                              >
                                <XCircle className="w-6 h-6" />
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
                            <div className="flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setLineItemApprovals(approvals =>
                                    approvals.map(a =>
                                      a.line_item_id === item.id ? { ...a, status: ApprovalStatus.APPROVED } : a
                                    )
                                  );
                                }}
                                className={`rounded-lg font-semibold transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                  approval?.status === ApprovalStatus.APPROVED
                                    ? 'bg-green-600 text-white shadow-lg scale-110'
                                    : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:scale-105 hover:shadow-md'
                                }`}
                                title="Approve this item"
                              >
                                <CheckCircle className="w-6 h-6" />
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
                                className={`rounded-lg font-semibold transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                  approval?.status === ApprovalStatus.DENIED
                                    ? 'bg-red-600 text-white shadow-lg scale-110'
                                    : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:scale-105 hover:shadow-md'
                                }`}
                                title="Deny this item"
                              >
                                <XCircle className="w-6 h-6" />
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

        {/* Approval Actions - Enhanced with prominent buttons */}
        <div className="card">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Your Response</h3>

          <div className="space-y-8">
            {/* Quick Actions - Large, Prominent Buttons */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <ThumbsUp className="w-6 h-6 text-blue-600" />
                <h4 className="text-lg font-semibold text-gray-900">Quick Actions</h4>
              </div>
              <p className="text-sm text-gray-700 mb-6">
                Review each line item above individually, or use these quick actions to approve/deny everything at once.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Approve All - Large Prominent Button */}
                <button
                  type="button"
                  onClick={handleApproveAll}
                  className="group relative overflow-hidden bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 min-h-[80px]"
                >
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    <CheckCircle className="w-8 h-8 animate-pulse" />
                    <div className="text-left">
                      <div className="text-xl font-bold">Approve All</div>
                      <div className="text-sm text-green-100">Accept all line items</div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                </button>

                {/* Deny All - Large Prominent Button */}
                <button
                  type="button"
                  onClick={handleDenyAll}
                  className="group relative overflow-hidden bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 min-h-[80px]"
                >
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    <XCircle className="w-8 h-8 animate-pulse" />
                    <div className="text-left">
                      <div className="text-xl font-bold">Deny All</div>
                      <div className="text-sm text-red-100">Reject all line items</div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-red-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                </button>
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-3">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Comments (optional)
              </label>
              <textarea
                className="input-field min-h-[120px] text-base"
                placeholder="Add any comments, conditions, or questions about this change order..."
                value={gcComment}
                onChange={(e) => setGcComment(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-2">
                Your comments will be shared with the project team
              </p>
            </div>

            {/* Submit - Large Prominent Button */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t-2 border-gray-200">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl px-10 py-5 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed min-h-[64px]"
              >
                <div className="relative z-10 flex items-center justify-center gap-3">
                  <FileText className={`w-6 h-6 ${submitMutation.isPending ? 'animate-pulse' : ''}`} />
                  <div className="text-left">
                    <div className="text-xl font-bold">
                      {submitMutation.isPending ? 'Submitting...' : 'Submit Response'}
                    </div>
                    <div className="text-sm text-blue-100">
                      {submitMutation.isPending ? 'Please wait' : 'Send your decision'}
                    </div>
                  </div>
                </div>
                {!submitMutation.isPending && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                )}
              </button>
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
