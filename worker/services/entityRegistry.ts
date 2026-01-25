/**
 * Domain-Agnostic Entity Type System
 *
 * This module provides a generic, configuration-based system for defining
 * entity types and their actions. This allows the application to be extended
 * beyond just project/task management to other domains.
 *
 * The key idea is that domain concepts (entities, actions, constraints) are
 * defined declaratively rather than hardcoded throughout the codebase.
 */

import type { JsonSchema } from './aiToolRegistry';

// ============================================================================
// Core Type Definitions
// ============================================================================

/**
 * Supported action types for any entity
 */
export type ActionType = 'create' | 'update' | 'delete' | 'read' | 'list';

/**
 * Entity type configuration
 */
export interface EntityTypeConfig {
  /** Unique identifier for this entity type */
  name: string;

  /** Display name for UI purposes */
  displayName: string;

  /** The database table name */
  tableName: string;

  /** Primary key field name (default: 'id') */
  primaryKey?: string;

  /** Field definitions for this entity */
  fields: EntityField[];

  /** Supported actions for this entity */
  actions?: ActionType[];

  /** Default values for fields */
  defaults?: Record<string, unknown>;

  /** Validation rules */
  validation?: EntityValidation;

  /** Whether this entity belongs to a parent (e.g., task belongs to project) */
  parentEntity?: string;

  /** Foreign key field name referencing parent */
  parentForeignKey?: string;
}

/**
 * Field definition within an entity
 */
export interface EntityField {
  /** Field name in the database */
  name: string;

  /** Display label */
  label?: string;

  /** Field type */
  type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'array' | 'enum';

  /** Whether this field is required */
  required?: boolean;

  /** Whether this field is editable (can be in update actions) */
  editable?: boolean;

  /** Whether this field is included in list views */
  listable?: boolean;

  /** For enum types, the allowed values */
  enumValues?: string[];

  /** JSON Schema for AI tool parameters */
  schema?: JsonSchema;

  /** Default value */
  default?: unknown;

  /** Custom validation function */
  validate?: (value: unknown) => boolean | string;
}

/**
 * Validation rules for an entity
 */
export interface EntityValidation {
  /** Fields that must be unique within scope */
  unique?: string[];

  /** Fields that must be provided together */
  requiredTogether?: string[][];

  /** Conditional requirements */
  conditionalRequirements?: Array<{
    if: { field: string; value: unknown };
    then: { required: string[] };
  }>;
}

/**
 * Action configuration for an entity
 */
export interface EntityActionConfig {
  /** Action type */
  type: ActionType;

  /** Display name */
  displayName?: string;

  /** Whether this action requires user approval (creates a draft) */
  requiresApproval?: boolean;

  /** Fields that can be modified in this action */
  allowedFields?: string[];

  /** Fields that are required for this action */
  requiredFields?: string[];

  /** Fields to exclude from this action */
  excludedFields?: string[];

  /** Custom handler for this action */
  handler?: string; // Reference to a named handler
}

// ============================================================================
// Domain Configuration
// ============================================================================

/**
 * Complete domain configuration
 *
 * A domain defines a set of entity types and their relationships.
 * For example, a "project-management" domain has projects and tasks.
 */
export interface DomainConfig {
  /** Domain identifier */
  name: string;

  /** Display name */
  displayName: string;

  /** Entity types in this domain */
  entities: EntityTypeConfig[];

  /** Action templates that apply across entity types */
  actions?: Record<string, Partial<EntityActionConfig>>;

  /** Relationships between entities */
  relationships?: EntityRelationship[];

  /** Constraints that apply across entities */
  constraints?: DomainConstraint[];
}

/**
 * Relationship between two entities
 */
export interface EntityRelationship {
  /** Relationship type */
  type: 'one-to-many' | 'many-to-many' | 'one-to-one' | 'parent-child';

  /** Source entity */
  from: string;

  /** Target entity */
  to: string;

  /** Foreign key field */
  foreignKey?: string;

  /** Junction table for many-to-many */
  junctionTable?: string;
}

/**
 * Cross-entity constraint
 */
export interface DomainConstraint {
  /** Constraint identifier */
  name: string;

  /** Description of what this constraint enforces */
  description: string;

  /** Entities involved in this constraint */
  entities: string[];

  /** Constraint checker function */
  check: (context: ConstraintContext) => ConstraintResult;
}

