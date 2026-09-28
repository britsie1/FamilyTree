import { describe, it } from 'node:test';
import assert from 'node:assert';
import { unlinkParentFromChild, unlinkChild, sanitizeTree } from '../src/services/treeOperations.ts';
import type { TreeData } from '../src/types/tree.ts';

describe('Tree Operations - Bug 3.4 & Bug 3.5', () => {
  describe('Bug 3.4: Unlinking Child from Parent-less Union Deadlock', () => {
    it('successfully unlinks child from an orphan union with 0 partners', () => {
      const tree: TreeData = {
        id: 'orphan-union-tree',
        name: 'Orphan Union Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          child1: { id: 'child1', firstName: 'Orphan', lastName: 'Child', parentUnionId: 'u_orphan', unionIds: [] },
        },
        unions: {
          u_orphan: {
            id: 'u_orphan',
            partnerIds: [],
            childrenIds: ['child1'],
          },
        },
      };

      const result = unlinkParentFromChild(tree, 'child1', 'non_existent_parent');
      assert.strictEqual(result.people['child1'].parentUnionId, undefined);
      assert.strictEqual(result.unions['u_orphan'], undefined, 'Orphan union with 0 children must be deleted');
    });

    it('cleans up dangling parentUnionId when union document does not exist', () => {
      const tree: TreeData = {
        id: 'dangling-union-tree',
        name: 'Dangling Union Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          child1: { id: 'child1', firstName: 'Dangling', lastName: 'Child', parentUnionId: 'u_missing', unionIds: [] },
        },
        unions: {},
      };

      const result = unlinkParentFromChild(tree, 'child1', 'p1');
      assert.strictEqual(result.people['child1'].parentUnionId, undefined);
    });
  });

  describe('Bug 3.5: Single-Parent Empty Union Leak on Child Removal', () => {
    it('deletes single-parent union when the only child is unlinked', () => {
      const tree: TreeData = {
        id: 'single-parent-tree',
        name: 'Single Parent Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          singleMom: { id: 'singleMom', firstName: 'Single', lastName: 'Mother', unionIds: ['u_single'] },
          child1: { id: 'child1', firstName: 'Only', lastName: 'Child', parentUnionId: 'u_single', unionIds: [] },
        },
        unions: {
          u_single: {
            id: 'u_single',
            partnerIds: ['singleMom'],
            childrenIds: ['child1'],
          },
        },
      };

      const result = unlinkChild(tree, 'child1');
      assert.strictEqual(result.people['child1'].parentUnionId, undefined);
      assert.strictEqual(result.unions['u_single'], undefined, 'Single parent union with 0 children must be deleted');
      assert.deepStrictEqual(result.people['singleMom'].unionIds, [], 'Parent unionIds must have dead union removed');
    });

    it('preserves multi-child single-parent union when one child remains', () => {
      const tree: TreeData = {
        id: 'multi-child-single-tree',
        name: 'Multi Child Single Parent Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          dad: { id: 'dad', firstName: 'Single', lastName: 'Father', unionIds: ['u_single'] },
          c1: { id: 'c1', firstName: 'Child', lastName: 'One', parentUnionId: 'u_single', unionIds: [] },
          c2: { id: 'c2', firstName: 'Child', lastName: 'Two', parentUnionId: 'u_single', unionIds: [] },
        },
        unions: {
          u_single: {
            id: 'u_single',
            partnerIds: ['dad'],
            childrenIds: ['c1', 'c2'],
          },
        },
      };

      const result = unlinkChild(tree, 'c1');
      assert.strictEqual(result.people['c1'].parentUnionId, undefined);
      assert.ok(result.unions['u_single'], 'Union must be preserved because c2 remains');
      assert.deepStrictEqual(result.unions['u_single'].childrenIds, ['c2']);
      assert.deepStrictEqual(result.people['dad'].unionIds, ['u_single']);
    });

    it('cleans up dead 1-partner 0-children unions unconditionally in sanitizeTree', () => {
      const tree: TreeData = {
        id: 'dead-union-tree',
        name: 'Dead Union Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          p1: { id: 'p1', firstName: 'Person', lastName: 'One', unionIds: ['u_dead'] },
        },
        unions: {
          u_dead: {
            id: 'u_dead',
            partnerIds: ['p1'],
            childrenIds: [],
          },
        },
      };

      const sanitized = sanitizeTree(tree);
      assert.strictEqual(sanitized.unions['u_dead'], undefined);
      assert.deepStrictEqual(sanitized.people['p1'].unionIds, []);
    });
  });
});
