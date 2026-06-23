import type { AgentProfile } from '@/lib/types';

export const AGENT_REPORTS_SECTION = 'agent_reports';

export const DEFAULT_AGENT_REPORT_CAPABILITIES = [
  'agent_reports_create',
  'agent_reports_view_own',
  'agent_reports_upload_attachments',
] as const;

export function canAccessAgentReports(profile?: Pick<AgentProfile, 'status' | 'allowedSections' | 'capabilities'> | null) {
  if (!profile) {
    return false;
  }

  if (profile.status !== 'active') {
    return false;
  }

  const hasSection = profile.allowedSections?.includes(AGENT_REPORTS_SECTION) ?? false;
  const hasCapability = profile.capabilities?.includes('agent_reports_create') ?? false;

  return hasSection && hasCapability;
}