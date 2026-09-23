import type { TreeData, TreeLayout } from '../types/tree';
import { getPersonDisplayInfo } from './displayUtils';
import confetti from 'canvas-confetti';

/**
 * Escapes special XML characters for safe SVG embedding.
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

/**
 * Generates a clean, standalone, standards-compliant SVG document of the full family tree.
 */
export function generateTreeSvgString(
  tree: TreeData,
  layout: TreeLayout,
  isDark: boolean = false
): string {
  const bounds = layout.bounds;
  const padding = 80;
  const headerHeight = 90;

  const minX = (bounds.minX || 0) - padding;
  const minY = (bounds.minY || 0) - padding - headerHeight;
  const width = Math.max((bounds.width || 800) + padding * 2, 600);
  const height = Math.max((bounds.height || 600) + padding * 2 + headerHeight, 400);

  const bgColor = isDark ? '#020617' : '#f8fafc';
  const headerBg = isDark ? '#0f172a' : '#ffffff';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subtextColor = isDark ? '#94a3b8' : '#64748b';
  const edgeColor = isDark ? '#64748b' : '#94a3b8';
  const gridDotColor = isDark ? '#1e293b' : '#e2e8f0';

  const totalPeople = Object.keys(tree.people).length;
  const totalUnions = Object.keys(tree.unions).length;
  const exportDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const parts: string[] = [];

  // XML & SVG Declaration
  parts.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">`,
    `  <defs>`,
    `    <pattern id="grid-dots" width="32" height="32" patternUnits="userSpaceOnUse">`,
    `      <circle cx="2" cy="2" r="1.2" fill="${gridDotColor}" />`,
    `    </pattern>`,
    `    <filter id="card-shadow" x="-5%" y="-5%" width="115%" height="120%">`,
    `      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="${isDark ? '0.5' : '0.08'}" />`,
    `    </filter>`,
    `  </defs>`,
    `  <!-- Canvas Background -->`,
    `  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${bgColor}" />`,
    `  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="url(#grid-dots)" opacity="0.6" />`
  );

  // Title & Metadata Header
  parts.push(
    `  <!-- Tree Title Banner -->`,
    `  <g id="tree-header" transform="translate(${minX + padding}, ${minY + padding})">`,
    `    <rect x="0" y="0" width="${width - padding * 2}" height="64" rx="16" fill="${headerBg}" stroke="${cardBorder}" stroke-width="1" filter="url(#card-shadow)" />`,
    `    <circle cx="32" cy="32" r="16" fill="#4f46e5" />`,
    `    <path d="M26 32 L38 32 M32 26 L32 38" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />`,
    `    <text x="60" y="28" font-size="16" font-weight="bold" fill="${textColor}">${escapeXml(tree.name || 'Family Tree')}</text>`,
    `    <text x="60" y="47" font-size="11" fill="${subtextColor}">${totalPeople} relatives • ${totalUnions} unions • Generated on ${exportDate}</text>`,
    `  </g>`
  );

  // Connector Edges (Relationship Lines & Bridges)
  parts.push(`  <!-- Connector Edges -->`, `  <g id="tree-edges">`);
  for (const edge of layout.edges) {
    const stroke = edge.color || edgeColor;
    const strokeWidth = edge.isHighlighted ? 3 : 2;
    parts.push(
      `    <path d="${edge.pathD}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`
    );
  }
  parts.push(`  </g>`);

  // Union Nodes
  parts.push(`  <!-- Union Points -->`, `  <g id="tree-unions">`);
  for (const u of Object.values(layout.unions)) {
    parts.push(
      `    <circle cx="${u.x}" cy="${u.y}" r="4" fill="${cardBg}" stroke="#4f46e5" stroke-width="2" />`
    );
  }
  parts.push(`  </g>`);

  // Person Cards
  parts.push(`  <!-- Person Cards -->`, `  <g id="tree-nodes">`);
  for (const node of Object.values(layout.nodes)) {
    const person = node.data;
    const displayInfo = node.displayInfo ?? getPersonDisplayInfo(person);
    const { displayName, birthYear, deathYear, initials } = displayInfo;

    const gender = person.gender || 'other';
    let genderAccent = '#6366f1';
    let avatarFill = isDark ? '#1e1b4b' : '#e0e7ff';
    let avatarTextColor = isDark ? '#a5b4fc' : '#4338ca';

    if (gender === 'male') {
      genderAccent = '#3b82f6';
      avatarFill = isDark ? '#172554' : '#dbeafe';
      avatarTextColor = isDark ? '#93c5fd' : '#1d4ed8';
    } else if (gender === 'female') {
      genderAccent = '#f43f5e';
      avatarFill = isDark ? '#4c0519' : '#ffe4e6';
      avatarTextColor = isDark ? '#fda4af' : '#be123c';
    }

    let dateSpan = '';
    if (birthYear || deathYear) {
      dateSpan = `${birthYear || '?'} - ${deathYear || (person.isDeceased ? '?' : 'Present')}`;
    }

    parts.push(
      `    <g id="person-${person.id}" transform="translate(${node.x}, ${node.y})" filter="url(#card-shadow)">`,
      `      <!-- Card Base -->`,
      `      <rect x="0" y="0" width="${node.width}" height="${node.height}" rx="12" fill="${cardBg}" stroke="${cardBorder}" stroke-width="1" />`,
      `      <!-- Gender Accent Line -->`,
      `      <path d="M0 12 Q0 0 12 0 L12 ${node.height} Q0 ${node.height} 0 ${node.height - 12} Z" fill="${genderAccent}" />`,
      `      <!-- Avatar Circle -->`,
      `      <circle cx="34" cy="${node.height / 2}" r="18" fill="${avatarFill}" stroke="${genderAccent}" stroke-width="1.5" />`,
      `      <text x="34" y="${node.height / 2 + 4}" font-size="11" font-weight="bold" fill="${avatarTextColor}" text-anchor="middle">${escapeXml(initials || '?')}</text>`,
      `      <!-- Name -->`,
      `      <text x="62" y="${dateSpan ? node.height / 2 - 2 : node.height / 2 + 5}" font-size="12" font-weight="600" fill="${textColor}">${escapeXml(displayName)}</text>`
    );

    if (dateSpan) {
      parts.push(
        `      <!-- Lifespan Dates -->`,
        `      <text x="62" y="${node.height / 2 + 14}" font-size="10" font-family="monospace" fill="${subtextColor}">${escapeXml(dateSpan)}</text>`
      );
    }

    parts.push(`    </g>`);
  }
  parts.push(`  </g>`);

  // Close SVG
  parts.push(`</svg>`);

  return parts.join('\n');
}

