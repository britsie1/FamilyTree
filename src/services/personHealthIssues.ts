import type { TreeData } from '../types/tree';
import { auditTreeHealth, type HealthAnomaly } from './treeHealthAndStatsService';

/** Index actionable audit issues on both people involved, excluding research suggestions. */
export function getPersonHealthIssues(tree: TreeData): Map<string, HealthAnomaly[]> {
  const result = new Map<string, HealthAnomaly[]>();
  for (const issue of auditTreeHealth(tree).anomalies) {
    if (issue.severity === 'info') continue;
    const ids = new Set([issue.personId, issue.relatedPersonId]);
    if (!issue.personId && !issue.relatedPersonId && issue.unionId) {
      const union = tree.unions[issue.unionId];
      for (const id of union?.partnerIds || []) ids.add(id);
      for (const id of union?.childrenIds || []) ids.add(id);
    }
    for (const id of ids) {
      if (!id || !tree.people[id]) continue;
      const issues = result.get(id) || [];
      issues.push(issue);
      result.set(id, issues);
    }
  }
  return result;
}