export type InvariantViolationCode =
  | 'DUPLICATE_ID'
  | 'DANGLING_UNION_REF'
  | 'DANGLING_PARTNER_REF'
  | 'DANGLING_CHILD_REF'
  | 'PARENT_CYCLE'
  | 'SELF_PARENTING'
  | 'INCONSISTENT_PARENT_LINK'
  | 'ORPHANED_EDGE'
  | 'UNRESOLVABLE_CROSS_TREE_LINK'
  | 'INVALID_DATE_RANGE'
  | 'ROOT_PERSON_NOT_FOUND'
  | 'INVALID_SCHEMA';

export interface InvariantViolation {
  code: InvariantViolationCode;
  severity: 'error' | 'warning';
  message: string;
  path: string[];
  entityId?: string;
  entityType?: 'person' | 'union' | 'tree';
  details?: Record<string, any>;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
}

export type RepairActionType =
  | 'PRUNED_DANGLING_PARTNER'
  | 'PRUNED_DANGLING_CHILD'
  | 'CLEANED_UNION_REF'
  | 'CLEANED_PARENT_UNION'
  | 'REPAIRED_RECIPROCAL_LINK'
  | 'BROKEN_PARENT_CYCLE'
  | 'BROKEN_SELF_PARENTING'
  | 'CLEANED_EMPTY_UNION'
  | 'REPAIRED_INVALID_DATE'
  | 'REPAIRED_ROOT_PERSON';

export interface RepairChange {
  type: RepairActionType;
  description: string;
  entityId?: string;
  path?: string[];
}

export interface RepairReport {
  repaired: boolean;
  changes: RepairChange[];
}
