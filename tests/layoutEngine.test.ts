import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateGenerations,
  computeLayout,
  detectFamilyGroups,
  CARD_WIDTH,
  HORIZONTAL_SPACING,
} from '../src/services/layoutEngine.ts';
import {
  addChildToPerson,
  addSiblingToPerson,
  addParentToPerson,
  clearManualPositions,
} from '../src/services/treeOperations.ts';
import { createDoubleInLawPreset, createThreeGenSampleTree, createDivorceBlendedPreset, createBlankTree } from '../src/services/storage.ts';
import type { TreeData } from '../src/types/tree.ts';

export const userExportedTree: TreeData = {
  id: 'tree_double_in_law',
  name: 'My Family Tree',
  description: 'Two brothers marrying two sisters. Their children are double first cousins who share both sets of grandparents.',
  createdAt: '2026-09-07T09:00:08.904Z',
  updatedAt: '2026-09-07T11:57:47.631Z',
  people: {
    gf_smith: {
      id: 'gf_smith',
      firstName: 'Johannes',
      lastName: 'Brits',
      gender: 'male',
      birthDate: '1989-12-15',
      birthPlace: 'Alberton, Gauteng',
      isDeceased: false,
      notes: 'Paternal Grandfather',
      unionIds: ['u_vsqeh4s_mtr54x5u'],
      parentUnionId: 'u_parents_z6qi9yz_mtr0j5ba'
    },
    parent_5cv7tb4_mtr0j5ba: {
      id: 'parent_5cv7tb4_mtr0j5ba',
      firstName: 'Jurie',
      lastName: 'Brits',
      gender: 'unspecified',
      unionIds: ['u_parents_z6qi9yz_mtr0j5ba'],
      parentUnionId: 'u_parents_k8agv8s_mtr0p23l'
    },
    child_xseaxab_mtr0n7zw: {
      id: 'child_xseaxab_mtr0n7zw',
      firstName: 'Jacobus',
      lastName: 'Brits',
      gender: 'unspecified',
      unionIds: ['u_z4fot5p_mtr55zs3'],
      parentUnionId: 'u_parents_z6qi9yz_mtr0j5ba'
    },
    child_m6okaw7_mtr0nf0t: {
      id: 'child_m6okaw7_mtr0nf0t',
      firstName: 'Carlynne',
      lastName: 'Viljoen',
      gender: 'female',
      unionIds: ['u_pve85zj_mtr58rpz'],
      parentUnionId: 'u_parents_z6qi9yz_mtr0j5ba',
      maidenName: 'Brits'
    },
    parent_reqwnvg_mtr17ezd: {
      id: 'parent_reqwnvg_mtr17ezd',
      firstName: 'Riana',
      lastName: 'Brits',
      gender: 'female',
      unionIds: ['u_parents_z6qi9yz_mtr0j5ba'],
      maidenName: 'Du Plessis',
      parentUnionId: 'u_parents_baep1oe_mtr18zda'
    },
    parent_9lmvc3d_mtr18zda: {
      id: 'parent_9lmvc3d_mtr18zda',
      firstName: 'Johannes',
      lastName: 'Du Plessis',
      gender: 'male',
      unionIds: ['u_parents_baep1oe_mtr18zda'],
      isDeceased: true
    },
    sibling_m9lio21_mtr18zda: {
      id: 'sibling_m9lio21_mtr18zda',
      firstName: 'Marinda',
      lastName: 'Bezuidenhout',
      gender: 'female',
      unionIds: ['u_1bnka5g_mtr1bbpq', 'u_6i7fwzu_mtr1jngz'],
      parentUnionId: 'u_parents_baep1oe_mtr18zda',
      maidenName: 'Du Plessis'
    },
    sibling_ycmvgyu_mtr1a27c: {
      id: 'sibling_ycmvgyu_mtr1a27c',
      firstName: 'Gerhard',
      lastName: 'Brits',
      gender: 'unspecified',
      unionIds: ['u_1bnka5g_mtr1bbpq', 'u_fgdy4ea_mtr4o8ld'],
      parentUnionId: 'u_parents_k8agv8s_mtr0p23l'
    },
    partner_iv13dvu_mtr1ezve: {
      id: 'partner_iv13dvu_mtr1ezve',
      firstName: 'Wilhelmina',
      lastName: 'Du Plessis',
      gender: 'female',
      unionIds: ['u_parents_baep1oe_mtr18zda'],
      maidenName: 'Bril',
      isDeceased: true
    },
    child_j2jnd61_mtr1j4jf: {
      id: 'child_j2jnd61_mtr1j4jf',
      firstName: 'Victoria',
      lastName: 'Labuschagne',
      gender: 'female',
      unionIds: [],
      parentUnionId: 'u_1bnka5g_mtr1bbpq',
      maidenName: 'Brits'
    },
    partner_oy0pagc_mtr1jngz: {
      id: 'partner_oy0pagc_mtr1jngz',
      firstName: 'Johan',
      lastName: 'Bezuidenhout',
      gender: 'male',
      unionIds: ['u_6i7fwzu_mtr1jngz']
    },
    child_7c8w2h1_mtr2hjhq: {
      id: 'child_7c8w2h1_mtr2hjhq',
      firstName: 'Laurika',
      lastName: 'Bezuidenhout',
      gender: 'female',
      unionIds: [],
      parentUnionId: 'u_6i7fwzu_mtr1jngz'
    },
    partner_ygutefw_mtr4o8ld: {
      id: 'partner_ygutefw_mtr4o8ld',
      firstName: 'Yolandi',
      lastName: 'Brits',
      gender: 'female',
      unionIds: ['u_fgdy4ea_mtr4o8ld'],
      maidenName: 'Fortein'
    },
    child_37zqkk2_mtr4oumi: {
      id: 'child_37zqkk2_mtr4oumi',
      firstName: 'Lilly',
      lastName: 'Brits',
      gender: 'female',
      unionIds: [],
      parentUnionId: 'u_fgdy4ea_mtr4o8ld'
    },
    sibling_d8fieer_mtr4r73p: {
      id: 'sibling_d8fieer_mtr4r73p',
      firstName: 'Wilhelm',
      lastName: 'Du Plessis',
      gender: 'male',
      unionIds: ['u_p3qmcfw_mtr4va8z'],
      parentUnionId: 'u_parents_baep1oe_mtr18zda'
    },
    parent_qidblla_mtr4rx3q: {
      id: 'parent_qidblla_mtr4rx3q',
      firstName: 'Maria',
      lastName: 'Brits',
      gender: 'female',
      unionIds: ['u_parents_k8agv8s_mtr0p23l'],
      maidenName: 'Pretorius',
      isDeceased: true
    },
    parent_zflnh9n_mtr4sjnq: {
      id: 'parent_zflnh9n_mtr4sjnq',
      firstName: 'Jacobus',
      lastName: 'Brits',
      gender: 'male',
      unionIds: ['u_parents_k8agv8s_mtr0p23l'],
      isDeceased: true
    },
    partner_wrt2uud_mtr4va8z: {
      id: 'partner_wrt2uud_mtr4va8z',
      firstName: 'Kiewiet',
      lastName: 'Du Plessis',
      gender: 'female',
      unionIds: ['u_p3qmcfw_mtr4va8z']
    },
    child_1fatl24_mtr4vrad: {
      id: 'child_1fatl24_mtr4vrad',
      firstName: 'Adriaan',
      lastName: 'Du Plessis',
      gender: 'male',
      unionIds: [],
      parentUnionId: 'u_p3qmcfw_mtr4va8z'
    },
    child_gtf0iqc_mtr4w3ek: {
      id: 'child_gtf0iqc_mtr4w3ek',
      firstName: 'Charma',
      lastName: 'Du Plessis',
      gender: 'female',
      unionIds: [],
      parentUnionId: 'u_p3qmcfw_mtr4va8z'
    },
    child_76ta7uu_mtr4x0dy: {
      id: 'child_76ta7uu_mtr4x0dy',
      firstName: 'Jacobus',
      lastName: 'Brits',
      gender: 'male',
      unionIds: [],
      parentUnionId: 'u_parents_k8agv8s_mtr0p23l'
    },
    child_8gqebc4_mtr4xq0u: {
      id: 'child_8gqebc4_mtr4xq0u',
      firstName: 'Anita',
      lastName: 'Botha',
      gender: 'female',
      unionIds: ['u_hpvoev3_mtr4yw61'],
      parentUnionId: 'u_parents_k8agv8s_mtr0p23l',
      maidenName: 'Brits'
    },
    child_1nnfbpj_mtr4y3nj: {
      id: 'child_1nnfbpj_mtr4y3nj',
      firstName: 'Marietjie',
      lastName: 'Tame',
      gender: 'female',
      unionIds: ['u_uciohb9_mtr50t10'],
      parentUnionId: 'u_parents_k8agv8s_mtr0p23l',
      maidenName: 'Brits'
    },
    partner_oq2wpn1_mtr4yw61: {
      id: 'partner_oq2wpn1_mtr4yw61',
      firstName: 'Frederik',
      lastName: 'Botha',
      gender: 'male',
      unionIds: ['u_hpvoev3_mtr4yw61']
    },
    child_28ez8pd_mtr4zbs1: {
      id: 'child_28ez8pd_mtr4zbs1',
      firstName: 'Marelize',
      lastName: '',
      gender: 'female',
      unionIds: [],
      parentUnionId: 'u_hpvoev3_mtr4yw61',
      maidenName: 'Botha'
    },
    child_ir1xn85_mtr4zsoq: {
      id: 'child_ir1xn85_mtr4zsoq',
      firstName: 'Francios',
      lastName: 'Botha',
      gender: 'male',
      unionIds: [],
      parentUnionId: 'u_hpvoev3_mtr4yw61'
    },
    child_a1zs8ba_mtr503ne: {
      id: 'child_a1zs8ba_mtr503ne',
      firstName: 'Aileen',
      lastName: '',
      gender: 'female',
      unionIds: [],
      parentUnionId: 'u_hpvoev3_mtr4yw61',
      maidenName: 'Botha'
    },
    partner_p4nhooo_mtr50t10: {
      id: 'partner_p4nhooo_mtr50t10',
      firstName: 'Michael',
      lastName: 'Tame',
      gender: 'male',
      unionIds: ['u_uciohb9_mtr50t10']
    },
    child_bugbyfh_mtr51bng: {
      id: 'child_bugbyfh_mtr51bng',
      firstName: 'Catherine',
      lastName: 'Robins',
      gender: 'female',
      unionIds: [],
      parentUnionId: 'u_uciohb9_mtr50t10',
      maidenName: 'Tame'
    },
    child_vkoq2oh_mtr51qi4: {
      id: 'child_vkoq2oh_mtr51qi4',
      firstName: 'Samantha',
      lastName: 'Whitaker',
      gender: 'female',
      unionIds: [],
      parentUnionId: 'u_uciohb9_mtr50t10',
      maidenName: 'Tame'
    },
    partner_rgs372f_mtr54x5u: {
      id: 'partner_rgs372f_mtr54x5u',
      firstName: 'Daniela',
      lastName: 'Brits',
      gender: 'female',
      unionIds: ['u_vsqeh4s_mtr54x5u'],
      maidenName: 'Roque',
      parentUnionId: 'u_parents_trh31s3_mtr5gjgr',
      x: -1930,
      y: 508
    },
    child_lqmcfca_mtr55fnn: {
      id: 'child_lqmcfca_mtr55fnn',
      firstName: 'Eliana',
      lastName: 'Brits',
      gender: 'female',
      unionIds: [],
      parentUnionId: 'u_vsqeh4s_mtr54x5u'
    },
    partner_rcnjzl0_mtr55zs3: {
      id: 'partner_rcnjzl0_mtr55zs3',
      firstName: 'Charlene',
      lastName: 'Brits',
      gender: 'female',
      unionIds: ['u_z4fot5p_mtr55zs3'],
      maidenName: 'Reinders'
    },
    child_jwim2lb_mtr56hf0: {
      id: 'child_jwim2lb_mtr56hf0',
      firstName: 'Eben',
      lastName: 'Brits',
      gender: 'male',
      unionIds: [],
      parentUnionId: 'u_z4fot5p_mtr55zs3'
    },
    child_c96jzjs_mtr56so5: {
      id: 'child_c96jzjs_mtr56so5',
      firstName: 'Isabel',
      lastName: 'Brits',
      gender: 'female',
      unionIds: [],
      parentUnionId: 'u_z4fot5p_mtr55zs3'
    },
    partner_kj5pn7f_mtr58rpz: {
      id: 'partner_kj5pn7f_mtr58rpz',
      firstName: 'Deon',
      lastName: 'Viljoen',
      gender: 'male',
      unionIds: ['u_pve85zj_mtr58rpz']
    },
    child_vik2rpz_mtr599fs: {
      id: 'child_vik2rpz_mtr599fs',
      firstName: 'Jayden',
      lastName: 'Viljoen',
      gender: 'male',
      unionIds: [],
      parentUnionId: 'u_pve85zj_mtr58rpz'
    },
    child_7s0luu5_mtr59gpk: {
      id: 'child_7s0luu5_mtr59gpk',
      firstName: 'Divan',
      lastName: 'Viljoen',
      gender: 'male',
      unionIds: [],
      parentUnionId: 'u_pve85zj_mtr58rpz'
    },
    child_5sofsag_mtr59pu1: {
      id: 'child_5sofsag_mtr59pu1',
      firstName: 'Mickayla',
      lastName: 'Viljoen',
      gender: 'female',
      unionIds: [],
      parentUnionId: 'u_pve85zj_mtr58rpz'
    },
    child_kiau6xz_mtr5oi0f: {
      id: 'child_kiau6xz_mtr5oi0f',
      firstName: 'Johannes',
      lastName: 'Du Plessis',
      gender: 'male',
      unionIds: [],
      parentUnionId: 'u_parents_baep1oe_mtr18zda',
      isDeceased: true
    },
    parent_zyhkqxs_mtr6q5tr: {
      id: 'parent_zyhkqxs_mtr6q5tr',
      firstName: 'Ana',
      lastName: 'Roque',
      gender: 'female',
      unionIds: ['u_parents_trh31s3_mtr5gjgr'],
      maidenName: 'Sardinha'
    },
    partner_xz2luwt_mtr6qv8w: {
      id: 'partner_xz2luwt_mtr6qv8w',
      firstName: 'Antonio',
      lastName: 'Roque',
      gender: 'male',
      unionIds: ['u_parents_trh31s3_mtr5gjgr']
    }
  },
  unions: {
    u_parents_z6qi9yz_mtr0j5ba: {
      id: 'u_parents_z6qi9yz_mtr0j5ba',
      partnerIds: ['parent_5cv7tb4_mtr0j5ba', 'parent_reqwnvg_mtr17ezd'],
      childrenIds: ['gf_smith', 'child_xseaxab_mtr0n7zw', 'child_m6okaw7_mtr0nf0t'],
      type: 'married'
    },
    u_parents_k8agv8s_mtr0p23l: {
      id: 'u_parents_k8agv8s_mtr0p23l',
      partnerIds: ['parent_qidblla_mtr4rx3q', 'parent_zflnh9n_mtr4sjnq'],
      childrenIds: ['parent_5cv7tb4_mtr0j5ba', 'sibling_ycmvgyu_mtr1a27c', 'child_76ta7uu_mtr4x0dy', 'child_8gqebc4_mtr4xq0u', 'child_1nnfbpj_mtr4y3nj'],
      type: 'married'
    },
    u_parents_baep1oe_mtr18zda: {
      id: 'u_parents_baep1oe_mtr18zda',
      partnerIds: ['parent_9lmvc3d_mtr18zda', 'partner_iv13dvu_mtr1ezve'],
      childrenIds: ['parent_reqwnvg_mtr17ezd', 'sibling_m9lio21_mtr18zda', 'sibling_d8fieer_mtr4r73p', 'child_kiau6xz_mtr5oi0f'],
      type: 'married'
    },
    u_1bnka5g_mtr1bbpq: {
      id: 'u_1bnka5g_mtr1bbpq',
      partnerIds: ['sibling_ycmvgyu_mtr1a27c', 'sibling_m9lio21_mtr18zda'],
      childrenIds: ['child_j2jnd61_mtr1j4jf'],
      type: 'divorced'
    },
    u_6i7fwzu_mtr1jngz: {
      id: 'u_6i7fwzu_mtr1jngz',
      partnerIds: ['sibling_m9lio21_mtr18zda', 'partner_oy0pagc_mtr1jngz'],
      childrenIds: ['child_7c8w2h1_mtr2hjhq'],
      type: 'divorced'
    },
    u_fgdy4ea_mtr4o8ld: {
      id: 'u_fgdy4ea_mtr4o8ld',
      partnerIds: ['sibling_ycmvgyu_mtr1a27c', 'partner_ygutefw_mtr4o8ld'],
      childrenIds: ['child_37zqkk2_mtr4oumi'],
      type: 'married'
    },
    u_p3qmcfw_mtr4va8z: {
      id: 'u_p3qmcfw_mtr4va8z',
      partnerIds: ['sibling_d8fieer_mtr4r73p', 'partner_wrt2uud_mtr4va8z'],
      childrenIds: ['child_1fatl24_mtr4vrad', 'child_gtf0iqc_mtr4w3ek'],
      type: 'married'
    },
    u_hpvoev3_mtr4yw61: {
      id: 'u_hpvoev3_mtr4yw61',
      partnerIds: ['child_8gqebc4_mtr4xq0u', 'partner_oq2wpn1_mtr4yw61'],
      childrenIds: ['child_28ez8pd_mtr4zbs1', 'child_ir1xn85_mtr4zsoq', 'child_a1zs8ba_mtr503ne'],
      type: 'married'
    },
    u_uciohb9_mtr50t10: {
      id: 'u_uciohb9_mtr50t10',
      partnerIds: ['child_1nnfbpj_mtr4y3nj', 'partner_p4nhooo_mtr50t10'],
      childrenIds: ['child_bugbyfh_mtr51bng', 'child_vkoq2oh_mtr51qi4'],
      type: 'divorced'
    },
    u_vsqeh4s_mtr54x5u: {
      id: 'u_vsqeh4s_mtr54x5u',
      partnerIds: ['gf_smith', 'partner_rgs372f_mtr54x5u'],
      childrenIds: ['child_lqmcfca_mtr55fnn'],
      type: 'married'
    },
    u_z4fot5p_mtr55zs3: {
      id: 'u_z4fot5p_mtr55zs3',
      partnerIds: ['child_xseaxab_mtr0n7zw', 'partner_rcnjzl0_mtr55zs3'],
      childrenIds: ['child_jwim2lb_mtr56hf0', 'child_c96jzjs_mtr56so5'],
      type: 'married'
    },
    u_pve85zj_mtr58rpz: {
      id: 'u_pve85zj_mtr58rpz',
      partnerIds: ['child_m6okaw7_mtr0nf0t', 'partner_kj5pn7f_mtr58rpz'],
      childrenIds: ['child_vik2rpz_mtr599fs', 'child_7s0luu5_mtr59gpk', 'child_5sofsag_mtr59pu1'],
      type: 'divorced'
    },
    u_parents_trh31s3_mtr5gjgr: {
      id: 'u_parents_trh31s3_mtr5gjgr',
      partnerIds: ['parent_zyhkqxs_mtr6q5tr', 'partner_xz2luwt_mtr6qv8w'],
      childrenIds: ['partner_rgs372f_mtr54x5u'],
      type: 'married'
    }
  },
  rootPersonId: 'gf_smith'
};

