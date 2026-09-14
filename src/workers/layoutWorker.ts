import { computeLayout } from '../services/layoutEngine';
import type { TreeData, LayoutStyle } from '../types/tree';

export interface LayoutWorkerRequest {
  id: number;
  tree: TreeData;
  layoutStyle: LayoutStyle;
  groupByFamily: boolean;
  collapsedPersonIds: string[];
  adjustSpacing: boolean;
}

export interface LayoutWorkerResponse {
  id: number;
  layout?: any;
  error?: string;
}

self.onmessage = (e: MessageEvent<LayoutWorkerRequest>) => {
  const { id, tree, layoutStyle, groupByFamily, collapsedPersonIds, adjustSpacing } = e.data;
  try {
    const layout = computeLayout(
      tree,
      layoutStyle,
      groupByFamily,
      collapsedPersonIds,
      adjustSpacing
    );
    self.postMessage({ id, layout });
  } catch (err: any) {
    self.postMessage({ id, error: err?.message || 'Layout computation error' });
  }
};
