import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractYear,
  getPersonTemporalInfo,
  getUnionTemporalInfo,
  getWorldEventsInYear,
  getHistoricalMoments,
  computeRoomStats,
  getTreeYearBounds,
} from '../src/services/temporalEngine';
import type { Person, TreeData, Union } from '../src/types/tree';

describe('Temporal Engine', () => {
  describe('extractYear', () => {
    test('extracts 4-digit years from ISO format', () => {
      assert.equal(extractYear('1944-06-06'), 1944);
      assert.equal(extractYear('2024-01-01'), 2024);
    });

    test('extracts 4-digit years from standalone year or mixed text', () => {
      assert.equal(extractYear('1968'), 1968);
      assert.equal(extractYear('12 APR 1938'), 1938);
      assert.equal(extractYear('circa 1890'), 1890);
    });

    test('returns null for empty or invalid dates', () => {
      assert.equal(extractYear(undefined), null);
      assert.equal(extractYear(''), null);
      assert.equal(extractYear('unknown'), null);
    });
  });

  describe('getPersonTemporalInfo', () => {
    const person: Person = {
      id: 'p1',
      firstName: 'Grandpa',
      lastName: 'Smith',
      birthDate: '1930-05-15',
      deathDate: '2005-11-20',
      unionIds: [],
    };

    test('identifies unborn status prior to birth year', () => {
      const info1920 = getPersonTemporalInfo(person, 1920);
      assert.equal(info1920.status, 'unborn');
      assert.equal(info1920.isLivingInYear, false);
      assert.equal(info1920.age, null);
      assert.equal(info1920.ageLabel, 'Unborn (b. 1930)');

      const info1929 = getPersonTemporalInfo(person, 1929);
      assert.equal(info1929.status, 'unborn');
      assert.equal(info1929.ageLabel, 'Born next year');
    });

    test('identifies living status with exact age in year', () => {
      const info1930 = getPersonTemporalInfo(person, 1930);
      assert.equal(info1930.status, 'living');
      assert.equal(info1930.isLivingInYear, true);
      assert.equal(info1930.age, 0);
      assert.equal(info1930.wasJustBorn, true);
      assert.equal(info1930.ageLabel, 'Newborn (Age 0)');

      const info1944 = getPersonTemporalInfo(person, 1944);
      assert.equal(info1944.status, 'living');
      assert.equal(info1944.age, 14);
      assert.equal(info1944.ageLabel, 'Age 14');

      const info2000 = getPersonTemporalInfo(person, 2000);
      assert.equal(info2000.status, 'living');
      assert.equal(info2000.age, 70);
      assert.equal(info2000.isMilestoneAge, true);
    });

    test('identifies deceased status post death year', () => {
      const info2005 = getPersonTemporalInfo(person, 2005);
      assert.equal(info2005.status, 'living'); // Still lived in 2005
      assert.equal(info2005.passedThisYear, true);

      const info2010 = getPersonTemporalInfo(person, 2010);
      assert.equal(info2010.status, 'deceased');
      assert.equal(info2010.isLivingInYear, false);
      assert.equal(info2010.ageLabel, 'Passed in 2005 (age 75)');
    });
  });

  describe('getUnionTemporalInfo', () => {
    const union: Union = {
      id: 'u1',
      partnerIds: ['p1', 'p2'],
      childrenIds: ['p3'],
      marriageDate: '1955-08-12',
      divorceDate: '1975-04-10',
      type: 'divorced',
    };

    test('identifies unmarried state before marriage year', () => {
      const info1944 = getUnionTemporalInfo(union, 1944);
      assert.equal(info1944.isMarried, false);
      assert.equal(info1944.isDivorced, false);
      assert.match(info1944.statusLabel, /Unmarried in 1944/);
    });

    test('identifies married state between marriage and divorce', () => {
      const info1955 = getUnionTemporalInfo(union, 1955);
      assert.equal(info1955.isMarried, true);
      assert.equal(info1955.isJustWed, true);
      assert.equal(info1955.isDivorced, false);

      const info1965 = getUnionTemporalInfo(union, 1965);
      assert.equal(info1965.isMarried, true);
      assert.equal(info1965.yearsMarried, 10);
      assert.equal(info1965.isDivorced, false);
    });

    test('identifies divorced state from divorce year onwards', () => {
      const info1975 = getUnionTemporalInfo(union, 1975);
      assert.equal(info1975.isMarried, false);
      assert.equal(info1975.isDivorced, true);
    });
  });

  describe('Major World Events Database', () => {
    test('contains key world milestones including 1944 and 1969', () => {
      const events1944 = getWorldEventsInYear(1944);
      assert.ok(events1944.some((e) => e.year === 1944 && e.title.includes('D-Day')));

      const events1969 = getWorldEventsInYear(1969);
      assert.ok(events1969.some((e) => e.year === 1969 && e.title.includes('Moon Landing')));
    });
  });

  describe('Historical Moments & Room Stats', () => {
    const mockTree: TreeData = {
      id: 't1',
      name: 'Test Family Tree',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      people: {
        p1: {
          id: 'p1',
          firstName: 'Arthur',
          lastName: 'Smith',
          birthDate: '1910-02-15',
          deathDate: '1985-06-20',
          unionIds: ['u1'],
        },
        p2: {
          id: 'p2',
          firstName: 'Eleanor',
          lastName: 'Smith',
          birthDate: '1915-07-22',
          deathDate: '2000-03-10',
          unionIds: ['u1'],
        },
        p3: {
          id: 'p3',
          firstName: 'David',
          lastName: 'Smith',
          birthDate: '1945-09-12',
          parentUnionId: 'u1',
          unionIds: [],
        },
        p4: {
          id: 'p4',
          firstName: 'Alex',
          lastName: 'Smith',
          birthDate: '1980-04-10',
          unionIds: [],
        },
      },
      unions: {
        u1: {
          id: 'u1',
          partnerIds: ['p1', 'p2'],
          childrenIds: ['p3'],
          marriageDate: '1938-06-18',
        },
      },
    };

    test('extracts life events into HistoricalMoments', () => {
      const moments = getHistoricalMoments(mockTree);
      assert.ok(moments.length > 0);

      // Wedding moment
      const wedding = moments.find((m) => m.type === 'wedding' && m.year === 1938);
      assert.ok(wedding);
      assert.match(wedding!.title, /Arthur.*Eleanor.*Wedding/);

      // 50th Birthday moment for Arthur in 1960
      const bday50 = moments.find((m) => m.type === 'birthday' && m.year === 1960);
      assert.ok(bday50);
      assert.match(bday50!.title, /Arthur Smith's 50th Birthday/);
    });

    test('computes room stats and living relatives in year 1944 ("Who was in the room?")', () => {
      const stats1944 = computeRoomStats(mockTree, 1944);
      // In 1944: Arthur (b. 1910, age 34) and Eleanor (b. 1915, age 29) are alive.
      // David (b. 1945) and Alex (b. 1980) are unborn.
      assert.equal(stats1944.livingCount, 2);
      assert.equal(stats1944.unbornCount, 2);
      assert.equal(stats1944.deceasedCount, 0);
      assert.equal(stats1944.livingPeople.map((p) => p.id).sort().join(','), 'p1,p2');
      assert.ok(stats1944.narrativeSummary.includes('2 of 4 family members'));
    });

    test('computes room stats for a specific historical moment (Eleanor 50th birthday in 1965)', () => {
      const moment = {
        id: 'test_moment',
        year: 1965,
        title: "Eleanor's 50th Birthday",
        type: 'birthday' as const,
      };

      const stats1965 = computeRoomStats(mockTree, 1965, moment);
      // In 1965: Arthur (55), Eleanor (50), David (20) are alive. Alex (b. 1980) is unborn.
      assert.equal(stats1965.livingCount, 3);
      assert.equal(stats1965.unbornCount, 1);
      assert.match(stats1965.narrativeSummary, /Eleanor's 50th Birthday \(1965\): 3 of 4 relatives were alive/);
    });

    test('calculates correct dynamic year bounds from tree', () => {
      const bounds = getTreeYearBounds(mockTree);
      assert.ok(bounds.minYear <= 1910);
      assert.ok(bounds.maxYear >= 2026);
    });
  });
});