describe('calculateGenerations', () => {
  it('correctly calculates generations for Double In-Law preset', () => {
    const tree = createDoubleInLawPreset();
    const gens = calculateGenerations(tree);
    assert.strictEqual(gens.gf_smith, 0);
    assert.strictEqual(gens.gm_smith, 0);
    assert.strictEqual(gens.gf_miller, 0);
    assert.strictEqual(gens.gm_miller, 0);
    assert.strictEqual(gens.dad, 1);
    assert.strictEqual(gens.uncle, 1);
    assert.strictEqual(gens.mom, 1);
    assert.strictEqual(gens.aunt, 1);
    assert.strictEqual(gens.me, 2);
    assert.strictEqual(gens.sibling_me, 2);
    assert.strictEqual(gens.double_cousin_1, 2);
    assert.strictEqual(gens.double_cousin_2, 2);
  });

  it('correctly calculates generations for Three Gen Sample preset', () => {
    const tree = createThreeGenSampleTree();
    const gens = calculateGenerations(tree);
    assert.strictEqual(gens.p1, 0);
    assert.strictEqual(gens.p2, 0);
    assert.strictEqual(gens.p3, 1);
    assert.strictEqual(gens.p5, 1);
    assert.strictEqual(gens.p7, 2);
    assert.strictEqual(gens.p9, 2);
    assert.strictEqual(gens.p10, 3);
    assert.strictEqual(gens.p11, 3);
  });

  it('correctly calculates generations for Divorce & Remarriage preset', () => {
    const tree = createDivorceBlendedPreset();
    const gens = calculateGenerations(tree);
    assert.strictEqual(gens.p_dan, 0);
    assert.strictEqual(gens.p_sarah, 0);
    assert.strictEqual(gens.p_lisa, 0);
    assert.strictEqual(gens.p_mark, 0);
    assert.strictEqual(gens.c_shared, 1);
    assert.strictEqual(gens.c_dan, 1);
    assert.strictEqual(gens.c_sarah, 1);
  });

  it('keeps Ana and Antonio on generation 1 in user exported tree', () => {
    const gens = calculateGenerations(userExportedTree);
    assert.strictEqual(gens['partner_rgs372f_mtr54x5u'], 2, 'Daniela should be gen 2');
    assert.strictEqual(gens['parent_zyhkqxs_mtr6q5tr'], 1, 'Ana should be gen 1');
    assert.strictEqual(gens['partner_xz2luwt_mtr6qv8w'], 1, 'Antonio should be gen 1');
  });

  it('keeps Ana and Antonio on generation 1 when adding a sibling to Daniela', () => {
    const { tree: treeWithSibling, newSiblingId } = addSiblingToPerson(userExportedTree, 'partner_rgs372f_mtr54x5u');
    const gens = calculateGenerations(treeWithSibling);
    assert.strictEqual(gens['partner_rgs372f_mtr54x5u'], 2, 'Daniela should be gen 2');
    assert.strictEqual(gens[newSiblingId], 2, 'New sibling should be gen 2');
    assert.strictEqual(gens['parent_zyhkqxs_mtr6q5tr'], 1, 'Ana should be gen 1 (not gen 0!)');
    assert.strictEqual(gens['partner_xz2luwt_mtr6qv8w'], 1, 'Antonio should be gen 1 (not gen 0!)');
  });

  it('keeps Ana and Antonio on generation 1 when adding a child to Ana', () => {
    const { tree: treeWithChild, newChildId } = addChildToPerson(userExportedTree, 'parent_zyhkqxs_mtr6q5tr');
    const gens = calculateGenerations(treeWithChild);
    assert.strictEqual(gens['partner_rgs372f_mtr54x5u'], 2, 'Daniela should be gen 2');
    assert.strictEqual(gens[newChildId], 2, 'New child should be gen 2');
    assert.strictEqual(gens['parent_zyhkqxs_mtr6q5tr'], 1, 'Ana should be gen 1 (not gen 0!)');
    assert.strictEqual(gens['partner_xz2luwt_mtr6qv8w'], 1, 'Antonio should be gen 1 (not gen 0!)');
  });

  it('keeps Ana and Antonio on generation 1 when adding a child to Antonio', () => {
    const { tree: treeWithChild, newChildId } = addChildToPerson(userExportedTree, 'partner_xz2luwt_mtr6qv8w');
    const gens = calculateGenerations(treeWithChild);
    assert.strictEqual(gens['partner_rgs372f_mtr54x5u'], 2, 'Daniela should be gen 2');
    assert.strictEqual(gens[newChildId], 2, 'New child should be gen 2');
    assert.strictEqual(gens['parent_zyhkqxs_mtr6q5tr'], 1, 'Ana should be gen 1 (not gen 0!)');
    assert.strictEqual(gens['partner_xz2luwt_mtr6qv8w'], 1, 'Antonio should be gen 1 (not gen 0!)');
  });

  it('handles multiple siblings correctly without changing parents generation', () => {
    const res1 = addSiblingToPerson(userExportedTree, 'partner_rgs372f_mtr54x5u');
    const res2 = addSiblingToPerson(res1.tree, 'partner_rgs372f_mtr54x5u');
    const gens = calculateGenerations(res2.tree);
    assert.strictEqual(gens['partner_rgs372f_mtr54x5u'], 2, 'Daniela should be gen 2');
    assert.strictEqual(gens[res1.newSiblingId], 2, 'Sibling 1 should be gen 2');
    assert.strictEqual(gens[res2.newSiblingId], 2, 'Sibling 2 should be gen 2');
    assert.strictEqual(gens['parent_zyhkqxs_mtr6q5tr'], 1, 'Ana should be gen 1');
    assert.strictEqual(gens['partner_xz2luwt_mtr6qv8w'], 1, 'Antonio should be gen 1');
  });

  it('places niece/nephew on generation 3 when sibling has a child', () => {
    const resSibling = addSiblingToPerson(userExportedTree, 'partner_rgs372f_mtr54x5u');
    const resChild = addChildToPerson(resSibling.tree, resSibling.newSiblingId);
    const gens = calculateGenerations(resChild.tree);
    assert.strictEqual(gens['partner_rgs372f_mtr54x5u'], 2, 'Daniela should be gen 2');
    assert.strictEqual(gens[resSibling.newSiblingId], 2, 'Sibling should be gen 2');
    assert.strictEqual(gens[resChild.newChildId], 3, 'Child of sibling should be gen 3');
    assert.strictEqual(gens['parent_zyhkqxs_mtr6q5tr'], 1, 'Ana should be gen 1');
    assert.strictEqual(gens['partner_xz2luwt_mtr6qv8w'], 1, 'Antonio should be gen 1');
  });

  it('does not shift children down when adding a parent to top level ancestor in userExportedTree', () => {
    const mariaId = 'parent_qidblla_mtr4rx3q';
    const origGens = calculateGenerations(userExportedTree);
    assert.strictEqual(origGens[mariaId], 0, 'Maria should initially be gen 0');
    assert.strictEqual(origGens['parent_5cv7tb4_mtr0j5ba'], 1, 'Jurie should initially be gen 1');
    assert.strictEqual(origGens['gf_smith'], 2, 'Johannes should initially be gen 2');
    assert.strictEqual(origGens['child_lqmcfca_mtr55fnn'], 3, 'Eliana should initially be gen 3');

    const { tree: nextTree, newParentId } = addParentToPerson(userExportedTree, mariaId);
    const newGens = calculateGenerations(nextTree);

    assert.strictEqual(newGens[newParentId], -1, 'New parent should be placed at generation -1');
    assert.strictEqual(newGens[mariaId], 0, 'Maria should remain at generation 0');
    assert.strictEqual(newGens['parent_5cv7tb4_mtr0j5ba'], 1, 'Jurie (Maria child) must NOT shift down');
    assert.strictEqual(newGens['sibling_ycmvgyu_mtr1a27c'], 1, 'Gerhard (Maria child) must NOT shift down');
    assert.strictEqual(newGens['child_76ta7uu_mtr4x0dy'], 1, 'Jacobus (Maria child) must NOT shift down');
    assert.strictEqual(newGens['child_8gqebc4_mtr4xq0u'], 1, 'Anita (Maria child) must NOT shift down');
    assert.strictEqual(newGens['child_1nnfbpj_mtr4y3nj'], 1, 'Marietjie (Maria child) must NOT shift down');
    assert.strictEqual(newGens['gf_smith'], 2, 'Johannes (grandchild) must remain at generation 2');
    assert.strictEqual(newGens['child_lqmcfca_mtr55fnn'], 3, 'Eliana (great-grandchild) must remain at generation 3');
  });

  it('does not shift children down when adding a parent in a simple root-and-children tree', () => {
    const tree = createBlankTree();
    const rootId = tree.rootPersonId!;
    const { tree: t1, newChildId: c1 } = addChildToPerson(tree, rootId);
    const { tree: t2, newChildId: c2 } = addChildToPerson(t1, rootId);

    const gensBefore = calculateGenerations(t2);
    assert.strictEqual(gensBefore[rootId], 0, 'Root should be gen 0');
    assert.strictEqual(gensBefore[c1], 1, 'Child 1 should be gen 1');
    assert.strictEqual(gensBefore[c2], 1, 'Child 2 should be gen 1');

    const { tree: t3, newParentId: p1 } = addParentToPerson(t2, rootId);
    const gensAfter = calculateGenerations(t3);

    assert.strictEqual(gensAfter[p1], -1, 'New parent should be gen -1');
    assert.strictEqual(gensAfter[rootId], 0, 'Root should stay gen 0');
    assert.strictEqual(gensAfter[c1], 1, 'Child 1 must remain gen 1 (no shift)');
    assert.strictEqual(gensAfter[c2], 1, 'Child 2 must remain gen 1 (no shift)');

    // Add another ancestor above p1 (cascading upward to -2)
    const { tree: t4, newParentId: p2 } = addParentToPerson(t3, p1);
    const gensAfter2 = calculateGenerations(t4);
    assert.strictEqual(gensAfter2[p2], -2, 'New grandparent should be gen -2');
    assert.strictEqual(gensAfter2[p1], -1, 'Parent should stay gen -1');
    assert.strictEqual(gensAfter2[rootId], 0, 'Root should stay gen 0');
    assert.strictEqual(gensAfter2[c1], 1, 'Child 1 must remain gen 1');
    assert.strictEqual(gensAfter2[c2], 1, 'Child 2 must remain gen 1');
  });

  it('computes correct negative Y layout coordinates and bounds for upward ancestors', () => {
    const tree = createBlankTree();
    const rootId = tree.rootPersonId!;
    const { tree: t1, newChildId: c1 } = addChildToPerson(tree, rootId);
    const { tree: t2, newParentId: p1 } = addParentToPerson(t1, rootId);

    const layout = computeLayout(t2, 'vertical');
    assert.strictEqual(layout.nodes[p1].generation, -1);
    assert.strictEqual(layout.nodes[rootId].generation, 0);
    assert.strictEqual(layout.nodes[c1].generation, 1);

    // Vertical spacing: level * 254
    assert.strictEqual(layout.nodes[p1].y, -254, 'Parent card should be at Y = -254');
    assert.strictEqual(layout.nodes[rootId].y, 0, 'Root card should be at Y = 0');
    assert.strictEqual(layout.nodes[c1].y, 254, 'Child card should be at Y = 254');

    assert.ok(layout.bounds.minY <= -254, 'Bounds minY must encompass negative Y coordinates');
  });
});

