/**
 * System Information Page - View system health and application details
 */
import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Activity,
  Database,
  HardDrive,
  Server
} from 'lucide-react';
import { apiClient } from '../api/client';

interface SystemHealth {
  status: string;
  version: string;
  environment: string;
  services?: {
    database?: { status: string; error?: string };
    minio?: { status: string; error?: string };
    redis?: { status: string; error?: string };
  };
  system_info?: {
    application?: string;
    database_version?: string;
    redis_version?: string;
  };
}

const SystemInfoPage: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [versionCopied, setVersionCopied] = useState(false);

  // Detect enabled features
  const isAuthEnabled = (window as any).__RUNTIME_CONFIG__?.AUTH_ENABLED === 'true';

  useEffect(() => {
    fetchSystemHealth();
  }, []);

  const fetchSystemHealth = async () => {
    try {
      setHealthLoading(true);
      // Try detailed health check first, fall back to basic health check
      try {
        const response = await apiClient.get('/health/detailed');
        setSystemHealth(response.data);
      } catch {
        // Fall back to basic health check
        const response = await apiClient.get('/health');
        const runtimeVersion = (window as any).__RUNTIME_CONFIG__?.VERSION || 'unknown';
        setSystemHealth({
          status: response.data.status || 'unknown',
          version: runtimeVersion,
          environment: 'development'
        });
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      const runtimeVersion = (window as any).__RUNTIME_CONFIG__?.VERSION || 'unknown';
      setSystemHealth({
        status: 'error',
        version: runtimeVersion,
        environment: 'unknown'
      });
    } finally {
      setHealthLoading(false);
    }
  };

  const copyVersionToClipboard = async (version: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(version);
        setVersionCopied(true);
        setTimeout(() => setVersionCopied(false), 2000);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = version;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setVersionCopied(true);
        setTimeout(() => setVersionCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy version:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-7 h-7" />
          System Information
        </h1>
        <p className="text-gray-600 mt-1">View system health status and application details</p>
      </div>

      <div className="space-y-6">
        {/* System Health Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Server className="w-5 h-5" />
              System Health
            </h3>
            <button
              onClick={fetchSystemHealth}
              disabled={healthLoading}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${healthLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {systemHealth && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Overall Status</label>
                  <div className="flex items-center mt-1">
                    {getStatusIcon(systemHealth.status)}
                    <span className="ml-2 text-sm capitalize">{systemHealth.status}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Version</label>
                  <div className="flex items-center gap-2 mt-1">
                    <p
                      className="text-sm text-gray-900 font-mono cursor-pointer hover:text-blue-600 transition-colors"
                      title={`${systemHealth.version} (click to copy)`}
                      onClick={() => copyVersionToClipboard(systemHealth.version)}
                    >
                      {systemHealth.version && systemHealth.version.length > 7
                        ? systemHealth.version.substring(0, 7)
                        : systemHealth.version}
                    </p>
                    {versionCopied && (
                      <span className="text-xs text-green-600 font-medium">Copied!</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Environment</label>
                  <p className="text-sm text-gray-900 mt-1 capitalize">{systemHealth.environment}</p>
                </div>
              </div>

              {systemHealth.services && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Service Status</h4>
                  <div className="space-y-2">
                    {Object.entries(systemHealth.services).map(([service, status]) => (
                      <div key={service} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                        <div className="flex items-center">
                          {getStatusIcon(status.status)}
                          <span className="ml-2 text-sm font-medium capitalize">{service}</span>
                        </div>
                        <div className="text-sm">
                          <span className={`capitalize ${status.status === 'healthy' ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {status.status}
                          </span>
                          {status.error && (
                            <p className="text-xs text-red-500 mt-1">{status.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Application Stack Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Application Stack
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Application</label>
              <p className="text-sm text-gray-900 mt-1">{systemHealth?.system_info?.application || 'ChangeOrderino'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Build Date</label>
              <p className="text-sm text-gray-900 mt-1">{new Date().toLocaleDateString()}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Database</label>
              <p className="text-sm text-gray-900 mt-1">{systemHealth?.system_info?.database_version || 'PostgreSQL 16'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cache</label>
              <p className="text-sm text-gray-900 mt-1">{systemHealth?.system_info?.redis_version || 'Redis 7'}</p>
            </div>
          </div>
        </div>

        {/* Build Features */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Build Features
          </h3>
          <div className="flex flex-wrap gap-2">
            {isAuthEnabled ? (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                Authentication
              </span>
            ) : (
              <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                No Authentication
              </span>
            )}
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              Email Notifications
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
              PDF Generation
            </span>
            <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
              File Storage (MinIO)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemInfoPage;
