import { computeLayout } from '../services/layoutEngine';
import type { TreeData, LayoutStyle, LayoutOverrides } from '../types/tree';

export interface LayoutWorkerRequest {
  id: number;
  tree: TreeData;
  layoutStyle: LayoutStyle;
  groupByFamily: boolean;
  collapsedPersonIds: string[];
  adjustSpacing: boolean;
  layoutOverrides?: LayoutOverrides;
}

export interface LayoutWorkerResponse {
  id: number;
  layout?: any;
  error?: string;
}

self.onmessage = (e: MessageEvent<LayoutWorkerRequest>) => {
  const { id, tree, layoutStyle, groupByFamily, collapsedPersonIds, adjustSpacing, layoutOverrides } = e.data;
  try {
    const layout = computeLayout(
      tree,
      layoutStyle,
      groupByFamily,
      collapsedPersonIds,
      adjustSpacing,
      layoutOverrides
    );
    self.postMessage({ id, layout });
  } catch (err: any) {
    self.postMessage({ id, error: err?.message || 'Layout computation error' });
  }
};