describe('computeLayout with LayoutStyles', () => {
  it('defaults to vertical layout with generations advancing on Y axis', () => {
    const tree = createThreeGenSampleTree();
    const layout = computeLayout(tree);
    // In vertical layout, parents (p1, p2) at gen 0 have lower Y than children (p3, p4) at gen 1
    const p1 = layout.nodes.p1;
    const p3 = layout.nodes.p3;
    const p7 = layout.nodes.p7;
    const p10 = layout.nodes.p10;

    assert(p1 && p3 && p7 && p10);
    assert(p3.y > p1.y, 'Gen 1 Y should be greater than Gen 0 Y in vertical layout');
    assert(p7.y > p3.y, 'Gen 2 Y should be greater than Gen 1 Y in vertical layout');
    assert(p10.y > p7.y, 'Gen 3 Y should be greater than Gen 2 Y in vertical layout');
  });

  it('explicit vertical layout matches default computeLayout', () => {
    const tree = createDoubleInLawPreset();
    const defaultLayout = computeLayout(tree);
    const verticalLayout = computeLayout(tree, 'vertical');

    assert.strictEqual(Object.keys(defaultLayout.nodes).length, Object.keys(verticalLayout.nodes).length);
    for (const id of Object.keys(defaultLayout.nodes)) {
      assert.strictEqual(defaultLayout.nodes[id].x, verticalLayout.nodes[id].x);
      assert.strictEqual(defaultLayout.nodes[id].y, verticalLayout.nodes[id].y);
    }
  });

  it('computes horizontal layout with generations advancing on X axis', () => {
    const tree = createThreeGenSampleTree();
    const hLayout = computeLayout(tree, 'horizontal');

    const p1 = hLayout.nodes.p1; // Gen 0
    const p3 = hLayout.nodes.p3; // Gen 1
    const p7 = hLayout.nodes.p7; // Gen 2
    const p10 = hLayout.nodes.p10; // Gen 3

    assert(p1 && p3 && p7 && p10);
    assert(p3.x > p1.x, 'Gen 1 X should be greater than Gen 0 X in horizontal layout');
    assert(p7.x > p3.x, 'Gen 2 X should be greater than Gen 1 X in horizontal layout');
    assert(p10.x > p7.x, 'Gen 3 X should be greater than Gen 2 X in horizontal layout');

    // Partners in the same union should share the same generation column (same X)
    const p2 = hLayout.nodes.p2; // p1's partner
    assert.strictEqual(p1.x, p2.x, 'Partners p1 and p2 should be in the same X column');

    // Union node u1 should sit to the right of parents
    const u1 = hLayout.unions.u1;
    assert(u1, 'Union u1 should exist');
    assert(u1.x > p1.x, 'Union u1 X should be to the right of parents');

    // Children (p3, p4) should sit to the right of union u1
    assert(p3.x > u1.x, 'Child p3 X should be to the right of union u1');
  });

  it('generates proper horizontal edges with bus bars and stems', () => {
    const tree = createDoubleInLawPreset();
    const hLayout = computeLayout(tree, 'horizontal');

    assert(hLayout.edges.length > 0, 'Horizontal layout should generate edges');

    // Verify union stem edge travels horizontally
    const stemEdge = hLayout.edges.find((e) => e.id.startsWith('edge_stem_'));
    assert(stemEdge, 'Should have at least one stem edge');
    // Path should look like M ux uy L busX uy (y stays constant!)
    const stemCoords = stemEdge.pathD.match(/M\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+L\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/);
    assert(stemCoords, 'Stem path should match M x1 y1 L x2 y2 format');
    const [, , y1, , y2] = stemCoords;
    assert.strictEqual(y1, y2, 'Stem edge should be strictly horizontal (same Y)');

    // Verify bus edge travels vertically at busX
    const busEdge = hLayout.edges.find((e) => e.id.startsWith('edge_bus_'));
    assert(busEdge, 'Should have bus edge');
    const busCoords = busEdge.pathD.match(/M\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+L\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/);
    assert(busCoords, 'Bus path should match M x1 y1 L x2 y2 format');
    const [, bx1, , bx2] = busCoords;
    assert.strictEqual(bx1, bx2, 'Bus bar edge should be strictly vertical (same X)');
  });

  it('respects horizontal manual position overrides without affecting vertical positions', () => {
    const tree = createDoubleInLawPreset();
    tree.horizontalOverrides = {
      me: { x: 1234, y: 5678 },
    };

    const vLayout = computeLayout(tree, 'vertical');
    const hLayout = computeLayout(tree, 'horizontal');

    // Vertical layout should NOT use horizontalOverrides
    assert.notStrictEqual(vLayout.nodes.me.x, 1234);
    assert.notStrictEqual(vLayout.nodes.me.y, 5678);

    // Horizontal layout SHOULD use horizontalOverrides
    assert.strictEqual(hLayout.nodes.me.x, 1234);
    assert.strictEqual(hLayout.nodes.me.y, 5678);

    // Explicit layoutOverrides parameter is respected
    const overrideLayout = computeLayout(tree, 'vertical', false, undefined, true, { me: { x: 999, y: 888 } });
    assert.strictEqual(overrideLayout.nodes.me.x, 999);
    assert.strictEqual(overrideLayout.nodes.me.y, 888);
  });

  it('correctly layouts Divorce & Remarriage preset in horizontal mode', () => {
    const tree = createDivorceBlendedPreset();
    const hLayout = computeLayout(tree, 'horizontal');

    assert.strictEqual(Object.keys(hLayout.nodes).length, Object.keys(tree.people).length);
    assert.strictEqual(Object.keys(hLayout.unions).length, Object.keys(tree.unions).length);
    assert(hLayout.bounds.width > 0 && hLayout.bounds.height > 0);
  });
});

