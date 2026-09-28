import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateTreeSvgString } from '../src/services/treeExportService.ts';
import { createDoubleInLawPreset } from '../src/services/storage.ts';
import { computeLayout } from '../src/services/layoutEngine.ts';

describe('treeExportService', () => {
  it('generates valid SVG XML string for a tree layout', () => {
    const tree = createDoubleInLawPreset();
    const layout = computeLayout(tree, 'vertical');

    const svgString = generateTreeSvgString(tree, layout, false);

    assert.ok(svgString.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Should start with XML declaration');
    assert.ok(svgString.includes('<svg xmlns="http://www.w3.org/2000/svg"'), 'Should contain SVG root element');
    assert.ok(svgString.includes('viewBox='), 'Should have viewBox calculated');
    assert.ok(svgString.includes('id="tree-header"'), 'Should contain tree title header banner');
    assert.ok(svgString.includes(tree.name), 'Should include tree name in header');
    assert.ok(svgString.includes('id="tree-edges"'), 'Should include connector edges group');
    assert.ok(svgString.includes('id="tree-nodes"'), 'Should include person nodes group');
    assert.ok(svgString.endsWith('</svg>'), 'Should terminate with </svg>');
  });

  it('adapts colors for dark theme', () => {
    const tree = createDoubleInLawPreset();
    const layout = computeLayout(tree, 'vertical');

    const lightSvg = generateTreeSvgString(tree, layout, false);
    const darkSvg = generateTreeSvgString(tree, layout, true);

    assert.ok(lightSvg.includes('fill="#f8fafc"'), 'Light mode background');
    assert.ok(darkSvg.includes('fill="#020617"'), 'Dark mode background');
  });

  it('escapes special characters in person names', () => {
    const tree = createDoubleInLawPreset();
    const firstPersonId = Object.keys(tree.people)[0];
    tree.people[firstPersonId].firstName = 'Tom & Jerry <Special>';

    const layout = computeLayout(tree, 'vertical');
    const svgString = generateTreeSvgString(tree, layout, false);

    assert.ok(svgString.includes('Tom &amp; Jerry &lt;Special&gt;'), 'Special characters should be escaped in XML');
    assert.ok(!svgString.includes('Tom & Jerry <Special>'), 'Raw unescaped chars should not exist in text');
  });

  it('preserves non-Latin unicode characters in sanitizeFilename (Bug 4.5)', async () => {
    const { sanitizeFilename } = await import('../src/services/storage.ts');

    assert.equal(sanitizeFilename('Famille François'), 'Famille_François');
    assert.equal(sanitizeFilename('Παπαδόπουλος'), 'Παπαδόπουλος');
    assert.equal(sanitizeFilename('Русское Дерево'), 'Русское_Дерево');
    assert.equal(sanitizeFilename('עץ משפחה'), 'עץ_משפחה');
    assert.equal(sanitizeFilename('شجرة العائلة'), 'شجرة_العائلة');
    assert.equal(sanitizeFilename('田中家族'), '田中家族');
    assert.equal(sanitizeFilename('Tree /:?*<>| "name"'), 'Tree_name');
    assert.equal(sanitizeFilename(''), 'family_tree');
    assert.equal(sanitizeFilename(undefined), 'family_tree');
  });

  it('renders custom photo avatar image element and clipPath when person has avatarUrl (Bug 4.6)', () => {
    const tree = createDoubleInLawPreset();
    const firstPersonId = Object.keys(tree.people)[0];
    tree.people[firstPersonId].avatarUrl = 'https://example.com/photo.jpg';

    const layout = computeLayout(tree, 'vertical');
    const svgString = generateTreeSvgString(tree, layout, false);

    assert.ok(
      svgString.includes(`id="avatar-clip-${firstPersonId}"`),
      'Should define clipPath for custom avatar'
    );
    assert.ok(
      svgString.includes(`href="https://example.com/photo.jpg"`),
      'Should render image tag with avatar source'
    );
    assert.ok(
      svgString.includes(`clip-path="url(#avatar-clip-${firstPersonId})"`),
      'Should link image to circular clip-path'
    );
  });
});
