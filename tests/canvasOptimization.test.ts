import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computePersonDisplayInfo, getPersonDisplayInfo } from '../src/services/displayUtils.ts';
import { arePersonCardPropsEqual } from '../src/components/Canvas/personCardMemo.ts';
import { computeVerticalLayout, computeHorizontalLayout } from '../src/services/layoutEngine.ts';
import { createDoubleInLawPreset } from '../src/services/storage.ts';
import type { Person, LayoutNode } from '../src/types/tree.ts';
import type { PersonCardProps } from '../src/components/Canvas/PersonCard.tsx';

describe('Canvas Rendering Optimization & Display Precomputation', () => {
  describe('computePersonDisplayInfo', () => {
    it('computes display info for a living person with full details', () => {
      const person: Person = {
        id: 'p1',
        firstName: 'John',
        middleNames: 'William',
        lastName: 'Doe',
        gender: 'male',
        birthDate: '1990-05-15',
        isDeceased: false,
        unionIds: [],
      };

      const info = computePersonDisplayInfo(person);
      assert.strictEqual(info.displayName, 'John Doe');
      assert.strictEqual(info.fullName, 'John William Doe');
      assert.strictEqual(info.isUnnamed, false);
      assert.strictEqual(info.initials, 'JD');
      assert.strictEqual(info.birthYear, '1990');
      assert.strictEqual(info.deathYear, '');
      assert.ok(info.age !== null && info.age >= 30);
      assert.ok(info.standardDateText.startsWith('b. 1990 (age '));
    });

    it('prioritizes knownAs for display name and initials', () => {
      const person: Person = {
        id: 'p2',
        firstName: 'Alexander',
        lastName: 'Smith',
        knownAs: 'Sasha',
        gender: 'male',
        unionIds: [],
      };

      const info = computePersonDisplayInfo(person);
      assert.strictEqual(info.displayName, 'Sasha Smith');
      assert.strictEqual(info.fullName, 'Alexander Smith');
      assert.strictEqual(info.initials, 'SS');
      assert.strictEqual(info.isUnnamed, false);
    });

    it('handles deceased person with birth and death dates', () => {
      const person: Person = {
        id: 'p3',
        firstName: 'Mary',
        lastName: 'Jones',
        gender: 'female',
        birthDate: '1920-04-10',
        deathDate: '1995-11-20',
        isDeceased: true,
        unionIds: [],
      };

      const info = computePersonDisplayInfo(person);
      assert.strictEqual(info.birthYear, '1920');
      assert.strictEqual(info.deathYear, '1995');
      assert.strictEqual(info.age, 75);
      assert.strictEqual(info.standardDateText, '1920 – 1995 (age 75)');
    });

    it('handles deceased person without death date', () => {
      const person: Person = {
        id: 'p4',
        firstName: 'George',
        lastName: 'Brown',
        gender: 'male',
        birthDate: '1880',
        isDeceased: true,
        unionIds: [],
      };

      const info = computePersonDisplayInfo(person);
      assert.strictEqual(info.birthYear, '1880');
      assert.strictEqual(info.deathYear, '');
      assert.strictEqual(info.standardDateText, 'b. 1880 (deceased)');
    });

    it('handles death date only', () => {
      const person: Person = {
        id: 'p5',
        firstName: 'Unknown',
        lastName: 'Ancestor',
        deathDate: '1750',
        unionIds: [],
      };

      const info = computePersonDisplayInfo(person);
      assert.strictEqual(info.birthYear, '');
      assert.strictEqual(info.deathYear, '1750');
      assert.strictEqual(info.standardDateText, 'd. 1750');
    });

    it('handles blank / unnamed person cleanly', () => {
      const person: Person = {
        id: 'p6',
        unionIds: [],
      };

      const info = computePersonDisplayInfo(person);
      assert.strictEqual(info.displayName, 'Unnamed Person');
      assert.strictEqual(info.fullName, 'Unnamed Person');
      assert.strictEqual(info.isUnnamed, true);
      assert.strictEqual(info.initials, '?');
      assert.strictEqual(info.standardDateText, '');
    });

    it('handles null / undefined person', () => {
      const info = computePersonDisplayInfo(null);
      assert.strictEqual(info.displayName, 'Unnamed Person');
      assert.strictEqual(info.isUnnamed, true);
      assert.strictEqual(info.initials, '?');
    });
  });

  describe('getPersonDisplayInfo caching', () => {
    it('returns the identical cached object reference for the same Person object', () => {
      const person: Person = {
        id: 'p-cache',
        firstName: 'Caching',
        lastName: 'Test',
        birthDate: '1985-01-01',
        unionIds: [],
      };

      const first = getPersonDisplayInfo(person);
      const second = getPersonDisplayInfo(person);
      assert.strictEqual(first, second);
    });
  });

  describe('layoutEngine displayInfo precomputation', () => {
    it('populates displayInfo on all nodes in vertical layout', () => {
      const tree = createDoubleInLawPreset();
      const layout = computeVerticalLayout(tree);

      const nodeValues = Object.values(layout.nodes);
      assert.ok(nodeValues.length > 0);
      for (const node of nodeValues) {
        assert.ok(node.displayInfo, `Node ${node.id} is missing precomputed displayInfo`);
        assert.strictEqual(typeof node.displayInfo.displayName, 'string');
        assert.strictEqual(typeof node.displayInfo.initials, 'string');
      }
    });

    it('populates displayInfo on all nodes in horizontal layout', () => {
      const tree = createDoubleInLawPreset();
      const layout = computeHorizontalLayout(tree);

      const nodeValues = Object.values(layout.nodes);
      assert.ok(nodeValues.length > 0);
      for (const node of nodeValues) {
        assert.ok(node.displayInfo, `Node ${node.id} is missing precomputed displayInfo`);
        assert.strictEqual(typeof node.displayInfo.displayName, 'string');
      }
    });
  });

  describe('arePersonCardPropsEqual memoization comparator', () => {
    const mockPerson: Person = {
      id: 'p1',
      firstName: 'Alice',
      lastName: 'Smith',
      gender: 'female',
      birthDate: '1970-01-01',
      unionIds: [],
    };

    const mockNode: LayoutNode = {
      id: 'p1',
      type: 'person',
      data: mockPerson,
      x: 100,
      y: 100,
      width: 220,
      height: 104,
      generation: 0,
      order: 0,
      displayInfo: computePersonDisplayInfo(mockPerson),
    };

    const noop = () => {};

    const createBaseProps = (): PersonCardProps => ({
      node: mockNode,
      layoutStyle: 'vertical',
      isSelected: false,
      isMultiSelected: false,
      isCompared: false,
      isOnRelationshipPath: false,
      hasActiveComparison: false,
      isHovered: false,
      hasDescendants: false,
      temporalYear: null,
      isRoomHonoree: false,
      activeMoment: null,
      onSelect: noop,
      onHover: noop,
      onAddChild: noop,
      onAddPartner: noop,
      onAddSibling: noop,
      onAddParent: noop,
      onDragStart: noop,
      dragOffset: null,
      isConnectTarget: false,
    });

    it('returns true when all props and stable callbacks are identical', () => {
      const baseProps = createBaseProps();
      assert.strictEqual(arePersonCardPropsEqual(baseProps, { ...baseProps }), true);
    });

    it('returns false when isSelected changes', () => {
      const prev = createBaseProps();
      const next = { ...prev, isSelected: true };
      assert.strictEqual(arePersonCardPropsEqual(prev, next), false);
    });

    it('returns false when isHovered changes', () => {
      const prev = createBaseProps();
      const next = { ...prev, isHovered: true };
      assert.strictEqual(arePersonCardPropsEqual(prev, next), false);
    });

    it('returns false when isConnectTarget changes (during cable drag over card)', () => {
      const prev = createBaseProps();
      const next = { ...prev, isConnectTarget: true };
      assert.strictEqual(arePersonCardPropsEqual(prev, next), false);
    });

    it('returns false when dragOffset changes for a dragged card', () => {
      const prev = createBaseProps();
      const next = { ...prev, dragOffset: { x: 10, y: 20 } };
      assert.strictEqual(arePersonCardPropsEqual(prev, next), false);
    });

    it('returns true when dragOffset has identical coordinates', () => {
      const prev = { ...createBaseProps(), dragOffset: { x: 15, y: 25 } };
      const next = { ...createBaseProps(), dragOffset: { x: 15, y: 25 } };
      assert.strictEqual(arePersonCardPropsEqual(prev, next), true);
    });

    it('returns false when temporalYear scrub changes', () => {
      const prev = createBaseProps();
      const next = { ...prev, temporalYear: 1960 };
      assert.strictEqual(arePersonCardPropsEqual(prev, next), false);
    });

    it('returns false when node position or data changes', () => {
      const prev = createBaseProps();
      const next = {
        ...prev,
        node: {
          ...prev.node,
          x: 200,
        },
      };
      assert.strictEqual(arePersonCardPropsEqual(prev, next), false);
    });
  });
});
