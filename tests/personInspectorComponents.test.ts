import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as InspectorModules from '../src/components/Inspector/index.ts';

describe('Inspector Modular Architecture', () => {
  it('exports PersonInspector container and all modular inspector subcomponents', () => {
    assert.ok(InspectorModules.PersonInspector, 'PersonInspector should be exported');
    assert.ok(InspectorModules.PersonHeader, 'PersonHeader should be exported');
    assert.ok(InspectorModules.PersonBioSection, 'PersonBioSection should be exported');
    assert.ok(InspectorModules.PersonVitalDatesSection, 'PersonVitalDatesSection should be exported');
    assert.ok(InspectorModules.PersonRelationshipsSection, 'PersonRelationshipsSection should be exported');
    assert.ok(InspectorModules.PersonDocumentsSection, 'PersonDocumentsSection should be exported');
    assert.ok(InspectorModules.PersonCrossTreeLinksSection, 'PersonCrossTreeLinksSection should be exported');
  });

  it('all subcomponents are valid React functional components', () => {
    assert.strictEqual(typeof InspectorModules.PersonInspector, 'function');
    assert.strictEqual(typeof InspectorModules.PersonHeader, 'function');
    assert.strictEqual(typeof InspectorModules.PersonBioSection, 'function');
    assert.strictEqual(typeof InspectorModules.PersonVitalDatesSection, 'function');
    assert.strictEqual(typeof InspectorModules.PersonRelationshipsSection, 'function');
    assert.strictEqual(typeof InspectorModules.PersonDocumentsSection, 'function');
    assert.strictEqual(typeof InspectorModules.PersonCrossTreeLinksSection, 'function');
  });
});