/**
 * Context provided to constraint checkers
 */
export interface ConstraintContext {
  /** The entity being validated */
  entity: string;

  /** The action being performed */
  action: ActionType;

  /** The data being applied */
  data: Record<string, unknown>;

  /** Current state of all entities (for validation) */
  currentState: Map<string, Record<string, unknown>[]>;

  /** Database instance for queries */
  db: any;
}

/**
 * Result of constraint validation
 */
export interface ConstraintResult {
  /** Whether the constraint is satisfied */
  satisfied: boolean;

  /** Error message if not satisfied */
  message?: string;

  /** Suggested fixes (optional) */
  suggestions?: string[];
}

// ============================================================================
// Entity Registry
// ============================================================================

/**
 * Registry for entity type configurations
 */
class EntityRegistry {
  private domains = new Map<string, DomainConfig>();
  private entities = new Map<string, EntityTypeConfig>();

  registerDomain(domain: DomainConfig): void {
    this.domains.set(domain.name, domain);
    for (const entity of domain.entities) {
      this.entities.set(`${domain.name}:${entity.name}`, entity);
    }
  }

  getDomain(name: string): DomainConfig | undefined {
    return this.domains.get(name);
  }

  getEntity(domainName: string, entityName: string): EntityTypeConfig | undefined {
    return this.entities.get(`${domainName}:${entityName}`);
  }

  getAllDomains(): DomainConfig[] {
    return Array.from(this.domains.values());
  }

  getEntitiesForDomain(domainName: string): EntityTypeConfig[] {
    const domain = this.domains.get(domainName);
    return domain?.entities || [];
  }
}

// Global entity registry instance
export const entityRegistry = new EntityRegistry();

// ============================================================================
// Default Domain Configuration (Project Management)
// ============================================================================

/**
 * Default project management domain configuration
 *
 * This defines the current FlowSync domain in a declarative way.
 * New domains can be added without changing core logic.
 */
export const projectManagementDomain: DomainConfig = {
  name: 'project-management',
  displayName: 'Project Management',
  entities: [
    {
      name: 'project',
      displayName: 'Project',
      tableName: 'projects',
      fields: [
        { name: 'id', type: 'string', required: true, editable: false, listable: true },
        { name: 'name', type: 'string', required: true, editable: true, listable: true },
        { name: 'description', type: 'string', required: false, editable: true, listable: false },
        { name: 'icon', type: 'string', required: false, editable: true, listable: false },
        { name: 'createdAt', type: 'date', required: true, editable: false, listable: false },
        { name: 'updatedAt', type: 'date', required: true, editable: false, listable: false },
      ],
      actions: ['create', 'read', 'update', 'delete', 'list'],
    },
    {
      name: 'task',
      displayName: 'Task',
      tableName: 'tasks',
      parentEntity: 'project',
      parentForeignKey: 'projectId',
      fields: [
        { name: 'id', type: 'string', required: true, editable: false, listable: true },
        { name: 'projectId', type: 'string', required: true, editable: false, listable: false },
        { name: 'title', type: 'string', required: true, editable: true, listable: true },
        { name: 'description', type: 'string', required: false, editable: true, listable: false },
        { name: 'status', type: 'enum', required: true, editable: true, listable: true, enumValues: ['TODO', 'IN_PROGRESS', 'DONE'] },
        { name: 'priority', type: 'enum', required: true, editable: true, listable: true, enumValues: ['LOW', 'MEDIUM', 'HIGH'] },
        { name: 'wbs', type: 'string', required: false, editable: true, listable: true },
        { name: 'startDate', type: 'date', required: false, editable: true, listable: true },
        { name: 'dueDate', type: 'date', required: false, editable: true, listable: true },
        { name: 'completion', type: 'number', required: false, editable: true, listable: false },
        { name: 'assignee', type: 'string', required: false, editable: true, listable: true },
        { name: 'isMilestone', type: 'boolean', required: false, editable: true, listable: false },
        { name: 'predecessors', type: 'array', required: false, editable: true, listable: false },
        { name: 'createdAt', type: 'date', required: true, editable: false, listable: false },
        { name: 'updatedAt', type: 'date', required: true, editable: false, listable: false },
      ],
      actions: ['create', 'read', 'update', 'delete', 'list'],
    },
    {
      name: 'draft',
      displayName: 'Draft',
      tableName: 'drafts',
      fields: [
        { name: 'id', type: 'string', required: true, editable: false, listable: true },
        { name: 'projectId', type: 'string', required: false, editable: false, listable: false },
        { name: 'status', type: 'enum', required: true, editable: true, listable: true, enumValues: ['pending', 'applied', 'discarded'] },
        { name: 'actions', type: 'json', required: true, editable: false, listable: false },
        { name: 'createdAt', type: 'date', required: true, editable: false, listable: true },
        { name: 'createdBy', type: 'enum', required: true, editable: false, listable: true, enumValues: ['user', 'agent', 'system'] },
        { name: 'reason', type: 'string', required: false, editable: false, listable: false },
      ],
      actions: ['create', 'read', 'update', 'delete', 'list'],
    },
  ],
  relationships: [
    {
      type: 'parent-child',
      from: 'project',
      to: 'task',
      foreignKey: 'projectId',
    },
  ],
  constraints: [
    // Predecessor dependency constraint is handled in constraintService.ts
    // This is just a placeholder to show how cross-entity constraints work
  ],
};

