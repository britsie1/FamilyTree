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
});
