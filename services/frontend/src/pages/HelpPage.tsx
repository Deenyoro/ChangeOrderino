/**
 * Help & Support Page with Zammad integration
 */

import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { projectsApi } from '../api/projects';
import { tnmTicketsApi } from '../api/tnmTickets';
import { settingsApi } from '../api/settings';

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';

export const HelpPage: React.FC = () => {
  const { user } = useAuth();
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [isCollecting, setIsCollecting] = useState(false);

  // Get current hostname for subject, with fallback to DOMAIN IP for no-auth builds
  const getHostnameForTicket = () => {
    const currentHostname = window.location.hostname;
    const domainFallback = import.meta.env.VITE_DOMAIN || 'unknown';

    // Use fallback if hostname is localhost or starts with 127 or 10.
    if (currentHostname === 'localhost' || currentHostname.startsWith('127.') || currentHostname.startsWith('10.')) {
      return domainFallback;
    }

    return currentHostname;
  };

  const hostname = getHostnameForTicket();

  // Collect telemetry data
  useEffect(() => {
    const collectTelemetry = async () => {
      setIsCollecting(true);
      try {
        const data: any = {
          hostname: hostname,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          authEnabled: AUTH_ENABLED,
        };

        // Get version from health endpoint
        try {
          const healthResponse = await fetch('/api/health');
          if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            data.version = healthData.version || 'unknown';
            data.environment = healthData.environment || 'unknown';
          } else {
            data.version = 'unknown';
          }
        } catch (e) {
          data.version = 'unknown';
        }

        // Collect authentication info if auth is enabled
        if (AUTH_ENABLED) {
          data.authentication = {
            enabled: true,
            keycloakUrl: import.meta.env.VITE_KEYCLOAK_URL || 'Not configured',
            realm: import.meta.env.VITE_KEYCLOAK_REALM || 'Not configured',
            authenticated: !!user,
          };

          if (user) {
            data.authentication.user = {
              id: user.id || 'Unknown',
              email: user.email || 'Unknown',
              name: user.full_name || 'Unknown',
              roles: user.roles || [],
            };
          }
        } else {
          data.authentication = {
            enabled: false,
            mode: 'No authentication (development mode)',
          };
        }

        // Get projects summary
        try {
          const projects = await projectsApi.getAll({ is_active: true });
          data.projects = {
            total: projects.length,
            active: projects.filter((p: any) => p.is_active).length,
            recentProjects: projects.slice(0, 3).map((p: any) => ({
              name: p.name,
              number: p.project_number,
              status: p.status,
            })),
          };
        } catch (e) {
          data.projects = { error: String(e) };
        }

        // Get TNM tickets summary
        try {
          const tickets = await tnmTicketsApi.getAll({});
          const draftTickets = tickets.filter((t: any) => t.status === 'draft');
          const pendingTickets = tickets.filter((t: any) => t.status === 'pending_review' || t.status === 'ready_to_send');
          const sentTickets = tickets.filter((t: any) => t.status === 'sent' || t.status === 'viewed');
          const approvedTickets = tickets.filter((t: any) => t.status === 'approved');

          data.tnmTickets = {
            total: tickets.length,
            draft: draftTickets.length,
            pending: pendingTickets.length,
            sent: sentTickets.length,
            approved: approvedTickets.length,
            recentTickets: tickets.slice(0, 5).map((t: any) => ({
              number: t.tnm_number,
              title: t.title,
              status: t.status,
              proposalAmount: t.proposal_amount,
            })),
          };
        } catch (e) {
          data.tnmTickets = { error: String(e) };
        }

        // Get settings
        try {
          const settings = await settingsApi.getEffective({});
          data.settings = {
            emailConfigured: !!(settings.smtp?.host && settings.smtp?.username),
            emailFrom: settings.smtp?.from_email || 'Not configured',
            reminderEnabled: settings.reminders?.enabled || false,
            companyName: settings.company?.name || 'Not configured',
          };
        } catch (e) {
          data.settings = { error: String(e) };
        }

        setTelemetryData(data);
      } catch (error) {
        console.error('Error collecting telemetry:', error);
      } finally {
        setIsCollecting(false);
      }
    };

    collectTelemetry();
  }, [hostname, user]);

  const generateTelemetryReport = useCallback(() => {
    if (!telemetryData) return 'Telemetry data not available';

    let report = '\n\n------- SYSTEM TELEMETRY -------\n\n';

    // System info
    report += '=== SYSTEM INFO ===\n';
    report += `Application: ChangeOrderino\n`;
    report += `Version: ${telemetryData.version || 'unknown'}\n`;
    report += `Environment: ${telemetryData.environment || 'unknown'}\n`;
    report += `Hostname: ${telemetryData.hostname}\n`;
    report += `URL: ${telemetryData.url}\n`;
    report += `Timestamp: ${telemetryData.timestamp}\n\n`;

    // Authentication info
    report += '=== AUTHENTICATION ===\n';
    if (telemetryData.authentication) {
      report += `Authentication: ${telemetryData.authentication.enabled ? 'ENABLED' : 'DISABLED'}\n`;
      if (telemetryData.authentication.enabled) {
        report += `Keycloak URL: ${telemetryData.authentication.keycloakUrl}\n`;
        report += `Realm: ${telemetryData.authentication.realm}\n`;
        report += `User Authenticated: ${telemetryData.authentication.authenticated ? 'Yes' : 'No'}\n`;
        if (telemetryData.authentication.user) {
          report += `\nLogged In User:\n`;
          report += `  Email: ${telemetryData.authentication.user.email}\n`;
          report += `  Name: ${telemetryData.authentication.user.name}\n`;
          report += `  User ID: ${telemetryData.authentication.user.id}\n`;
          if (telemetryData.authentication.user.roles && telemetryData.authentication.user.roles.length > 0) {
            report += `  Roles: ${telemetryData.authentication.user.roles.join(', ')}\n`;
          }
        }
      } else {
        report += `Mode: ${telemetryData.authentication.mode}\n`;
      }
    } else {
      report += 'Authentication info not available\n';
    }
    report += '\n';

    // Projects
    report += '=== PROJECTS ===\n';
    if (telemetryData.projects && !telemetryData.projects.error) {
      report += `Total Projects: ${telemetryData.projects.total}\n`;
      report += `Active Projects: ${telemetryData.projects.active}\n`;
      if (telemetryData.projects.recentProjects && telemetryData.projects.recentProjects.length > 0) {
        report += '\nRecent Projects:\n';
        telemetryData.projects.recentProjects.forEach((project: any, idx: number) => {
          report += `  ${idx + 1}. ${project.name} (#${project.number}) - ${project.status}\n`;
        });
      }
    } else {
      report += `Error retrieving project data: ${telemetryData.projects?.error || 'unknown'}\n`;
    }
    report += '\n';

    // TNM Tickets
    report += '=== TNM TICKETS (CHANGE ORDERS) ===\n';
    if (telemetryData.tnmTickets && !telemetryData.tnmTickets.error) {
      report += `Total Tickets: ${telemetryData.tnmTickets.total}\n`;
      report += `Draft: ${telemetryData.tnmTickets.draft}\n`;
      report += `Pending: ${telemetryData.tnmTickets.pending}\n`;
      report += `Sent: ${telemetryData.tnmTickets.sent}\n`;
      report += `Approved: ${telemetryData.tnmTickets.approved}\n`;
      if (telemetryData.tnmTickets.recentTickets && telemetryData.tnmTickets.recentTickets.length > 0) {
        report += '\nRecent Tickets:\n';
        telemetryData.tnmTickets.recentTickets.forEach((ticket: any, idx: number) => {
          report += `  ${idx + 1}. ${ticket.number} - ${ticket.title}\n`;
          const amount = typeof ticket.proposalAmount === 'number' ? ticket.proposalAmount.toFixed(2) : '0.00';
          report += `     Status: ${ticket.status} | Amount: $${amount}\n`;
        });
      }
    } else {
      report += `Error retrieving TNM ticket data: ${telemetryData.tnmTickets?.error || 'unknown'}\n`;
    }
    report += '\n';

    // Settings
    report += '=== SETTINGS ===\n';
    if (telemetryData.settings && !telemetryData.settings.error) {
      report += `Company Name: ${telemetryData.settings.companyName}\n`;
      report += `Email Configured: ${telemetryData.settings.emailConfigured ? 'Yes' : 'No'}\n`;
      report += `Email From: ${telemetryData.settings.emailFrom}\n`;
      report += `Reminder Enabled: ${telemetryData.settings.reminderEnabled ? 'Yes' : 'No'}\n`;
    } else {
      report += `Error retrieving settings: ${telemetryData.settings?.error || 'unknown'}\n`;
    }
    report += '\n';

    // Browser info
    report += '=== BROWSER INFO ===\n';
    report += `User Agent: ${telemetryData.userAgent}\n`;
    report += '\n';

    report += '------- END TELEMETRY -------\n';

    return report;
  }, [telemetryData]);

  // Store telemetry in sessionStorage when it's collected
  useEffect(() => {
    if (telemetryData) {
      const telemetryReport = generateTelemetryReport();
      sessionStorage.setItem('changeorderino_telemetry', telemetryReport);
      sessionStorage.setItem('changeorderino_hostname', hostname);
    }
  }, [telemetryData, hostname, generateTelemetryReport]);

  // Load scripts once on mount
  useEffect(() => {
    // Add CSS to hide subject field BEFORE form loads
    const style = document.createElement('style');
    style.textContent = `
      #zammad-form-container label[for*="title"] { display: none !important; }
      #zammad-form-container .zammad-form-group:has(input[name="title"]) { display: none !important; }
      #zammad-form-container input[name="title"] { display: none !important; }
    `;
    document.head.appendChild(style);

    // Function to load Zammad form script after jQuery is ready
    const loadZammadScript = () => {
      const zammadScript = document.createElement('script');
      zammadScript.id = 'zammad_form_script';
      zammadScript.src = 'https://helpdesk.kawalink.com/assets/form/form.js';
      document.body.appendChild(zammadScript);
    };

    // Load jQuery if not already loaded, then load Zammad
    if (!(window as any).jQuery) {
      const script = document.createElement('script');
      script.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
      script.onload = () => {
        // jQuery loaded, now load Zammad form script
        loadZammadScript();
      };
      document.body.appendChild(script);
    } else {
      // jQuery already loaded, load Zammad immediately
      loadZammadScript();
    }

    return () => {
      style.remove();
    };
  }, []);

  // Initialize form when telemetry is ready
  useEffect(() => {
    if (!telemetryData) return;

    const initZammad = setInterval(() => {
      const $ = (window as any).jQuery;
      if ($ && $.fn.ZammadForm) {
        clearInterval(initZammad);

        const $formContainer = $('#zammad-form-container');
        if ($formContainer.length && !$formContainer.data('zammad-initialized')) {
          $formContainer.ZammadForm({
            messageTitle: 'ChangeOrderino Support Ticket',
            messageSubmit: 'Submit Ticket',
            messageThankYou: 'Thank you for your ticket (#%s)! We\'ll contact you as soon as possible.',
            modal: false,
            showTitle: false,
            nofieldset: true,
            attachmentSupport: false,
            attributes: [
              {
                display: '',
                name: 'title',
                tag: 'input',
                type: 'hidden',
                defaultValue: () => {
                  const storedHostname = sessionStorage.getItem('changeorderino_hostname');
                  if (storedHostname) {
                    return `ChangeOrderino Ticket - ${storedHostname}`;
                  }

                  const currentHostname = window.location.hostname;
                  const domainFallback = import.meta.env.VITE_DOMAIN || 'unknown';
                  const hostname = (currentHostname === 'localhost' || currentHostname.startsWith('127.') || currentHostname.startsWith('10.'))
                    ? domainFallback
                    : currentHostname;

                  return `ChangeOrderino Ticket - ${hostname}`;
                },
              },
              {
                display: 'Your Name',
                name: 'name',
                tag: 'input',
                type: 'text',
                placeholder: '',
                required: true,
              },
              {
                display: 'Your Email',
                name: 'email',
                tag: 'input',
                type: 'email',
                placeholder: 'your.email@example.com',
                required: true,
              },
              {
                display: 'Issue Description',
                name: 'body',
                tag: 'textarea',
                rows: 15,
                placeholder: 'Describe your issue here...',
                defaultValue: () => {
                  const telemetry = sessionStorage.getItem('changeorderino_telemetry') || '';
                  if (telemetry) {
                    return '\n\n\n\n' + '='.repeat(60) + '\n' +
                           'SYSTEM DIAGNOSTICS (do not modify below this line)\n' +
                           '='.repeat(60) + '\n' + telemetry;
                  }
                  return '';
                },
              },
            ],
          });
          $formContainer.data('zammad-initialized', true);
        }
      }
    }, 100);

    return () => {
      clearInterval(initZammad);
    };
  }, [telemetryData]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Help & Support</h1>
        <p className="text-gray-600">
          Need assistance? Submit a support ticket below.
        </p>
      </div>

      {/* Zammad Form Container */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start space-x-3 mb-4">
          <div className="flex-shrink-0">
            <HelpCircle className="w-8 h-8 text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Submit a Support Ticket</h2>
            <p className="text-gray-600 mb-4">
              Fill out the form below to create a support ticket. System diagnostics will be automatically included.
            </p>
          </div>
        </div>

        {isCollecting && (
          <div className="mb-4 text-sm text-gray-500 flex items-center">
            <span className="inline-block animate-spin mr-2">⚙️</span>
            Collecting system diagnostics...
          </div>
        )}

        {/* Zammad form will be injected here */}
        <div id="zammad-form-container"></div>
      </div>

      {/* Emergency Contact Card */}
      <div className="bg-red-50 rounded-lg border border-red-200 p-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Emergency Support</h3>
            <p className="text-gray-700 mb-2">
              For immediate emergencies, please call{' '}
              <a href="tel:+14125567007" className="text-red-600 font-bold hover:underline">
                +1 (412) 556-7007
              </a>
            </p>
            <p className="text-sm text-gray-600">
              Press 5 for support, then 5 again to connect to a technician
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
