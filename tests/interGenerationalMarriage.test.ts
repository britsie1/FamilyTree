import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateGenerations,
  computeLayout,
  CARD_HEIGHT,
} from '../src/services/layoutEngine.ts';
import { findInterGenerationalCouples } from '../src/services/layout/generationalRanking.ts';
import type { TreeData, Person, Union } from '../src/types/tree.ts';

const ROW = CARD_HEIGHT + 150;

function person(id: string, unionIds: string[], parentUnionId?: string): Person {
  return { id, firstName: id, unionIds, parentUnionId };
}

/**
 * GP1 + GP2 -> Uncle, Sib
 * Sib + SibSp -> Niece, Cousin
 * Cousin + CousinSp -> Kid (Niece's sibling's child)
 * Uncle + Niece -> Baby
 */
function buildTree(): TreeData {
  const unions: Record<string, Union> = {
    u_gp: { id: 'u_gp', partnerIds: ['gp1', 'gp2'], childrenIds: ['uncle', 'sib'] },
    u_sib: { id: 'u_sib', partnerIds: ['sib', 'sibsp'], childrenIds: ['niece', 'cousin'] },
    u_cousin: { id: 'u_cousin', partnerIds: ['cousin', 'cousinsp'], childrenIds: ['kid'] },
    u_marriage: { id: 'u_marriage', partnerIds: ['uncle', 'niece'], childrenIds: ['baby'] },
  };
  const people: Record<string, Person> = {
    gp1: person('gp1', ['u_gp']),
    gp2: person('gp2', ['u_gp']),
    uncle: person('uncle', ['u_marriage'], 'u_gp'),
    sib: person('sib', ['u_sib'], 'u_gp'),
    sibsp: person('sibsp', ['u_sib']),
    niece: person('niece', ['u_marriage'], 'u_sib'),
    cousin: person('cousin', ['u_cousin'], 'u_sib'),
    cousinsp: person('cousinsp', ['u_cousin']),
    kid: person('kid', [], 'u_cousin'),
    baby: person('baby', [], 'u_marriage'),
  };
  return {
    id: 't',
    name: 't',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    people,
    unions,
  };
}

