// Contact types
export const CONTACT_TYPES = ['broker', 'tenant', 'lender', 'contractor', 'investor', 'vendor', 'other']

// Health statuses
export const HEALTH_STATUSES = ['active', 'warm', 'cooling', 'cold', 'at_risk']

// Deal types
export const DEAL_TYPES = ['acquisition', 'leasing', 'development', 'lending', 'other']

// Activity types
export const ACTIVITY_TYPES = ['email', 'call', 'meeting', 'note', 'task', 'document', 'sms']

// Property types
export const PROPERTY_TYPES = ['office', 'retail', 'industrial', 'multifamily', 'land', 'mixed_use', 'other']

// Lease types
export const LEASE_TYPES = ['NNN', 'gross', 'modified_gross', 'other']

// Task priorities
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent']

// Task statuses
export const TASK_STATUSES = ['open', 'in_progress', 'completed', 'cancelled']

// Memory kinds. Personal and client moments share one collection and one
// timeline; this is what the filter chips switch on, and what decides whether
// a memory offers deal/property links at all.
export const MEMORY_KINDS = ['personal', 'client']

// User roles
export const USER_ROLES = ['admin', 'manager', 'user', 'read_only']

// Firestore collection names
export const COLLECTIONS = {
  USERS: 'users',
  TEAMS: 'teams',
  CONTACTS: 'contacts',
  COMPANIES: 'companies',
  DEALS: 'deals',
  PIPELINES: 'pipelines',
  PROPERTIES: 'properties',
  EMAILS: 'emails',
  TASKS: 'tasks',
  NOTIFICATIONS: 'notifications',
  WORKFLOW_RULES: 'workflow_rules',
  WORKFLOW_LOGS: 'workflow_logs',
  AI_LOGS: 'ai_logs',
  INTEGRATION_CONNECTIONS: 'integration_connections',
  EMAIL_TEMPLATES: 'email_templates',
  TASK_TEMPLATES: 'task_templates',
  PROJECT_LINKS: 'project_links',
  MEMORIES: 'memories',
}

// Pipeline stage templates live in @/store/settingsStore and are consumed
// through @/lib/pipeline — the single source of truth for stage reasoning.
// A second, conflicting copy used to live here; don't reintroduce one.