describe('detectFamilyGroups and groupByFamily', () => {
  it('detects two primary family branches for user tree (Brits and Roque)', () => {
    const { familyGroups } = detectFamilyGroups(userExportedTree);
    assert.strictEqual(familyGroups.length, 2, 'Should detect 2 primary family groups');

    // Check names
    const names = familyGroups.map((g) => g.name);
    assert(names.includes('Brits Family'), 'Should detect Brits Family');
    assert(names.includes('Roque Family'), 'Should detect Roque Family');

    // Johannes Brits should be in Brits family
    const britsGroup = familyGroups.find((g) => g.name === 'Brits Family')!;
    assert(britsGroup.memberIds.includes('gf_smith'), 'Johannes Brits should be in Brits Family');

    // Daniela Roque should be in Roque family
    const roqueGroup = familyGroups.find((g) => g.name === 'Roque Family')!;
    assert(roqueGroup.memberIds.includes('partner_rgs372f_mtr54x5u'), 'Daniela Roque should be in Roque Family');
  });

  it('applies extra separation gap between family groups in vertical layout', () => {
    const normalLayout = computeLayout(userExportedTree, 'vertical', false);
    const groupedLayout = computeLayout(userExportedTree, 'vertical', true);

    assert(groupedLayout.familyGroups, 'Grouped layout should return familyGroups');
    assert.strictEqual(groupedLayout.familyGroups?.length, 2);

    // Grouped layout should be wider due to FAMILY_GROUP_GAP
    assert(
      groupedLayout.bounds.width > normalLayout.bounds.width,
      `Grouped width (${groupedLayout.bounds.width}) should be larger than normal width (${normalLayout.bounds.width})`
    );

    // Both family groups should have valid bounding boxes
    for (const fg of groupedLayout.familyGroups!) {
      assert(fg.bounds, 'Each family group should have bounds');
      assert(fg.bounds.width > 0 && fg.bounds.height > 0);
    }
  });

  it('applies extra separation gap between family groups in horizontal layout', () => {
    const normalHLayout = computeLayout(userExportedTree, 'horizontal', false);
    const groupedHLayout = computeLayout(userExportedTree, 'horizontal', true);

    assert(groupedHLayout.familyGroups, 'Grouped horizontal layout should return familyGroups');
    assert.strictEqual(groupedHLayout.familyGroups?.length, 2);

    // Grouped horizontal layout should be taller due to FAMILY_GROUP_GAP_H
    assert(
      groupedHLayout.bounds.height > normalHLayout.bounds.height,
      `Grouped height (${groupedHLayout.bounds.height}) should be larger than normal height (${normalHLayout.bounds.height})`
    );
  });

  it('dynamically assigns newly added children or parents to their proper family group', () => {
    // Add child to Johannes Brits
    const addedChild = addChildToPerson(userExportedTree, 'gf_smith');
    const { familyGroups } = detectFamilyGroups(addedChild.tree);
    const britsGroup = familyGroups.find((g) => g.name === 'Brits Family')!;
    const roqueGroup = familyGroups.find((g) => g.name === 'Roque Family')!;

    // Child should belong to the tree and be in Brits Family
    const newChildId = addedChild.newChildId;
    const isMember = britsGroup.memberIds.includes(newChildId) || roqueGroup.memberIds.includes(newChildId);
    assert(isMember, 'Newly added child should be dynamically classified into a family group');
  });
});

