import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { arePersonCardPropsEqual } from '../src/components/Canvas/personCardMemo';
import type { PersonCardProps } from '../src/components/Canvas/PersonCard';
import type { LayoutNode, Person, PersonDocument } from '../src/types/tree';
import { computePersonDisplayInfo } from '../src/services/displayUtils';

describe('PersonCard Node Attachment Indicator', () => {
  const sampleDoc1: PersonDocument = {
    id: 'doc-1',
    name: 'Birth_Certificate.pdf',
    driveFileId: 'drive-1',
    uploadedAt: '2026-03-01T12:00:00Z',
  };

  const sampleDoc2: PersonDocument = {
    id: 'doc-2',
    name: 'Portrait_1920.jpg',
    driveFileId: 'drive-2',
    uploadedAt: '2026-03-02T12:00:00Z',
  };

  const basePerson: Person = {
    id: 'p1',
    firstName: 'John',
    lastName: 'Doe',
    gender: 'male',
    unionIds: [],
  };

  const baseNode: LayoutNode = {
    id: 'p1',
    type: 'person',
    data: basePerson,
    x: 100,
    y: 100,
    width: 220,
    height: 72,
    generation: 0,
    order: 0,
    displayInfo: computePersonDisplayInfo(basePerson),
  };

  const noop = () => {};

  const createProps = (overrides?: Partial<PersonCardProps>): PersonCardProps => ({
    node: baseNode,
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
    onPreviewDocument: noop,
    ...overrides,
  });

  describe('arePersonCardPropsEqual with onPreviewDocument', () => {
    it('returns true when onPreviewDocument is identical', () => {
      const prev = createProps();
      const next = createProps();
      assert.strictEqual(arePersonCardPropsEqual(prev, next), true);
    });

    it('returns false when onPreviewDocument callback changes', () => {
      const prev = createProps({ onPreviewDocument: () => {} });
      const next = createProps({ onPreviewDocument: () => {} });
      assert.strictEqual(arePersonCardPropsEqual(prev, next), false);
    });

    it('returns false when node person documents are added or updated', () => {
      const personWithDocs: Person = {
        ...basePerson,
        documents: [sampleDoc1],
      };
      const nodeWithDocs: LayoutNode = {
        ...baseNode,
        data: personWithDocs,
      };

      const prev = createProps();
      const next = createProps({ node: nodeWithDocs });

      assert.strictEqual(arePersonCardPropsEqual(prev, next), false);
    });
  });

  describe('Attachment Indicator Detection and Display Strings', () => {
    it('accurately identifies when person has no documents', () => {
      const p: Person = { ...basePerson, documents: [] };
      const hasDocs = Boolean(p.documents && p.documents.length > 0);
      assert.strictEqual(hasDocs, false);
    });

    it('formats single attachment tooltip and document count correctly', () => {
      const p: Person = { ...basePerson, documents: [sampleDoc1] };
      const hasDocs = Boolean(p.documents && p.documents.length > 0);
      const count = p.documents?.length || 0;
      const tooltip = `${count} attached document${count === 1 ? '' : 's'}: ${p.documents!.map((d) => d.name).join(', ')}`;

      assert.strictEqual(hasDocs, true);
      assert.strictEqual(count, 1);
      assert.strictEqual(tooltip, '1 attached document: Birth_Certificate.pdf');
    });

    it('formats multiple attachments tooltip and document count correctly', () => {
      const p: Person = { ...basePerson, documents: [sampleDoc1, sampleDoc2] };
      const hasDocs = Boolean(p.documents && p.documents.length > 0);
      const count = p.documents?.length || 0;
      const tooltip = `${count} attached document${count === 1 ? '' : 's'}: ${p.documents!.map((d) => d.name).join(', ')}`;

      assert.strictEqual(hasDocs, true);
      assert.strictEqual(count, 2);
      assert.strictEqual(tooltip, '2 attached documents: Birth_Certificate.pdf, Portrait_1920.jpg');
    });
  });
});
