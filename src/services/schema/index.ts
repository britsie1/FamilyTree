export * from './constants';
export * from './types';
export * from './validators';
export * from './migrations';
export * from './invariants';
export * from './repair';

import { migrate } from './migrations';
import { validateTree } from './validators';
import { checkInvariants } from './invariants';
import { repair } from './repair';
import type { TreeData } from '../../types/tree';
import type { RepairReport, InvariantViolation } from './types';

export interface IngressResult {
  tree: TreeData;
  repaired: boolean;
  repairReport: RepairReport;
  violations: InvariantViolation[];
  rawPayloadPreserved?: unknown;
}

/**
 * Standard data ingress pipeline enforced at every app boundary:
 * 1. Stepwise migration (older/unversioned -> CURRENT_SCHEMA_VERSION).
 * 2. Schema structure validation.
 * 3. Invariant checking.
 * 4. Deterministic repair of repairable issues.
 * 5. Re-check invariants.
 *
 * If unrepairable critical violations remain (e.g. malformed non-object data),
 * throws or rejects without clobbering existing good data.
 */
export function processTreeIngress(
  raw: unknown,
  options?: { preserveRawOnError?: boolean }
): IngressResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Tree payload rejected: payload must be a valid non-null object.');
  }

  // 1. Migrate
  const migrated = migrate(raw);

  // 2. Validate Schema
  const schemaResult = validateTree(migrated);
  if (!schemaResult.success) {
    const errorMsg = `Tree schema validation failed: ${schemaResult.errors.join('; ')}`;
    const err = new Error(errorMsg) as any;
    if (options?.preserveRawOnError) {
      err.rawPayload = raw;
    }
    throw err;
  }

  // 3. Deterministic Repair
  const { tree: repairedTree, report } = repair(migrated);

  // 5. Final Invariant Check
  const remainingViolations = checkInvariants(repairedTree);

  // Check if any critical unrepairable violations remain (e.g. duplicate person IDs)
  const criticalErrors = remainingViolations.filter((v) => v.severity === 'error');
  if (criticalErrors.length > 0) {
    const errorMsg = `Tree contains unrepairable invariant violations: ${criticalErrors.map((v) => v.message).join('; ')}`;
    const err = new Error(errorMsg) as any;
    if (options?.preserveRawOnError) {
      err.rawPayload = raw;
    }
    throw err;
  }

  return {
    tree: repairedTree,
    repaired: report.repaired,
    repairReport: report,
    violations: remainingViolations,
    rawPayloadPreserved: options?.preserveRawOnError ? raw : undefined,
  };
}