describe('multi-lane bus routing and line clarity', () => {
  it('staggers busY coordinates for sibling/adjacent unions at the same generation level', () => {
    const layout = computeLayout(userExportedTree, 'vertical');

    const u1 = layout.unions['u_parents_z6qi9yz_mtr0j5ba'];
    const u2 = layout.unions['u_1bnka5g_mtr1bbpq'];
    const u3 = layout.unions['u_6i7fwzu_mtr1jngz'];

    assert(u1 && u2 && u3, 'All three unions with children must exist');
    assert(u1.busCoord !== undefined, 'u1 should have busCoord');
    assert(u2.busCoord !== undefined, 'u2 should have busCoord');
    assert(u3.busCoord !== undefined, 'u3 should have busCoord');

    // Adjacent unions u1 and u2 must not share the exact same busY coordinate
    assert.notStrictEqual(
      u1.busCoord,
      u2.busCoord,
      `Adjacent unions u1 (${u1.busCoord}) and u2 (${u2.busCoord}) must have staggered busY coordinates to prevent overlapping rail effect`
    );

    // Adjacent unions u2 and u3 must also not share the exact same busY coordinate
    assert.notStrictEqual(
      u2.busCoord,
      u3.busCoord,
      `Adjacent unions u2 (${u2.busCoord}) and u3 (${u3.busCoord}) must have staggered busY coordinates`
    );

    // Verify the actual edge bus bars have matching staggered Y coordinates
    const busEdge1 = layout.edges.find((e) => e.id === `edge_bus_${u1.id}`);
    const busEdge2 = layout.edges.find((e) => e.id === `edge_bus_${u2.id}`);
    assert(busEdge1 && busEdge2);

    const busY1 = Number(busEdge1.pathD.split(' ')[2]);
    const busY2 = Number(busEdge2.pathD.split(' ')[2]);
    assert.notStrictEqual(busY1, busY2, 'Bus bar edge Y coordinates must be staggered');
  });

  it('staggers busX coordinates for unions in horizontal layout mode', () => {
    const layout = computeLayout(userExportedTree, 'horizontal');

    const u1 = layout.unions['u_parents_z6qi9yz_mtr0j5ba'];
    const u2 = layout.unions['u_1bnka5g_mtr1bbpq'];

    assert(u1 && u2);
    assert(u1.busCoord !== undefined && u2.busCoord !== undefined);

    // In horizontal mode, vertical bus bars should be staggered along X
    assert.notStrictEqual(
      u1.busCoord,
      u2.busCoord,
      `Unions in horizontal mode must have staggered busX coordinates (u1=${u1.busCoord}, u2=${u2.busCoord})`
    );

    const busEdge1 = layout.edges.find((e) => e.id === `edge_bus_${u1.id}`);
    const busEdge2 = layout.edges.find((e) => e.id === `edge_bus_${u2.id}`);
    assert(busEdge1 && busEdge2);

    const busX1 = Number(busEdge1.pathD.split(' ')[1]);
    const busX2 = Number(busEdge2.pathD.split(' ')[1]);
    assert.notStrictEqual(busX1, busX2, 'Bus bar edge X coordinates must be staggered in horizontal mode');
  });

  it('assigns and propagates distinct branch colors to all union edges', () => {
    const layout = computeLayout(userExportedTree, 'vertical');

    for (const union of Object.values(layout.unions)) {
      assert(union.color, `Union ${union.id} must have a color assigned`);

      if (union.childrenNodes.length > 0) {
        // Check stem edge
        const stemEdge = layout.edges.find((e) => e.id === `edge_stem_${union.id}`);
        assert(stemEdge, `Stem edge for ${union.id} must exist`);
        assert.strictEqual(stemEdge.color, union.color, 'Stem edge must inherit union branch color');

        // Check bus edge
        const busEdge = layout.edges.find((e) => e.id === `edge_bus_${union.id}`);
        if (busEdge) {
          assert.strictEqual(busEdge.color, union.color, 'Bus edge must inherit union branch color');
        }

        // Check child drop edges
        for (const child of union.childrenNodes) {
          const childEdge = layout.edges.find((e) => e.id === `edge_child_${union.id}_${child.id}`);
          assert(childEdge, `Child edge for ${child.id} must exist`);
          assert.strictEqual(childEdge.color, union.color, 'Child drop edge must inherit union branch color');
        }
      }
    }
  });

  it('prevents bus collisions when two unions have overlapping child X ranges', () => {
    // Construct a synthetic tree with two unions whose children overlap in X
    const overlappingTree: TreeData = {
      id: 'test_overlap',
      name: 'Overlapping Test',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      people: {
        p1: { id: 'p1', firstName: 'Parent1', lastName: 'A', unionIds: ['u1'], generation: 0 },
        p2: { id: 'p2', firstName: 'Parent2', lastName: 'A', unionIds: ['u1'], generation: 0 },
        p3: { id: 'p3', firstName: 'Parent3', lastName: 'B', unionIds: ['u2'], generation: 0 },
        p4: { id: 'p4', firstName: 'Parent4', lastName: 'B', unionIds: ['u2'], generation: 0 },
        c1: { id: 'c1', firstName: 'Child1', lastName: 'A', unionIds: [], parentUnionId: 'u1', generation: 1, x: -300, y: 254 },
        c2: { id: 'c2', firstName: 'Child2', lastName: 'A', unionIds: [], parentUnionId: 'u1', generation: 1, x: 100, y: 254 },
        c3: { id: 'c3', firstName: 'Child3', lastName: 'B', unionIds: [], parentUnionId: 'u2', generation: 1, x: -100, y: 254 },
        c4: { id: 'c4', firstName: 'Child4', lastName: 'B', unionIds: [], parentUnionId: 'u2', generation: 1, x: 300, y: 254 },
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['p1', 'p2'], childrenIds: ['c1', 'c2'] },
        u2: { id: 'u2', partnerIds: ['p3', 'p4'], childrenIds: ['c3', 'c4'] },
      },
    };

    const layout = computeLayout(overlappingTree, 'vertical');
    const u1 = layout.unions['u1'];
    const u2 = layout.unions['u2'];

    assert(u1 && u2);
    // Since u1 spans [-300, 100] and u2 spans [-100, 300], their X intervals directly overlap [-100, 100].
    // They MUST NOT share the same busCoord Y!
    assert.notStrictEqual(
      u1.busCoord,
      u2.busCoord,
      `Overlapping unions must be placed in different bus lanes! Got u1=${u1.busCoord}, u2=${u2.busCoord}`
    );
  });

  it('prevents top-level grandparent bus bars from passing through grandparent nodes when orphan parent unions exist', () => {
    // Grandparents at Gen 0 with children at Gen 1, plus one grandparent having an orphan parent union
    const treeWithGrandparentOrphan: TreeData = {
      id: 'gp_orphan_test',
      name: 'Grandparent Orphan Test',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      people: {
        gf: { id: 'gf', firstName: 'Grandpa', lastName: 'Brits', unionIds: ['u_gp'], parentUnionId: 'u_orphan_above', generation: 0 },
        gm: { id: 'gm', firstName: 'Grandma', lastName: 'Brits', unionIds: ['u_gp'], generation: 0 },
        dad: { id: 'dad', firstName: 'Father', lastName: 'Brits', unionIds: [], parentUnionId: 'u_gp', generation: 1 },
      },
      unions: {
        u_gp: { id: 'u_gp', partnerIds: ['gf', 'gm'], childrenIds: ['dad'] },
        u_orphan_above: { id: 'u_orphan_above', partnerIds: [], childrenIds: ['gf'] },
      },
    };

    const layout = computeLayout(treeWithGrandparentOrphan, 'vertical');
    const u_gp = layout.unions['u_gp'];
    const u_orphan = layout.unions['u_orphan_above'];

    assert(u_gp && u_orphan);
    // Grandparents are at y=[0, 104], children at y=[254, 358]
    // u_gp bus MUST be strictly below grandparents (y > 104) and above children (y < 254)
    assert(u_gp.busCoord! > 104, `u_gp bus bar must be below grandparents card (got ${u_gp.busCoord})`);
    assert(u_gp.busCoord! < 254, `u_gp bus bar must be above children card (got ${u_gp.busCoord})`);

    // u_orphan bus bar MUST be above grandparents (y <= 0)
    assert(u_orphan.busCoord! <= 0, `u_orphan bus bar must be above grandparents card (got ${u_orphan.busCoord})`);

    // Ensure NO edge passes through the bounding box of grandpa or grandma
    for (const edge of layout.edges) {
      const regex = /([ML])\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g;
      let match;
      const points: { x: number; y: number }[] = [];
      while ((match = regex.exec(edge.pathD)) !== null) {
        points.push({ x: Number(match[2]), y: Number(match[3]) });
      }

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        for (const [id, node] of Object.entries(layout.nodes)) {
          if (node.generation === 0) {
            if (Math.abs(p1.y - p2.y) < 1e-3) {
              const y = p1.y;
              const minX = Math.min(p1.x, p2.x);
              const maxX = Math.max(p1.x, p2.x);
              if (y > node.y && y < node.y + node.height) {
                assert(
                  Math.max(minX, node.x) >= Math.min(maxX, node.x + node.width),
                  `Edge ${edge.id} passes horizontally through node ${id} at Y=${y}`
                );
              }
            }
          }
        }
      }
    }
  });
});

