/**
 * Email Notification Bell - Shows email statistics
 */

import React, { useState } from 'react';
import { Bell, Mail, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useFailedEmailsStats, useFailedEmails, useRetryEmail, useSentEmailsStats, useSentEmails } from '../../hooks/useEmails';
import { formatDateTime } from '../../utils/formatters';
import { Modal } from './Modal';
import { Button } from './Button';
import toast from 'react-hot-toast';

export const EmailNotificationBell: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sent' | 'failed'>('sent');
  const { data: failedStats } = useFailedEmailsStats();
  const { data: sentStats } = useSentEmailsStats();
  const { data: failedEmails, refetch: refetchFailed } = useFailedEmails({ limit: 50 });
  const { data: sentEmails, refetch: refetchSent } = useSentEmails({ limit: 50 });
  const retryMutation = useRetryEmail();

  const failedCount = failedStats?.failed_last_24h || 0;

  const handleRetry = async (emailId: string) => {
    try {
      await retryMutation.mutateAsync(emailId);
      toast.success('Email queued for retry');
      refetchFailed();
    } catch (error) {
      toast.error('Failed to retry email');
    }
  };

  return (
    <>
      {/* Notification Bell */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title="Email notifications"
      >
        <Bell className="w-5 h-5" />
        {failedCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {failedCount > 99 ? '99+' : failedCount}
          </span>
        )}
      </button>

      {/* Email Notifications Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Email Notifications"
        size="xl"
      >
        <div className="space-y-4">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('sent')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'sent'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sent Emails</span>
                  {sentStats && (
                    <span className="ml-2 py-0.5 px-2 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {sentStats.sent_last_24h}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('failed')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'failed'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Failed Emails</span>
                  {failedStats && failedStats.failed_last_24h > 0 && (
                    <span className="ml-2 py-0.5 px-2 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {failedStats.failed_last_24h}
                    </span>
                  )}
                </div>
              </button>
            </nav>
          </div>

          {/* Sent Emails Tab */}
          {activeTab === 'sent' && (
            <>
              {/* Sent Stats Summary */}
              {sentStats && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-green-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{sentStats.sent_last_24h}</div>
                    <div className="text-xs text-gray-600">Last 24 Hours</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{sentStats.sent_last_7d}</div>
                    <div className="text-xs text-gray-600">Last 7 Days</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{sentStats.total_sent}</div>
                    <div className="text-xs text-gray-600">All Time</div>
                  </div>
                </div>
              )}

              {/* Sent Emails List */}
              {!sentEmails || sentEmails.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Sent Emails</h3>
                  <p className="text-gray-600">No emails have been sent yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">Recent Sent Emails</h3>
                    <button
                      onClick={() => refetchSent()}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </button>
                  </div>

                  {sentEmails.map((email) => (
                    <div
                      key={email.id}
                      className="border border-green-200 bg-green-50 rounded-lg p-4 hover:bg-green-100 transition-colors"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{email.subject}</div>
                            <div className="text-sm text-gray-600 truncate">To: {email.to_email}</div>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {email.email_type || 'Email'}
                        </span>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-green-200">
                        <div className="text-xs text-gray-500">
                          {formatDateTime(email.sent_at || email.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Failed Emails Tab */}
          {activeTab === 'failed' && (
            <>
              {/* Failed Stats Summary */}
              {failedStats && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-red-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{failedStats.failed_last_24h}</div>
                    <div className="text-xs text-gray-600">Last 24 Hours</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{failedStats.failed_last_7d}</div>
                    <div className="text-xs text-gray-600">Last 7 Days</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{failedStats.total_failed}</div>
                    <div className="text-xs text-gray-600">All Time</div>
                  </div>
                </div>
              )}

              {/* Failed Emails List */}
              {failedCount === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear!</h3>
                  <p className="text-gray-600">No failed emails in the last 24 hours</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">Recent Failed Emails</h3>
                    <button
                      onClick={() => refetchFailed()}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </button>
                  </div>

                  {failedEmails?.map((email) => (
                    <div
                      key={email.id}
                      className="border border-red-200 bg-red-50 rounded-lg p-4 hover:bg-red-100 transition-colors"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{email.subject}</div>
                            <div className="text-sm text-gray-600 truncate">To: {email.to_email}</div>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {email.email_type || 'Email'}
                        </span>
                      </div>

                      {/* Error Message */}
                      {email.error_message && (
                        <div className="mb-3 p-2 bg-white rounded border border-red-200">
                          <div className="text-xs font-medium text-red-900 mb-1">Error:</div>
                          <div className="text-xs text-red-700">{email.error_message}</div>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-red-200">
                        <div className="text-xs text-gray-500">
                          {formatDateTime(email.created_at)}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleRetry(email.id)}
                          isLoading={retryMutation.isPending}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Retry
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
};
