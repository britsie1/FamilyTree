import { computeLayout } from './src/services/layoutEngine.ts';
import type { TreeData } from './src/types/tree.ts';

const userTree: TreeData = {
  "id": "tree_double_in_law",
  "name": "Double In-Law Marriage (Edge Case)",
  "description": "Two brothers marrying two sisters. Their children are double first cousins who share both sets of grandparents.",
  "createdAt": "2026-09-07T09:00:08.904Z",
  "updatedAt": "2026-09-07T09:48:35.685Z",
  "people": {
    "gf_smith": {
      "id": "gf_smith",
      "firstName": "Johannes",
      "lastName": "Brits",
      "gender": "male",
      "birthDate": "1989-12-15",
      "birthPlace": "Alberton, Gauteng",
      "isDeceased": false,
      "notes": "Paternal Grandfather",
      "unionIds": ["u_smith_grandparents"],
      "parentUnionId": "u_parents_z6qi9yz_mtr0j5ba"
    },
    "parent_5cv7tb4_mtr0j5ba": {
      "id": "parent_5cv7tb4_mtr0j5ba",
      "firstName": "Jurie",
      "lastName": "Brits",
      "gender": "unspecified",
      "unionIds": ["u_parents_z6qi9yz_mtr0j5ba", "u_u8i6my7_mtr0jgdr", "u_vhziwou_mtr159sx"],
      "parentUnionId": "u_parents_k8agv8s_mtr0p23l"
    },
    "child_xseaxab_mtr0n7zw": {
      "id": "child_xseaxab_mtr0n7zw",
      "firstName": "Jacobus",
      "lastName": "Brits",
      "gender": "unspecified",
      "unionIds": [],
      "parentUnionId": "u_parents_z6qi9yz_mtr0j5ba"
    },
    "child_m6okaw7_mtr0nf0t": {
      "id": "child_m6okaw7_mtr0nf0t",
      "firstName": "Carlynne",
      "lastName": "Viljoen",
      "gender": "unspecified",
      "unionIds": [],
      "parentUnionId": "u_parents_z6qi9yz_mtr0j5ba",
      "maidenName": "Brits"
    },
    "parent_reqwnvg_mtr17ezd": {
      "id": "parent_reqwnvg_mtr17ezd",
      "firstName": "Riana",
      "lastName": "Brits",
      "gender": "female",
      "unionIds": ["u_parents_z6qi9yz_mtr0j5ba"],
      "maidenName": "Du Plessis",
      "parentUnionId": "u_parents_baep1oe_mtr18zda"
    },
    "parent_9lmvc3d_mtr18zda": {
      "id": "parent_9lmvc3d_mtr18zda",
      "firstName": "Johannes",
      "lastName": "Du Plessis",
      "gender": "male",
      "unionIds": ["u_parents_baep1oe_mtr18zda", "u_o4aeqm2_mtr1ezve"]
    },
    "sibling_m9lio21_mtr18zda": {
      "id": "sibling_m9lio21_mtr18zda",
      "firstName": "Marinda",
      "lastName": "Bezuidenhout",
      "gender": "female",
      "unionIds": ["u_1bnka5g_mtr1bbpq", "u_6i7fwzu_mtr1jngz", "u_parents_6n1xsq6_mtr1lorj"],
      "parentUnionId": "u_parents_baep1oe_mtr18zda",
      "maidenName": "Du Plessis"
    },
    "sibling_ycmvgyu_mtr1a27c": {
      "id": "sibling_ycmvgyu_mtr1a27c",
      "firstName": "Gerhard",
      "lastName": "Brits",
      "gender": "unspecified",
      "unionIds": ["u_1bnka5g_mtr1bbpq", "u_acg39f3_mtr1bn8s"],
      "parentUnionId": "u_parents_k8agv8s_mtr0p23l"
    },
    "partner_iv13dvu_mtr1ezve": {
      "id": "partner_iv13dvu_mtr1ezve",
      "firstName": "Wilhelmina",
      "lastName": "Du Plessis",
      "gender": "female",
      "unionIds": ["u_o4aeqm2_mtr1ezve", "u_parents_baep1oe_mtr18zda"],
      "maidenName": "Bril"
    },
    "child_j2jnd61_mtr1j4jf": {
      "id": "child_j2jnd61_mtr1j4jf",
      "firstName": "Victoria",
      "lastName": "Brits",
      "gender": "female",
      "unionIds": [],
      "parentUnionId": "u_1bnka5g_mtr1bbpq"
    },
    "partner_oy0pagc_mtr1jngz": {
      "id": "partner_oy0pagc_mtr1jngz",
      "firstName": "Johan",
      "lastName": "Bezuidenhout",
      "gender": "male",
      "unionIds": ["u_6i7fwzu_mtr1jngz", "u_parents_6n1xsq6_mtr1lorj"]
    },
    "child_uww2hzv_mtr1k9ms": {
      "id": "child_uww2hzv_mtr1k9ms",
      "firstName": "Laurika",
      "lastName": "Bezuidenhout",
      "gender": "female",
      "unionIds": [],
      "parentUnionId": "u_parents_6n1xsq6_mtr1lorj"
    }
  },
  "unions": {
    "u_smith_grandparents": {
      "id": "u_smith_grandparents",
      "partnerIds": ["gf_smith"],
      "childrenIds": [],
      "type": "married",
      "marriageDate": "1963-06-20"
    },
    "u_parents_z6qi9yz_mtr0j5ba": {
      "id": "u_parents_z6qi9yz_mtr0j5ba",
      "partnerIds": ["parent_5cv7tb4_mtr0j5ba", "parent_reqwnvg_mtr17ezd"],
      "childrenIds": ["gf_smith", "child_xseaxab_mtr0n7zw", "child_m6okaw7_mtr0nf0t"],
      "type": "married"
    },
    "u_u8i6my7_mtr0jgdr": {
      "id": "u_u8i6my7_mtr0jgdr",
      "partnerIds": ["parent_5cv7tb4_mtr0j5ba"],
      "childrenIds": [],
      "type": "married"
    },
    "u_parents_k8agv8s_mtr0p23l": {
      "id": "u_parents_k8agv8s_mtr0p23l",
      "partnerIds": [],
      "childrenIds": ["parent_5cv7tb4_mtr0j5ba", "sibling_ycmvgyu_mtr1a27c"],
      "type": "married"
    },
    "u_vhziwou_mtr159sx": {
      "id": "u_vhziwou_mtr159sx",
      "partnerIds": ["parent_5cv7tb4_mtr0j5ba"],
      "childrenIds": [],
      "type": "married"
    },
    "u_parents_baep1oe_mtr18zda": {
      "id": "u_parents_baep1oe_mtr18zda",
      "partnerIds": ["parent_9lmvc3d_mtr18zda", "partner_iv13dvu_mtr1ezve"],
      "childrenIds": ["parent_reqwnvg_mtr17ezd", "sibling_m9lio21_mtr18zda"],
      "type": "married"
    },
    "u_1bnka5g_mtr1bbpq": {
      "id": "u_1bnka5g_mtr1bbpq",
      "partnerIds": ["sibling_ycmvgyu_mtr1a27c", "sibling_m9lio21_mtr18zda"],
      "childrenIds": ["child_j2jnd61_mtr1j4jf"],
      "type": "divorced"
    },
    "u_acg39f3_mtr1bn8s": {
      "id": "u_acg39f3_mtr1bn8s",
      "partnerIds": ["sibling_ycmvgyu_mtr1a27c"],
      "childrenIds": [],
      "type": "married"
    },
    "u_o4aeqm2_mtr1ezve": {
      "id": "u_o4aeqm2_mtr1ezve",
      "partnerIds": ["parent_9lmvc3d_mtr18zda", "partner_iv13dvu_mtr1ezve"],
      "childrenIds": [],
      "type": "married"
    },
    "u_6i7fwzu_mtr1jngz": {
      "id": "u_6i7fwzu_mtr1jngz",
      "partnerIds": ["sibling_m9lio21_mtr18zda", "partner_oy0pagc_mtr1jngz"],
      "childrenIds": [],
      "type": "divorced"
    },
    "u_parents_6n1xsq6_mtr1lorj": {
      "id": "u_parents_6n1xsq6_mtr1lorj",
      "partnerIds": ["partner_oy0pagc_mtr1jngz", "sibling_m9lio21_mtr18zda"],
      "childrenIds": ["child_uww2hzv_mtr1k9ms"],
      "type": "married"
    }
  },
  "rootPersonId": "gf_smith"
};

const layout = computeLayout(userTree);

console.log("=== NODES ===");
for (const [id, node] of Object.entries(layout.nodes)) {
  console.log(`${id} (${node.data.firstName} ${node.data.lastName}): gen=${node.generation}, x=${node.x}, y=${node.y}`);
}

console.log("=== UNIONS ===");
for (const [id, u] of Object.entries(layout.unions)) {
  console.log(`${id}: type=${u.data.type}, x=${u.x}, y=${u.y}, partners=${u.partnerNodes.map(p => p.id).join('+')}, children=${u.childrenNodes.map(c => c.id).join('+')}`);
}

console.log("=== EDGES (" + layout.edges.length + ") ===");
for (const edge of layout.edges) {
  console.log(`${edge.id} (${edge.edgeType}, unionType=${edge.unionType}): ${edge.pathD}`);
}