describe('Widest-Row Spacing Adjustment', () => {
  it('groups sibling pods and centers them under their parents in a 3-generation tree', () => {
    const tree = createDoubleInLawPreset();
    const layoutAdjusted = computeLayout(tree, 'vertical', false, undefined, true);

    // In Double In-Law:
    // Gen 0: Grandparents (gf_smith + gm_smith, gf_miller + gm_miller)
    // Gen 1: Parents (dad + mom), Uncle Dan + Aunt Margaret
    // Gen 2: Me, Sibling (children of dad + mom), Cousins (children of uncle + aunt)
    const dad = layoutAdjusted.nodes['dad'];
    const mom = layoutAdjusted.nodes['mom'];
    const me = layoutAdjusted.nodes['me'];
    const siblingMe = layoutAdjusted.nodes['sibling_me'];

    assert(dad && mom && me && siblingMe);

    // Me and siblingMe are siblings in the same pod: must be separated by standard spacing
    const siblingGap = Math.abs(siblingMe.x - me.x) - CARD_WIDTH;
    assert.strictEqual(siblingGap, HORIZONTAL_SPACING, 'Siblings should have standard HORIZONTAL_SPACING');

    // Children center:
    const kidsMinX = Math.min(me.x, siblingMe.x);
    const kidsMaxX = Math.max(me.x + me.width, siblingMe.x + siblingMe.width);
    const kidsCenter = (kidsMinX + kidsMaxX) / 2;

    // Parent couple center:
    const parentMinX = Math.min(dad.x, mom.x);
    const parentMaxX = Math.max(dad.x + dad.width, mom.x + mom.width);
    const parentCenter = (parentMinX + parentMaxX) / 2;

    // Parents should be centered directly over their children
    assert(
      Math.abs(parentCenter - kidsCenter) <= 2,
      `Parents center (${parentCenter}) should align with kids center (${kidsCenter})`
    );
  });

  it('separates distinct sibling pods with inter-group spacing wider than intra-sibling spacing in non-widest rows', () => {
    // In Three Gen Branching, Gen 1 has 4 nodes (widest row), and Gen 2 has 2 pods:
    // Pod 1: child 1 (child of dad + mom)
    // Pod 2: child 2, child 3 (children of uncle + aunt)
    const tree: TreeData = {
      id: 'three_gen_branching',
      name: 'Three Gen Branching',
      createdAt: '',
      updatedAt: '',
      people: {
        gf: { id: 'gf', firstName: 'Grandfather', unionIds: ['u_gp'] },
        gm: { id: 'gm', firstName: 'Grandmother', unionIds: ['u_gp'] },
        dad: { id: 'dad', firstName: 'Dad', parentUnionId: 'u_gp', unionIds: ['u1'] },
        mom: { id: 'mom', firstName: 'Mom', unionIds: ['u1'] },
        c1: { id: 'c1', firstName: 'Child 1', parentUnionId: 'u1', unionIds: [] },
        uncle: { id: 'uncle', firstName: 'Uncle', parentUnionId: 'u_gp', unionIds: ['u2'] },
        aunt: { id: 'aunt', firstName: 'Aunt', unionIds: ['u2'] },
        c2: { id: 'c2', firstName: 'Child 2', parentUnionId: 'u2', unionIds: [] },
        c3: { id: 'c3', firstName: 'Child 3', parentUnionId: 'u2', unionIds: [] },
      },
      unions: {
        u_gp: { id: 'u_gp', partnerIds: ['gf', 'gm'], childrenIds: ['dad', 'uncle'] },
        u1: { id: 'u1', partnerIds: ['dad', 'mom'], childrenIds: ['c1'] },
        u2: { id: 'u2', partnerIds: ['uncle', 'aunt'], childrenIds: ['c2', 'c3'] },
      },
      rootPersonId: 'dad',
    };
    const layout = computeLayout(tree, 'vertical', false, undefined, true);

    const c1 = layout.nodes['c1'];
    const c2 = layout.nodes['c2'];
    const c3 = layout.nodes['c3'];
    assert(c1 && c2 && c3);

    const intraPod2Gap = c3.x - (c2.x + CARD_WIDTH);
    assert.strictEqual(intraPod2Gap, HORIZONTAL_SPACING, 'Siblings c2 and c3 have standard 60px gap');

    const interGroupGap = c2.x - (c1.x + CARD_WIDTH);
    assert(
      interGroupGap >= HORIZONTAL_SPACING + 20,
      `Inter-family gap (${interGroupGap}) must be strictly greater than intra-sibling gap (${HORIZONTAL_SPACING})`
    );
  });

  it('prevents any overlapping nodes across all generations in complex trees', () => {
    const trees = [
      createDoubleInLawPreset(),
      createThreeGenSampleTree(),
      createDivorceBlendedPreset(),
      createBlankTree(),
      clearManualPositions(userExportedTree),
    ];

    for (const tree of trees) {
      const layout = computeLayout(tree, 'vertical', false, undefined, true);
      const nodesByGen: Record<number, typeof layout.nodes[string][]> = {};

      for (const node of Object.values(layout.nodes)) {
        if (!nodesByGen[node.generation]) nodesByGen[node.generation] = [];
        nodesByGen[node.generation].push(node);
      }

      for (const [gen, nodes] of Object.entries(nodesByGen)) {
        nodes.sort((a, b) => a.x - b.x);
        for (let i = 0; i < nodes.length - 1; i++) {
          const left = nodes[i];
          const right = nodes[i + 1];
          const rightEdgeLeft = left.x + left.width;
          assert(
            right.x >= rightEdgeLeft + HORIZONTAL_SPACING - 1,
            `Overlap detected in tree ${tree.id} gen ${gen}: ${left.id} (x=${left.x}, right=${rightEdgeLeft}) and ${right.id} (x=${right.x})`
          );
        }
      }
    }
  });

  it('reverts to uniform equidistant spacing when adjustSpacing is set to false', () => {
    const tree: TreeData = {
      id: 'two_families_uneven',
      name: 'Two Families Uneven',
      createdAt: '',
      updatedAt: '',
      people: {
        dad1: { id: 'dad1', firstName: 'Dad 1', unionIds: ['u1'] },
        mom1: { id: 'mom1', firstName: 'Mom 1', unionIds: ['u1'] },
        c1: { id: 'c1', firstName: 'Child 1', parentUnionId: 'u1', unionIds: [] },
        dad2: { id: 'dad2', firstName: 'Dad 2', unionIds: ['u2'] },
        mom2: { id: 'mom2', firstName: 'Mom 2', unionIds: ['u2'] },
        c2: { id: 'c2', firstName: 'Child 2', parentUnionId: 'u2', unionIds: [] },
        c3: { id: 'c3', firstName: 'Child 3', parentUnionId: 'u2', unionIds: [] },
        c4: { id: 'c4', firstName: 'Child 4', parentUnionId: 'u2', unionIds: [] },
      },
      unions: {
        u1: { id: 'u1', partnerIds: ['dad1', 'mom1'], childrenIds: ['c1'] },
        u2: { id: 'u2', partnerIds: ['dad2', 'mom2'], childrenIds: ['c2', 'c3', 'c4'] },
      },
      rootPersonId: 'dad1',
    };
    const layoutAdjusted = computeLayout(tree, 'vertical', false, undefined, true);
    const layoutUniform = computeLayout(tree, 'vertical', false, undefined, false);

    // In uniform layout, all nodes in generation 0 (dad1, mom1, dad2, mom2) are strictly equidistant
    const gen0Nodes = Object.values(layoutUniform.nodes).filter((n) => n.generation === 0);
    gen0Nodes.sort((a, b) => a.x - b.x);

    const gap1 = gen0Nodes[1].x - (gen0Nodes[0].x + CARD_WIDTH);
    const gap2 = gen0Nodes[2].x - (gen0Nodes[1].x + CARD_WIDTH);
    const gap3 = gen0Nodes[3].x - (gen0Nodes[2].x + CARD_WIDTH);
    assert.strictEqual(gap1, HORIZONTAL_SPACING, 'In uniform mode, every node in row must be equally distant');
    assert.strictEqual(gap2, HORIZONTAL_SPACING, 'In uniform mode, every node in row must be equally distant');
    assert.strictEqual(gap3, HORIZONTAL_SPACING, 'In uniform mode, every node in row must be equally distant');

    // In adjusted layout, child c1 (-460) is positioned under its parents, differing from uniform layout (-530)
    const c1Uniform = layoutUniform.nodes['c1'];
    const c1Adjusted = layoutAdjusted.nodes['c1'];
    assert(c1Uniform && c1Adjusted);
    assert.notStrictEqual(
      c1Adjusted.x,
      c1Uniform.x,
      'Adjusted layout should reposition c1 under its parents'
    );
  });

  it('should produce strictly identical layout regardless of people and unions object key ordering', () => {
    const trees = [
      userExportedTree,
      createDoubleInLawPreset(),
      createThreeGenSampleTree(),
      createDivorceBlendedPreset(),
    ];

    for (const tree of trees) {
      // 1. Original
      const layoutOrig = computeLayout(tree, 'vertical', true, undefined, true);

      // 2. Alphabetical keys
      const alphaPeople: Record<string, any> = {};
      Object.keys(tree.people).sort().forEach((k) => { alphaPeople[k] = tree.people[k]; });
      const alphaUnions: Record<string, any> = {};
      Object.keys(tree.unions).sort().forEach((k) => { alphaUnions[k] = tree.unions[k]; });
      const treeAlpha: TreeData = { ...tree, people: alphaPeople, unions: alphaUnions };
      const layoutAlpha = computeLayout(treeAlpha, 'vertical', true, undefined, true);

      // 3. Reversed keys
      const revPeople: Record<string, any> = {};
      Object.keys(tree.people).sort().reverse().forEach((k) => { revPeople[k] = tree.people[k]; });
      const revUnions: Record<string, any> = {};
      Object.keys(tree.unions).sort().reverse().forEach((k) => { revUnions[k] = tree.unions[k]; });
      const treeRev: TreeData = { ...tree, people: revPeople, unions: revUnions };
      const layoutRev = computeLayout(treeRev, 'vertical', true, undefined, true);

      // Verify all nodes match exactly
      for (const id of Object.keys(tree.people)) {
        const origNode = layoutOrig.nodes[id];
        const alphaNode = layoutAlpha.nodes[id];
        const revNode = layoutRev.nodes[id];

        assert(origNode && alphaNode && revNode, `Node ${id} should exist in all layouts`);
        assert.strictEqual(
          alphaNode.x,
          origNode.x,
          `Node ${id} x-coordinate differed with alphabetical key order in tree ${tree.id}`
        );
        assert.strictEqual(
          alphaNode.y,
          origNode.y,
          `Node ${id} y-coordinate differed with alphabetical key order in tree ${tree.id}`
        );
        assert.strictEqual(
          revNode.x,
          origNode.x,
          `Node ${id} x-coordinate differed with reversed key order in tree ${tree.id}`
        );
        assert.strictEqual(
          revNode.y,
          origNode.y,
          `Node ${id} y-coordinate differed with reversed key order in tree ${tree.id}`
        );
      }
    }
  });
});