describe('inter-generational marriages', () => {
  it('detects an uncle/niece marriage with the correct roles', () => {
    const couples = findInterGenerationalCouples(buildTree());
    assert.strictEqual(couples.length, 1);
    assert.strictEqual(couples[0].unionId, 'u_marriage');
    assert.strictEqual(couples[0].olderId, 'uncle');
    assert.strictEqual(couples[0].youngerId, 'niece');
  });

  it('does not flag ordinary marriages, cousin marriages or unrelated partners', () => {
    const tree = buildTree();
    delete tree.unions.u_marriage;
    tree.people.uncle.unionIds = [];
    tree.people.niece.unionIds = [];
    tree.people.baby.parentUnionId = undefined;
    // first cousins marry (same distance to shared ancestor)
    tree.unions.u_cousins = { id: 'u_cousins', partnerIds: ['kid', 'x'], childrenIds: [] };
    assert.strictEqual(findInterGenerationalCouples(tree).length, 0);
  });

  it('moves the older partner down to the younger partner\'s row', () => {
    const gens = calculateGenerations(buildTree());
    assert.strictEqual(gens.gp1, 0);
    assert.strictEqual(gens.sib, 1);
    assert.strictEqual(gens.sibsp, 1);
    // uncle leaves his sibling's row and joins his niece's row
    assert.strictEqual(gens.niece, 2);
    assert.strictEqual(gens.uncle, 2);
    assert.strictEqual(gens.cousin, 2);
    // children sit on the row directly below
    assert.strictEqual(gens.baby, 3);
    assert.strictEqual(gens.kid, 3);
  });

  it('is stable when explicit generations are persisted on people', () => {
    const tree = buildTree();
    const gens = calculateGenerations(tree);
    for (const id of Object.keys(tree.people)) tree.people[id].generation = gens[id];
    assert.deepStrictEqual(calculateGenerations(tree), gens);
  });

  it('lays out the shared row in vertical, grouped and horizontal modes', () => {
    const tree = buildTree();
    for (const grouped of [false, true]) {
      const layout = computeLayout(tree, 'vertical', grouped);
      assert.strictEqual(layout.nodes.uncle.y, layout.nodes.niece.y);
      assert.strictEqual(layout.nodes.uncle.y, 2 * ROW);
      assert.strictEqual(layout.nodes.baby.y, 3 * ROW);
      assert.strictEqual(layout.nodes.sib.y, ROW);
    }
    const h = computeLayout(tree, 'horizontal');
    assert.strictEqual(h.nodes.uncle.x, h.nodes.niece.x);
    assert.ok(h.nodes.baby.x > h.nodes.uncle.x);
  });

  it('handles siblings recorded under a parent union without partners (user export)', () => {
    const p = (id: string, unionIds: string[], generation: number, parentUnionId?: string): Person => ({ id, firstName: id, unionIds, generation, parentUnionId });
    const tree: TreeData = {
      id: 'x', name: 'x', createdAt: '', updatedAt: '',
      people: {
        grootLea: p('grootLea', ['u1'], 0, 'uAna'),
        kleinLea: p('kleinLea', ['uKlein'], 1, 'u1'),
        james: p('james', ['uKlein'], 0),
        jurie: p('jurie', ['u2'], 0, 'uKoos'),
        jaco: p('jaco', ['uJaco'], 1, 'u2'),
        jj: p('jj', [], 2, 'uKlein'),
        charlene: p('charlene', ['uJaco'], 1, 'uKlein'),
        koos: p('koos', ['uKoos'], -1, 'uRoot'),
        ana: p('ana', ['uAna'], -1, 'uRoot'),
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['grootLea'], childrenIds: ['kleinLea'] },
        u2: { id: 'u2', partnerIds: ['jurie'], childrenIds: ['jaco'] },
        uKlein: { id: 'uKlein', partnerIds: ['james', 'kleinLea'], childrenIds: ['jj', 'charlene'] },
        uJaco: { id: 'uJaco', partnerIds: ['charlene', 'jaco'], childrenIds: [] },
        uKoos: { id: 'uKoos', partnerIds: ['koos'], childrenIds: ['jurie'] },
        uAna: { id: 'uAna', partnerIds: ['ana'], childrenIds: ['grootLea'] },
        uRoot: { id: 'uRoot', partnerIds: [], childrenIds: ['ana', 'koos'] },
      },
    };
    const gens = calculateGenerations(tree);
    const rows = [-1, 0, 1, 2].map((g) => Object.keys(gens).filter((id) => gens[id] === g).sort());
    assert.deepStrictEqual(rows, [
      ['ana', 'koos'],
      ['grootLea', 'jurie'],
      ['james', 'kleinLea'],
      ['charlene', 'jaco', 'jj'],
    ]);
  });

  it('keeps Ana/Koos and Groot Lea/Jurie level when the younger partner\'s mother is a divorced ex-wife (user export 2)', () => {
    const p = (id: string, unionIds: string[], generation: number, parentUnionId?: string): Person => ({ id, firstName: id, unionIds, generation, parentUnionId });
    const tree: TreeData = {
      id: 'x', name: 'x', createdAt: '', updatedAt: '',
      people: {
        grootLea: p('grootLea', ['u1'], 0, 'uAna'),
        kleinLea: p('kleinLea', ['uKlein'], 1, 'u1'),
        james: p('james', ['uKlein', 'uTania'], 0),
        jurie: p('jurie', ['u2'], 0, 'uKoos'),
        jaco: p('jaco', ['uJaco'], 1, 'u2'),
        jj: p('jj', [], 2, 'uKlein'),
        charlene: p('charlene', ['uJaco'], 1, 'uTania'),
        koos: p('koos', ['uKoos'], -1, 'uRoot'),
        ana: p('ana', ['uAna'], -1, 'uRoot'),
        tania: p('tania', ['uTania'], 0),
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['grootLea'], childrenIds: ['kleinLea'] },
        u2: { id: 'u2', partnerIds: ['jurie'], childrenIds: ['jaco'] },
        uKlein: { id: 'uKlein', partnerIds: ['james', 'kleinLea'], childrenIds: ['jj'] },
        uJaco: { id: 'uJaco', partnerIds: ['charlene', 'jaco'], childrenIds: [] },
        uKoos: { id: 'uKoos', partnerIds: ['koos'], childrenIds: ['jurie'] },
        uAna: { id: 'uAna', partnerIds: ['ana'], childrenIds: ['grootLea'] },
        uRoot: { id: 'uRoot', partnerIds: [], childrenIds: ['ana', 'koos'] },
        uTania: { id: 'uTania', partnerIds: ['james', 'tania'], childrenIds: ['charlene'], type: 'divorced' },
      },
    };
    const gens = calculateGenerations(tree);
    assert.strictEqual(gens.ana, gens.koos, 'Ana and Koos share a row');
    assert.strictEqual(gens.grootLea, gens.jurie, 'Groot Lea and Jurie share a row');
    assert.strictEqual(gens.jaco, gens.charlene, 'Jaco joins Charlene');
    assert.ok(gens.charlene > gens.james, 'Charlene is below her father James');
    assert.ok(gens.jaco > gens.jurie, 'Jaco is below his father Jurie');
    assert.strictEqual(gens.ana, -1);
    assert.strictEqual(gens.grootLea, 0);
    assert.strictEqual(gens.james, 1);
    assert.strictEqual(gens.jaco, 2);
  });

  it('moves siblings of the dropped partner (and their families) down with them (user export 3)', () => {
    const p = (id: string, unionIds: string[], generation: number, parentUnionId?: string): Person => ({ id, firstName: id, unionIds, generation, parentUnionId });
    const tree: TreeData = {
      id: 'x', name: 'x', createdAt: '', updatedAt: '',
      people: {
        grootLea: p('grootLea', ['u1'], 0, 'uAna'),
        kleinLea: p('kleinLea', ['uKlein'], 1, 'u1'),
        james: p('james', ['uKlein', 'uTania'], 0),
        jurie: p('jurie', ['u2'], 0, 'uKoos'),
        jaco: p('jaco', ['uJaco'], 1, 'u2'),
        jj: p('jj', [], 2, 'uKlein'),
        charlene: p('charlene', ['uJaco'], 1, 'uTania'),
        koos: p('koos', ['uKoos'], -1, 'uRoot'),
        ana: p('ana', ['uAna'], -1, 'uRoot'),
        tania: p('tania', ['uTania'], 0),
        eben: p('eben', [], 2, 'uJaco'),
        johan: p('johan', ['uJohan'], 1, 'u2'),
        daniela: p('daniela', ['uJohan'], 1),
        eliana: p('eliana', [], 2, 'uJohan'),
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['grootLea'], childrenIds: ['kleinLea'] },
        u2: { id: 'u2', partnerIds: ['jurie'], childrenIds: ['jaco', 'johan'] },
        uKlein: { id: 'uKlein', partnerIds: ['james', 'kleinLea'], childrenIds: ['jj'] },
        uJaco: { id: 'uJaco', partnerIds: ['charlene', 'jaco'], childrenIds: ['eben'] },
        uKoos: { id: 'uKoos', partnerIds: ['koos'], childrenIds: ['jurie'] },
        uAna: { id: 'uAna', partnerIds: ['ana'], childrenIds: ['grootLea'] },
        uRoot: { id: 'uRoot', partnerIds: [], childrenIds: ['ana', 'koos'] },
        uTania: { id: 'uTania', partnerIds: ['james', 'tania'], childrenIds: ['charlene'], type: 'divorced' },
        uJohan: { id: 'uJohan', partnerIds: ['johan', 'daniela'], childrenIds: ['eliana'] },
      },
    };
    const gens = calculateGenerations(tree);
    assert.strictEqual(gens.johan, gens.jaco, 'Johan is on Jaco\'s row');
    assert.strictEqual(gens.daniela, gens.johan, 'Daniela is level with her husband');
    assert.strictEqual(gens.eliana, gens.eben, 'Eliana is level with Eben');
    assert.ok(gens.eliana > gens.johan, 'Eliana is below her parents');
    assert.strictEqual(gens.ana, gens.koos);
    assert.strictEqual(gens.grootLea, gens.jurie);
    assert.strictEqual(gens.jaco, gens.charlene);
    assert.strictEqual(gens.jaco, 2);
    assert.strictEqual(gens.eben, 3);
  });

  it('moves cousins of the dropped partner down with them (user export 4)', () => {
    const p = (id: string, unionIds: string[], generation: number, parentUnionId?: string): Person => ({ id, firstName: id, unionIds, generation, parentUnionId });
    const tree: TreeData = {
      id: 'x', name: 'x', createdAt: '', updatedAt: '',
      people: {
        grootLea: p('grootLea', ['u1'], 0, 'uAna'),
        kleinLea: p('kleinLea', ['uKlein'], 1, 'u1'),
        james: p('james', ['uKlein', 'uTania'], 0),
        jurie: p('jurie', ['u2'], 0, 'uKoos'),
        anita: p('anita', ['uAnita'], 0, 'uKoos'),
        aileen: p('aileen', [], 1, 'uAnita'),
        jaco: p('jaco', ['uJaco'], 1, 'u2'),
        jj: p('jj', [], 2, 'uKlein'),
        charlene: p('charlene', ['uJaco'], 1, 'uTania'),
        koos: p('koos', ['uKoos'], -1, 'uRoot'),
        ana: p('ana', ['uAna'], -1, 'uRoot'),
        tania: p('tania', ['uTania'], 0),
        eben: p('eben', [], 2, 'uJaco'),
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['grootLea'], childrenIds: ['kleinLea'] },
        u2: { id: 'u2', partnerIds: ['jurie'], childrenIds: ['jaco'] },
        uAnita: { id: 'uAnita', partnerIds: ['anita'], childrenIds: ['aileen'] },
        uKlein: { id: 'uKlein', partnerIds: ['james', 'kleinLea'], childrenIds: ['jj'] },
        uJaco: { id: 'uJaco', partnerIds: ['charlene', 'jaco'], childrenIds: ['eben'] },
        uKoos: { id: 'uKoos', partnerIds: ['koos'], childrenIds: ['jurie', 'anita'] },
        uAna: { id: 'uAna', partnerIds: ['ana'], childrenIds: ['grootLea'] },
        uRoot: { id: 'uRoot', partnerIds: [], childrenIds: ['ana', 'koos'] },
        uTania: { id: 'uTania', partnerIds: ['james', 'tania'], childrenIds: ['charlene'], type: 'divorced' },
      },
    };
    const gens = calculateGenerations(tree);
    assert.strictEqual(gens.anita, gens.jurie, 'Anita stays level with her sibling Jurie');
    assert.strictEqual(gens.aileen, gens.jaco, 'Aileen (cousin) is on Jaco\'s row');
    assert.ok(gens.aileen > gens.anita, 'Aileen is below her parent');
    assert.strictEqual(gens.ana, gens.koos);
    assert.strictEqual(gens.grootLea, gens.jurie);
    assert.strictEqual(gens.jaco, 2);
    assert.strictEqual(gens.eben, 3);
  });

  it('moves step-cousins (child of a relative\'s spouse with an unlisted father) down too (user export 5)', () => {
    const p = (id: string, unionIds: string[], generation: number, parentUnionId?: string): Person => ({ id, firstName: id, unionIds, generation, parentUnionId });
    const tree: TreeData = {
      id: 'x', name: 'x', createdAt: '', updatedAt: '',
      people: {
        grootLea: p('grootLea', ['u1'], 0, 'uAna'),
        kleinLea: p('kleinLea', ['uKlein'], 1, 'u1'),
        james: p('james', ['uKlein', 'uTania'], 0),
        jurie: p('jurie', ['u2'], 0, 'uKoos'),
        kobus: p('kobus', ['uKobus'], 0, 'uKoos'),
        kathleen: p('kathleen', ['uKobus', 'uKathleen'], 0),
        klarien: p('klarien', [], 1, 'uKathleen'),
        jaco: p('jaco', ['uJaco'], 1, 'u2'),
        jj: p('jj', [], 2, 'uKlein'),
        charlene: p('charlene', ['uJaco'], 1, 'uTania'),
        koos: p('koos', ['uKoos'], -1, 'uRoot'),
        ana: p('ana', ['uAna'], -1, 'uRoot'),
        tania: p('tania', ['uTania'], 0),
        eben: p('eben', [], 2, 'uJaco'),
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['grootLea'], childrenIds: ['kleinLea'] },
        u2: { id: 'u2', partnerIds: ['jurie'], childrenIds: ['jaco'] },
        uKobus: { id: 'uKobus', partnerIds: ['kobus', 'kathleen'], childrenIds: [] },
        uKathleen: { id: 'uKathleen', partnerIds: ['kathleen'], childrenIds: ['klarien'] },
        uKlein: { id: 'uKlein', partnerIds: ['james', 'kleinLea'], childrenIds: ['jj'] },
        uJaco: { id: 'uJaco', partnerIds: ['charlene', 'jaco'], childrenIds: ['eben'] },
        uKoos: { id: 'uKoos', partnerIds: ['koos'], childrenIds: ['jurie', 'kobus'] },
        uAna: { id: 'uAna', partnerIds: ['ana'], childrenIds: ['grootLea'] },
        uRoot: { id: 'uRoot', partnerIds: [], childrenIds: ['ana', 'koos'] },
        uTania: { id: 'uTania', partnerIds: ['james', 'tania'], childrenIds: ['charlene'], type: 'divorced' },
      },
    };
    const gens = calculateGenerations(tree);
    assert.strictEqual(gens.kobus, gens.jurie, 'Kobus stays level with Jurie');
    assert.strictEqual(gens.kathleen, gens.kobus, 'Kathleen stays level with her husband');
    assert.strictEqual(gens.klarien, gens.jaco, 'Klarien is on Jaco\'s row');
    assert.ok(gens.klarien > gens.kathleen, 'Klarien is below her mother');
    assert.strictEqual(gens.jaco, 2);
  });

  it('keeps the shared ancestor\'s other line above the couple when a common father is recorded (user export 6)', () => {
    for (const johannesGen of [-2, undefined]) {
      const p = (id: string, unionIds: string[], generation: number | undefined, parentUnionId?: string): Person => ({ id, firstName: id, unionIds, generation, parentUnionId });
      const tree: TreeData = {
        id: 'x', name: 'x', createdAt: '', updatedAt: '',
        people: {
          grootLea: p('grootLea', ['u1'], johannesGen === undefined ? undefined : 0, 'uAna'),
          kleinLea: p('kleinLea', ['uKlein'], johannesGen === undefined ? undefined : 1, 'u1'),
          james: p('james', ['uKlein', 'uTania'], johannesGen === undefined ? undefined : 0),
          jurie: p('jurie', ['u2'], johannesGen === undefined ? undefined : 0, 'uKoos'),
          jaco: p('jaco', ['uJaco'], johannesGen === undefined ? undefined : 1, 'u2'),
          jj: p('jj', [], undefined, 'uKlein'),
          charlene: p('charlene', ['uJaco'], undefined, 'uTania'),
          koos: p('koos', ['uKoos'], johannesGen === undefined ? undefined : -1, 'uRoot'),
          ana: p('ana', ['uAna'], johannesGen === undefined ? undefined : -1, 'uRoot'),
          tania: p('tania', ['uTania'], undefined),
          eben: p('eben', [], undefined, 'uJaco'),
          johannes: p('johannes', ['uRoot'], johannesGen),
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['grootLea'], childrenIds: ['kleinLea'] },
          u2: { id: 'u2', partnerIds: ['jurie'], childrenIds: ['jaco'] },
          uKlein: { id: 'uKlein', partnerIds: ['james', 'kleinLea'], childrenIds: ['jj'] },
          uJaco: { id: 'uJaco', partnerIds: ['charlene', 'jaco'], childrenIds: ['eben'] },
          uKoos: { id: 'uKoos', partnerIds: ['koos'], childrenIds: ['jurie'] },
          uAna: { id: 'uAna', partnerIds: ['ana'], childrenIds: ['grootLea'] },
          uRoot: { id: 'uRoot', partnerIds: ['johannes'], childrenIds: ['ana', 'koos'] },
          uTania: { id: 'uTania', partnerIds: ['james', 'tania'], childrenIds: ['charlene'], type: 'divorced' },
        },
      };
      const g = calculateGenerations(tree);
      const base = g.johannes;
      assert.strictEqual(g.ana, base + 1);
      assert.strictEqual(g.koos, base + 1);
      assert.strictEqual(g.grootLea, base + 2);
      assert.strictEqual(g.jurie, base + 2);
      assert.strictEqual(g.kleinLea, base + 3, 'Klein Lea stays on the row above the couple');
      assert.strictEqual(g.james, base + 3);
      assert.strictEqual(g.jaco, base + 4);
      assert.strictEqual(g.charlene, base + 4);
      assert.strictEqual(g.jj, base + 4);
      assert.strictEqual(g.eben, base + 5);
    }
  });
});