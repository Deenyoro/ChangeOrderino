/**
 * Email Notification Bell - Shows failed email count
 */

import React, { useState } from 'react';
import { Bell, Mail, AlertTriangle, RefreshCw } from 'lucide-react';
import { useFailedEmailsStats, useFailedEmails, useRetryEmail } from '../../hooks/useEmails';
import { formatDateTime } from '../../utils/formatters';
import { Modal } from './Modal';
import { Button } from './Button';
import toast from 'react-hot-toast';

export const EmailNotificationBell: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: stats } = useFailedEmailsStats();
  const { data: failedEmails, refetch } = useFailedEmails({ limit: 50 });
  const retryMutation = useRetryEmail();

  const failedCount = stats?.failed_last_24h || 0;

  const handleRetry = async (emailId: string) => {
    try {
      await retryMutation.mutateAsync(emailId);
      toast.success('Email queued for retry');
      refetch();
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

      {/* Failed Emails Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Email Notifications"
        size="xl"
      >
        <div className="space-y-4">
          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed_last_24h}</div>
                <div className="text-xs text-gray-600">Last 24 Hours</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.failed_last_7d}</div>
                <div className="text-xs text-gray-600">Last 7 Days</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{stats.total_failed}</div>
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
                  onClick={() => refetch()}
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
        </div>
      </Modal>
    </>
  );
};
