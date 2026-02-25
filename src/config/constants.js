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
}

// CRE Pipeline stage templates
export const PIPELINE_TEMPLATES = {
  leasing: ['Prospect', 'Tour', 'Proposal', 'Negotiation', 'Execution', 'Occupancy'],
  acquisition: ['Identification', 'Underwriting', 'LOI', 'Due Diligence', 'Closing'],
  development: ['Concept', 'Entitlement', 'Design', 'Construction', 'Stabilization'],
  lending: ['Application', 'Underwriting', 'Commitment', 'Closing', 'Funded'],
}