// Register the default domain
entityRegistry.registerDomain(projectManagementDomain);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get JSON schema for an entity's fields (for AI tools)
 */
export function getEntityFieldsSchema(
  domainName: string,
  entityName: string,
  options: {
    include?: string[];
    exclude?: string[];
    required?: string[];
  } = {}
): JsonSchema {
  const entity = entityRegistry.getEntity(domainName, entityName);
  if (!entity) {
    return { type: 'object', properties: {} };
  }

  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const field of entity.fields) {
    if (options.exclude?.includes(field.name)) continue;
    if (options.include && !options.include.includes(field.name)) continue;

    if (field.required || options.required?.includes(field.name)) {
      required.push(field.name);
    }

    let fieldSchema: JsonSchema = field.schema || {
      type: field.type,
      description: field.label || field.name,
    };

    if (field.type === 'enum' && field.enumValues) {
      fieldSchema = { type: 'string', enum: field.enumValues };
    }

    properties[field.name] = fieldSchema;
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Generate AI tool definitions from entity configuration
 */
export function generateEntityTools(domainName: string, entityName: string) {
  const entity = entityRegistry.getEntity(domainName, entityName);
  if (!entity) return [];

  const tools: Array<{ name: string; description: string; parameters: JsonSchema }> = [];
  const entityDisplayName = entity.displayName;

  // List tool
  tools.push({
    name: `list${entityDisplayName}s`,
    description: `List all ${entityDisplayName.toLowerCase()}s with optional filters.`,
    parameters: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        pageSize: { type: 'number' },
      },
    },
  });

  // Get tool
  tools.push({
    name: `get${entityDisplayName}`,
    description: `Fetch a single ${entityDisplayName.toLowerCase()} by id.`,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: `The ${entityDisplayName.toLowerCase()} id` },
      },
      required: ['id'],
    },
  });

  // Create tool (if supported)
  if (entity.actions?.includes('create')) {
    const schema = getEntityFieldsSchema(domainName, entityName, {
      exclude: ['id', 'createdAt', 'updatedAt'],
    });
    tools.push({
      name: `create${entityDisplayName}`,
      description: `Create a new ${entityDisplayName.toLowerCase()}. Creates a draft that requires user approval.`,
      parameters: schema,
    });
  }

  // Update tool (if supported)
  if (entity.actions?.includes('update')) {
    const schema = getEntityFieldsSchema(domainName, entityName, {
      exclude: ['id', 'createdAt', 'updatedAt'],
    });
    tools.push({
      name: `update${entityDisplayName}`,
      description: `Update an existing ${entityDisplayName.toLowerCase()}. Creates a draft that requires user approval.`,
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: `The ${entityDisplayName.toLowerCase()} id` },
          ...(schema.properties as Record<string, JsonSchema>),
        },
        required: ['id'],
      },
    });
  }

  // Delete tool (if supported)
  if (entity.actions?.includes('delete')) {
    tools.push({
      name: `delete${entityDisplayName}`,
      description: `Delete a ${entityDisplayName.toLowerCase()}. Creates a draft that requires user approval.`,
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: `The ${entityDisplayName.toLowerCase()} id` },
          reason: { type: 'string', description: 'Reason for deletion (optional)' },
        },
        required: ['id'],
      },
    });
  }

  return tools;
}
