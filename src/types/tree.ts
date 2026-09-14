export type Gender = 'male' | 'female' | 'other' | 'unspecified';

export type LayoutStyle = 'vertical' | 'horizontal';

export interface Person {
  id: string;
  firstName?: string;
  middleNames?: string;
  lastName?: string;
  knownAs?: string;
  maidenName?: string;
  gender?: Gender;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  isDeceased?: boolean;
  avatarUrl?: string;
  notes?: string;
  // Position override if manually dragged (vertical layout)
  x?: number;
  y?: number;
  // Position override if manually dragged (horizontal layout)
  horizontalX?: number;
  horizontalY?: number;
  // Relationship references
  parentUnionId?: string; // Union of this person's biological/adoptive parents
  unionIds: string[];     // IDs of unions where this person is a partner/parent
  generation?: number;    // Generational rank level (supports negative for ancestors above root)
}

export type UnionType = 'married' | 'divorced' | 'separated' | 'partner' | 'other';

export interface Union {
  id: string;
  partnerIds: string[];   // Person IDs (e.g. [fatherId, motherId] or partners)
  childrenIds: string[];  // Person IDs of children born/adopted into this union
  marriageDate?: string;
  divorceDate?: string;
  type?: UnionType;
  // Position override if manually dragged or calculated
  x?: number;
  y?: number;
}

export interface TreeData {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  people: Record<string, Person>;
  unions: Record<string, Union>;
  rootPersonId?: string;
  collapsedPersonIds?: string[];
}

export interface LayoutNode {
  id: string;
  type: 'person';
  data: Person;
  x: number;
  y: number;
  width: number;
  height: number;
  generation: number;
  order: number;
  familyId?: string;
  isCollapsed?: boolean;
  hiddenCount?: number;
}

export interface FamilyGroup {
  id: string;
  name: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  bgColor: string;
  memberIds: string[];
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

export interface LayoutUnion {
  id: string;
  type: 'union';
  data: Union;
  x: number;
  y: number;
  generation: number;
  partnerNodes: LayoutNode[];
  childrenNodes: LayoutNode[];
  busCoord?: number;
  color?: string;
}

export interface HopPoint {
  x: number;
  y: number;
  radius: number;
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface LayoutEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: 'partner-union' | 'union-child' | 'parent-child-direct';
  pathD: string;
  color?: string;
  isHighlighted?: boolean;
  hasHop?: boolean;
  unionType?: UnionType;
}

export interface TreeLayout {
  nodes: Record<string, LayoutNode>;
  unions: Record<string, LayoutUnion>;
  edges: LayoutEdge[];
  familyGroups?: FamilyGroup[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}