/**
 * Downloads a crisp, infinite-resolution standalone SVG file.
 */
export function exportTreeAsSvg(
  tree: TreeData,
  layout: TreeLayout,
  isDark: boolean = false
): void {
  const svgContent = generateTreeSvgString(tree, layout, isDark);
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const filename = `${(tree.name || 'family_tree').replace(/[^a-zA-Z0-9_-]/g, '_')}_vector.svg`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
}

/**
 * Renders the full unclipped tree layout at high resolution onto an HTML5 Canvas and downloads as PNG.
 */
export async function exportTreeAsFullImage(
  tree: TreeData,
  layout: TreeLayout,
  isDark: boolean = false
): Promise<void> {
  const svgString = generateTreeSvgString(tree, layout, isDark);
  const bounds = layout.bounds;
  const padding = 80;
  const headerHeight = 90;
  const width = Math.max((bounds.width || 800) + padding * 2, 600);
  const height = Math.max((bounds.height || 600) + padding * 2 + headerHeight, 400);

  // 2x device pixel ratio scale for sharp high-DPI rasterization
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not supported');
  }

  ctx.scale(scale, scale);

  const img = new Image();
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });

  const pngUrl = canvas.toDataURL('image/png', 0.95);
  const filename = `${(tree.name || 'family_tree').replace(/[^a-zA-Z0-9_-]/g, '_')}_full.png`;

  const link = document.createElement('a');
  link.href = pngUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
}
