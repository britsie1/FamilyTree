import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { TreeData } from '../src/types/tree.ts';
import {
  computeTreeStatistics,
  auditTreeHealth,
  compareDates,
  extractYear,
  normalizeSurname,
  generateHealthReportMarkdown,
} from '../src/services/treeHealthAndStatsService.ts';

describe('treeHealthAndStatsService', () => {
  describe('helper functions', () => {
    it('compares dates correctly', () => {
      assert.strictEqual(compareDates('1990-05-12', '1990-05-12'), 0);
      assert.ok(compareDates('1990-05-12', '1991-01-01')! < 0);
      assert.ok(compareDates('2000-01-01', '1999-12-31')! > 0);
      assert.ok(compareDates('1990-04', '1990-05')! < 0);
      assert.strictEqual(compareDates(null, '1990'), null);
      assert.strictEqual(compareDates('invalid', '1990'), null);
    });

    it('extracts years and normalizes surnames', () => {
      assert.strictEqual(extractYear('1985-06-12'), 1985);
      assert.strictEqual(extractYear('1842'), 1842);
      assert.strictEqual(extractYear(''), null);
      assert.strictEqual(normalizeSurname('smith '), 'Smith');
      assert.strictEqual(normalizeSurname('VAN DER MERWE'), 'VAN DER MERWE');
    });
  });

  describe('computeTreeStatistics', () => {
    it('computes metrics on a diverse family tree', () => {
      const mockTree: TreeData = {
        id: 'tree-1',
        name: 'Royal Heritage',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          p1: {
            id: 'p1',
            firstName: 'Arthur',
            lastName: 'Pendleton',
            gender: 'male',
            birthDate: '1920-04-10',
            deathDate: '2010-05-15',
            isDeceased: true,
            birthPlace: 'London',
            unionIds: ['u1'],
            generation: 1,
          },
          p2: {
            id: 'p2',
            firstName: 'Guinevere',
            lastName: 'Pendleton',
            maidenName: 'Du Lac',
            gender: 'female',
            birthDate: '1925-08-20',
            deathDate: '2020-01-10',
            isDeceased: true,
            birthPlace: 'Paris',
            unionIds: ['u1'],
            generation: 1,
          },
          p3: {
            id: 'p3',
            firstName: 'Lancelot',
            lastName: 'Pendleton',
            gender: 'male',
            birthDate: '1950-03-15',
            birthPlace: 'London',
            isDeceased: false,
            parentUnionId: 'u1',
            unionIds: ['u2'],
            generation: 2,
          },
          p4: {
            id: 'p4',
            firstName: 'Elaine',
            lastName: 'Pendleton',
            gender: 'female',
            birthDate: '1955-11-02',
            isDeceased: false,
            unionIds: ['u2'],
            generation: 2,
          },
          p5: {
            id: 'p5',
            firstName: 'Galahad',
            lastName: 'Pendleton',
            gender: 'male',
            birthDate: '1980-07-07',
            isDeceased: false,
            parentUnionId: 'u2',
            unionIds: [],
            generation: 3,
          },
        },
        unions: {
          u1: {
            id: 'u1',
            partnerIds: ['p1', 'p2'],
            childrenIds: ['p3'],
          },
          u2: {
            id: 'u2',
            partnerIds: ['p3', 'p4'],
            childrenIds: ['p5'],
          },
        },
      };

      const stats = computeTreeStatistics(mockTree);
      assert.strictEqual(stats.totalPeople, 5);
      assert.strictEqual(stats.totalUnions, 2);
      assert.strictEqual(stats.genderCounts.male, 3);
      assert.strictEqual(stats.genderCounts.female, 2);
      assert.strictEqual(stats.livingCount, 3);
      assert.strictEqual(stats.deceasedCount, 2);

      // p1 lived 90 years (1920 to 2010), p2 lived 94 years (1925 to 2020) => avg = 92
      assert.strictEqual(stats.averageLifespan, 92);
      assert.strictEqual(stats.minGeneration, 1);
      assert.strictEqual(stats.maxGeneration, 3);
      assert.strictEqual(stats.generationSpan, 3);

      // Surnames: Pendleton (4) or Du Lac (1)
      assert.strictEqual(stats.topSurnames[0].surname, 'Pendleton');
      assert.strictEqual(stats.topSurnames[0].count, 4);

      // Birthplaces: London (2), Paris (1)
      assert.strictEqual(stats.topBirthplaces[0].place, 'London');
      assert.strictEqual(stats.topBirthplaces[0].count, 2);

      // Milestones
      assert.strictEqual(stats.milestones.earliestBirth?.year, 1920);
      assert.strictEqual(stats.milestones.longestLived?.person.id, 'p2');
      assert.strictEqual(stats.milestones.oldestLiving?.person.id, 'p3');
    });
  });

  describe('auditTreeHealth', () => {
    it('rates a valid tree with high score and zero errors', () => {
      const cleanTree: TreeData = {
        id: 'clean-1',
        name: 'Clean Family',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          p1: { id: 'p1', firstName: 'John', lastName: 'Doe', gender: 'male', birthDate: '1960', unionIds: ['u1'] },
          p2: { id: 'p2', firstName: 'Jane', lastName: 'Doe', gender: 'female', birthDate: '1962', unionIds: ['u1'] },
          p3: { id: 'p3', firstName: 'Jimmy', lastName: 'Doe', gender: 'male', birthDate: '1990', parentUnionId: 'u1', unionIds: [] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1', 'p2'], childrenIds: ['p3'] },
        },
      };

      const health = auditTreeHealth(cleanTree);
      assert.strictEqual(health.errorCount, 0);
      assert.strictEqual(health.status, 'excellent');
      assert.ok(health.score >= 95);
    });

    it('detects death before birth error', () => {
      const badTree: TreeData = {
        id: 'bad-1',
        name: 'Bad Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          p1: { id: 'p1', firstName: 'Time', lastName: 'Traveler', birthDate: '1980-01-01', deathDate: '1960-01-01', isDeceased: true, unionIds: [] },
        },
        unions: {},
      };

      const health = auditTreeHealth(badTree);
      assert.ok(health.errorCount >= 1);
      assert.ok(health.anomalies.some((a) => a.code === 'death_before_birth'));
      assert.strictEqual(health.status, 'critical');
    });

    it('detects child born after mother death error', () => {
      const badTree: TreeData = {
        id: 'bad-2',
        name: 'Bad Tree 2',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          m: { id: 'm', firstName: 'Mother', lastName: 'Test', gender: 'female', birthDate: '1950', deathDate: '1980', isDeceased: true, unionIds: ['u1'] },
          c: { id: 'c', firstName: 'Child', lastName: 'Test', birthDate: '1985', parentUnionId: 'u1', unionIds: [] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['m'], childrenIds: ['c'] },
        },
      };

      const health = auditTreeHealth(badTree);
      assert.ok(health.errorCount >= 1);
      assert.ok(health.anomalies.some((a) => a.code === 'born_after_parent_death'));
    });

    it('detects parent too young warning (< 13 at child birth)', () => {
      const badTree: TreeData = {
        id: 'bad-3',
        name: 'Bad Tree 3',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          p: { id: 'p', firstName: 'Young', lastName: 'Parent', birthDate: '1990', unionIds: ['u1'] },
          c: { id: 'c', firstName: 'Baby', lastName: 'Parent', birthDate: '1999', parentUnionId: 'u1', unionIds: [] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p'], childrenIds: ['c'] },
        },
      };

      const health = auditTreeHealth(badTree);
      assert.ok(health.warningCount >= 1);
      assert.ok(health.anomalies.some((a) => a.code === 'parent_too_young'));
    });

    it('detects unlikely centenarian warning (> 115 and living)', () => {
      const badTree: TreeData = {
        id: 'bad-4',
        name: 'Ancient Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          p: { id: 'p', firstName: 'Ancient', lastName: 'Ancestor', birthDate: '1880-01-01', isDeceased: false, unionIds: [] },
        },
        unions: {},
      };

      const health = auditTreeHealth(badTree);
      assert.ok(health.anomalies.some((a) => a.code === 'unlikely_centenarian'));
    });

    it('detects potential duplicate persons', () => {
      const dupTree: TreeData = {
        id: 'dup-1',
        name: 'Duplicate Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          p1: { id: 'p1', firstName: 'William', lastName: 'Shakespeare', birthDate: '1564', unionIds: [] },
          p2: { id: 'p2', firstName: 'William', lastName: 'Shakespeare', birthDate: '1564', unionIds: [] },
        },
        unions: {},
      };

      const health = auditTreeHealth(dupTree);
      assert.ok(health.anomalies.some((a) => a.code === 'potential_duplicate'));
    });

    it('detects cyclic pedigree (person is own ancestor)', () => {
      const cycleTree: TreeData = {
        id: 'cycle-1',
        name: 'Cycle Tree',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          p1: { id: 'p1', firstName: 'LoopA', lastName: 'Cycle', parentUnionId: 'u2', unionIds: ['u1'] },
          p2: { id: 'p2', firstName: 'LoopB', lastName: 'Cycle', parentUnionId: 'u1', unionIds: ['u2'] },
        },
        unions: {
          u1: { id: 'u1', partnerIds: ['p1'], childrenIds: ['p2'] },
          u2: { id: 'u2', partnerIds: ['p2'], childrenIds: ['p1'] },
        },
      };

      const health = auditTreeHealth(cycleTree);
      assert.ok(health.errorCount >= 1);
      assert.ok(health.anomalies.some((a) => a.code === 'cyclic_pedigree'));
    });
  });

  describe('generateHealthReportMarkdown', () => {
    it('produces formatted markdown containing score and sections', () => {
      const sampleTree: TreeData = {
        id: 'sample',
        name: 'Smith Dynasty',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        people: {
          p1: { id: 'p1', firstName: 'Bob', lastName: 'Smith', gender: 'male', birthDate: '1970', unionIds: [] },
        },
        unions: {},
      };

      const md = generateHealthReportMarkdown(sampleTree);
      assert.ok(md.includes('# Family Tree Report: Smith Dynasty'));
      assert.ok(md.includes('Overall Health Score'));
      assert.ok(md.includes('Demographics & Population'));
    });
  });
});
