import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseGedcom, exportGedcom, normalizeGedcomDate } from '../src/services/gedcomService.ts';
import { createDoubleInLawPreset, createThreeGenSampleTree, createDivorceBlendedPreset } from '../src/services/storage.ts';

describe('GEDCOM Service', () => {
  describe('normalizeGedcomDate', () => {
    it('normalizes full day-month-year dates', () => {
      assert.strictEqual(normalizeGedcomDate('15 JAN 1980'), '1980-01-15');
      assert.strictEqual(normalizeGedcomDate('1 DEC 2005'), '2005-12-01');
    });

    it('normalizes month-year dates', () => {
      assert.strictEqual(normalizeGedcomDate('MAY 1995'), '1995-05-01');
    });

    it('normalizes year-only dates', () => {
      assert.strictEqual(normalizeGedcomDate('1945'), '1945');
    });

    it('strips qualifiers like ABT, BEF, AFT', () => {
      assert.strictEqual(normalizeGedcomDate('ABT 1930'), '1930');
      assert.strictEqual(normalizeGedcomDate('BEF 14 JUN 1965'), '1965-06-14');
    });
  });

  describe('parseGedcom', () => {
    it('parses standard INDI and FAM records correctly', () => {
      const sampleGedcom = `
0 HEAD
1 SOUR Ancestry
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Johnathan Robert /Doe/
2 GIVN Johnathan
2 SURN Doe
2 NICK Johnny
1 SEX M
1 BIRT
2 DATE 15 JAN 1980
2 PLAC New York, NY
1 FAMS @F1@
0 @I2@ INDI
1 NAME Jane /Smith/
2 GIVN Jane
2 SURN Smith
1 SEX F
1 BIRT
2 DATE 22 MAR 1982
1 FAMS @F1@
0 @I3@ INDI
1 NAME Billy /Doe/
1 SEX M
1 BIRT
2 DATE 10 OCT 2010
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 MARR
2 DATE 05 JUN 2005
0 TRLR
`;
      const tree = parseGedcom(sampleGedcom, 'Test Tree');

      assert.strictEqual(Object.keys(tree.people).length, 3);
      assert.strictEqual(Object.keys(tree.unions).length, 1);

      const john = Object.values(tree.people).find((p) => p.firstName === 'Johnathan');
      assert.ok(john);
      assert.strictEqual(john.lastName, 'Doe');
      assert.strictEqual(john.knownAs, 'Johnny');
      assert.strictEqual(john.gender, 'male');
      assert.strictEqual(john.birthDate, '1980-01-15');
      assert.strictEqual(john.birthPlace, 'New York, NY');

      const jane = Object.values(tree.people).find((p) => p.firstName === 'Jane');
      assert.ok(jane);
      assert.strictEqual(jane.gender, 'female');

      const billy = Object.values(tree.people).find((p) => p.firstName === 'Billy');
      assert.ok(billy);
      assert.strictEqual(billy.gender, 'male');

      const union = Object.values(tree.unions)[0];
      assert.ok(union);
      assert.strictEqual(union.partnerIds.length, 2);
      assert.ok(union.partnerIds.includes(john.id));
      assert.ok(union.partnerIds.includes(jane.id));
      assert.ok(union.childrenIds.includes(billy.id));
      assert.strictEqual(billy.parentUnionId, union.id);
      assert.strictEqual(union.marriageDate, '2005-06-05');
      assert.strictEqual(union.type, 'married');
    });

    it('parses divorce status and death information', () => {
      const sample = `
0 HEAD
0 @I1@ INDI
1 NAME Jack /Sparrow/
1 SEX M
1 DEAT
2 DATE 1800
2 PLAC At Sea
1 FAMS @F1@
0 @I2@ INDI
1 NAME Elizabeth /Swann/
1 SEX F
1 FAMS @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR
2 DATE 1780
1 DIV
2 DATE 1790
0 TRLR
`;
      const tree = parseGedcom(sample);
      const jack = Object.values(tree.people).find((p) => p.firstName === 'Jack');
      assert.ok(jack);
      assert.strictEqual(jack.isDeceased, true);
      assert.strictEqual(jack.deathDate, '1800');
      assert.strictEqual(jack.deathPlace, 'At Sea');

      const union = Object.values(tree.unions)[0];
      assert.ok(union);
      assert.strictEqual(union.type, 'divorced');
      assert.strictEqual(union.marriageDate, '1780');
      assert.strictEqual(union.divorceDate, '1790');
    });
  });

  describe('exportGedcom and Roundtrip', () => {
    it('exports a tree to valid GEDCOM 5.5.1 format', () => {
      const originalTree = createDoubleInLawPreset();
      const gedcomText = exportGedcom(originalTree);

      assert.ok(gedcomText.startsWith('0 HEAD'));
      assert.ok(gedcomText.includes('1 GEDC\n2 VERS 5.5.1'));
      assert.ok(gedcomText.includes('0 TRLR'));
      assert.ok(gedcomText.includes('Arthur /Smith/'));
      assert.ok(gedcomText.includes('Mary /Smith/'));
      assert.ok(gedcomText.includes('1 SEX M'));
      assert.ok(gedcomText.includes('1 SEX F'));
      assert.ok(gedcomText.includes('0 @F'));
      assert.ok(gedcomText.includes('1 HUSB'));
      assert.ok(gedcomText.includes('1 WIFE'));
      assert.ok(gedcomText.includes('1 CHIL'));
    });

    it('preserves people and relationships across an export -> parse roundtrip', () => {
      const originalTree = createThreeGenSampleTree();
      const gedcomText = exportGedcom(originalTree);
      const importedTree = parseGedcom(gedcomText, 'Roundtrip Tree');

      // Check count of individuals
      assert.strictEqual(
        Object.keys(importedTree.people).length,
        Object.keys(originalTree.people).length
      );

      // Verify Charles is partner to Diana and Camilla
      const charles = Object.values(importedTree.people).find((p) => p.firstName === 'Charles');
      assert.ok(charles);
      assert.strictEqual(charles.unionIds.length, 2);

      // Verify William is child of Charles's union with Diana
      const william = Object.values(importedTree.people).find((p) => p.firstName === 'William');
      assert.ok(william);
      assert.ok(william.parentUnionId);
      const charlesDianaUnion = importedTree.unions[william.parentUnionId];
      assert.ok(charlesDianaUnion);
      assert.ok(charlesDianaUnion.partnerIds.includes(charles.id));
      assert.strictEqual(charlesDianaUnion.type, 'divorced');
    });

    it('preserves blended divorce families across roundtrip', () => {
      const original = createDivorceBlendedPreset();
      const gedcomText = exportGedcom(original);
      const imported = parseGedcom(gedcomText);

      assert.strictEqual(Object.keys(imported.people).length, Object.keys(original.people).length);
      const sharedChild = Object.values(imported.people).find((p) => p.firstName === 'Emma');
      assert.ok(sharedChild);
      assert.ok(sharedChild.parentUnionId);
      const divUnion = imported.unions[sharedChild.parentUnionId];
      assert.ok(divUnion);
      assert.strictEqual(divUnion.type, 'divorced');
      assert.strictEqual(divUnion.partnerIds.length, 2);
    });
  });
});
