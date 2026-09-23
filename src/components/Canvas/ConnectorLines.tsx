import React, { useState } from 'react';
import type { LayoutEdge, LayoutUnion, LayoutStyle } from '../../types/tree';

interface ConnectorLinesProps {
  edges: LayoutEdge[];
  unions: Record<string, LayoutUnion>;
  selectedPersonId: string | null;
  hoveredPersonId: string | null;
  layoutStyle?: LayoutStyle;
  hoveredUnionId?: string | null;
  temporalYear?: number | null;
  relationshipPathIds?: string[];
  onHoverUnion?: (unionId: string | null) => void;
  onSelectUnion?: (unionId: string) => void;
  onAddChildToUnion?: (unionId: string) => void;
}

export const ConnectorLines: React.FC<ConnectorLinesProps> = ({
  edges,
  unions,
  selectedPersonId,
  hoveredPersonId,
  layoutStyle = 'vertical',
  hoveredUnionId,
  temporalYear = null,
  relationshipPathIds,
  onHoverUnion,
  onSelectUnion,
  onAddChildToUnion,
}) => {
  const [internalHoveredUnionId, setInternalHoveredUnionId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Compute all edges and unions along the relationship path
  const { pathEdgeIds, pathUnionIds } = React.useMemo(() => {
    const edgeIds = new Set<string>();
    const unionIds = new Set<string>();

    if (!relationshipPathIds || relationshipPathIds.length < 2) {
      return { pathEdgeIds: edgeIds, pathUnionIds: unionIds };
    }

    for (let i = 0; i < relationshipPathIds.length - 1; i++) {
      const p1 = relationshipPathIds[i];
      const p2 = relationshipPathIds[i + 1];

      // Check direct edges between p1 and p2
      for (const edge of edges) {
        if (
          (edge.sourceId === p1 && edge.targetId === p2) ||
          (edge.sourceId === p2 && edge.targetId === p1)
        ) {
          edgeIds.add(edge.id);
        }
      }

      // Check through unions
      for (const [uId, u] of Object.entries(unions)) {
        const isPartner1 = u.data.partnerIds.includes(p1);
        const isPartner2 = u.data.partnerIds.includes(p2);
        const isChild1 = u.data.childrenIds && u.data.childrenIds.includes(p1);
        const isChild2 = u.data.childrenIds && u.data.childrenIds.includes(p2);

        // Case A: p1 and p2 are spouses/partners in union u
        if (isPartner1 && isPartner2) {
          unionIds.add(uId);
          for (const edge of edges) {
            if (
              (edge.sourceId === p1 && edge.targetId === uId) ||
              (edge.sourceId === uId && edge.targetId === p1) ||
              (edge.sourceId === p2 && edge.targetId === uId) ||
              (edge.sourceId === uId && edge.targetId === p2)
            ) {
              edgeIds.add(edge.id);
            }
          }
        }

        // Case B: p1 is parent, p2 is child
        if (isPartner1 && isChild2) {
          unionIds.add(uId);
          for (const edge of edges) {
            if (
              (edge.sourceId === p1 && edge.targetId === uId) ||
              (edge.sourceId === uId && edge.targetId === p1) ||
              (edge.sourceId === uId && edge.targetId === p2) ||
              (edge.sourceId === p2 && edge.targetId === uId) ||
              (edge.sourceId === uId && edge.targetId === uId)
            ) {
              edgeIds.add(edge.id);
            }
          }
        }

        // Case C: p2 is parent, p1 is child
        if (isPartner2 && isChild1) {
          unionIds.add(uId);
          for (const edge of edges) {
            if (
              (edge.sourceId === p2 && edge.targetId === uId) ||
              (edge.sourceId === uId && edge.targetId === p2) ||
              (edge.sourceId === uId && edge.targetId === p1) ||
              (edge.sourceId === p1 && edge.targetId === uId) ||
              (edge.sourceId === uId && edge.targetId === uId)
            ) {
              edgeIds.add(edge.id);
            }
          }
        }

        // Case D: p1 and p2 are siblings (both children of union u)
        if (isChild1 && isChild2) {
          unionIds.add(uId);
          for (const edge of edges) {
            if (
              (edge.sourceId === uId && edge.targetId === p1) ||
              (edge.sourceId === p1 && edge.targetId === uId) ||
              (edge.sourceId === uId && edge.targetId === p2) ||
              (edge.sourceId === p2 && edge.targetId === uId) ||
              (edge.sourceId === uId && edge.targetId === uId && edge.id.includes('bus'))
            ) {
              edgeIds.add(edge.id);
            }
          }
        }
      }
    }

    return { pathEdgeIds: edgeIds, pathUnionIds: unionIds };
  }, [relationshipPathIds, edges, unions]);

  const activeUnionId = hoveredUnionId ?? internalHoveredUnionId;
  const activePersonId = hoveredPersonId || selectedPersonId;
  const hasActivePath = pathEdgeIds.size > 0;
  const hasAnyActive = Boolean(activePersonId || activeUnionId || hoveredEdgeId || hasActivePath);

  // Determine if edge should be highlighted
  const isEdgeHighlighted = (edge: LayoutEdge): boolean => {
    // 1. Direct edge hover
    if (hoveredEdgeId) {
      if (edge.id === hoveredEdgeId) return true;
      const hitEdge = edges.find((e) => e.id === hoveredEdgeId);
      if (hitEdge) {
        const uId = hitEdge.sourceId.startsWith('u_')
          ? hitEdge.sourceId
          : hitEdge.targetId.startsWith('u_')
          ? hitEdge.targetId
          : null;
        if (uId && (edge.sourceId === uId || edge.targetId === uId)) return true;
      }
    }

    // 2. Active union hover / selection
    if (activeUnionId) {
      if (edge.sourceId === activeUnionId || edge.targetId === activeUnionId) return true;
      const u = unions[activeUnionId];
      if (u && (u.data.partnerIds.includes(edge.sourceId) || u.data.partnerIds.includes(edge.targetId))) {
        return true;
      }
    }

    // 3. Active person hover / selection
    if (activePersonId) {
      if (edge.sourceId === activePersonId || edge.targetId === activePersonId) {
        return true;
      }

      const union = unions[edge.sourceId] || unions[edge.targetId];
      if (union) {
        if (union.data.partnerIds.includes(activePersonId)) return true;
        if (union.data.childrenIds.includes(activePersonId)) return true;
      }
    }

    return false;
  };

  const getEdgeStroke = (
    edge: LayoutEdge
  ): { strokeColor: string; strokeDash?: string; opacityMultiplier?: number } => {
    const isPartnerEdge = edge.edgeType === 'partner-union';
    const union = unions[edge.sourceId] || unions[edge.targetId];

    if (temporalYear !== null && union) {
      const mYear = union.data.marriageDate ? parseInt(union.data.marriageDate.split('-')[0], 10) : null;
      const dYear = union.data.divorceDate ? parseInt(union.data.divorceDate.split('-')[0], 10) : null;

      // Unmarried in temporal year: ghosted dashed connection
      if (isPartnerEdge && mYear && temporalYear < mYear) {
        return { strokeColor: '#94a3b8', strokeDash: '3 5', opacityMultiplier: 0.18 };
      }

      // If union divorced, but temporal year is before divorce year, they are still married!
      if (isPartnerEdge && union.data.type === 'divorced' && dYear && temporalYear < dYear) {
        return { strokeColor: edge.color || '#6366f1' };
      }
    }

    const isDivorced = edge.unionType === 'divorced';
    const isSeparated = edge.unionType === 'separated';

    if (isPartnerEdge) {
      if (isDivorced) return { strokeColor: '#ef4444', strokeDash: '6 4' };
      if (isSeparated) return { strokeColor: '#f59e0b', strokeDash: '4 4' };
      return { strokeColor: edge.color || '#6366f1' };
    }

    return { strokeColor: edge.color || '#64748b' };
  };

  // Junction Connection Dots: points where lines branch off the horizontal/vertical bus bar
  const isVertical = layoutStyle !== 'horizontal';
  const junctionDots: { id: string; x: number; y: number; color: string; isHighlighted: boolean }[] = [];

  Object.values(unions).forEach((union) => {
    if (union.childrenNodes.length === 0 || union.busCoord === undefined) return;

    const unionColor = union.color || '#6366f1';
    const isUnionActive =
      activeUnionId === union.id ||
      (activePersonId &&
        (union.data.partnerIds.includes(activePersonId) || union.data.childrenIds.includes(activePersonId))) ||
      (hoveredEdgeId &&
        (edges.find((e) => e.id === hoveredEdgeId)?.sourceId === union.id ||
          edges.find((e) => e.id === hoveredEdgeId)?.targetId === union.id));

    if (isVertical) {
      const busY = union.busCoord;
      // Stem meeting bus
      junctionDots.push({
        id: `dot_stem_${union.id}`,
        x: union.x,
        y: busY,
        color: unionColor,
        isHighlighted: Boolean(isUnionActive),
      });
      // Children drops branching from bus
      union.childrenNodes.forEach((child) => {
        junctionDots.push({
          id: `dot_child_${union.id}_${child.id}`,
          x: child.x + child.width / 2,
          y: busY,
          color: unionColor,
          isHighlighted: Boolean(isUnionActive),
        });
      });
    } else {
      const busX = union.busCoord;
      // Stem meeting bus
      junctionDots.push({
        id: `dot_stem_${union.id}`,
        x: busX,
        y: union.y,
        color: unionColor,
        isHighlighted: Boolean(isUnionActive),
      });
      // Children drops branching from bus
      union.childrenNodes.forEach((child) => {
        junctionDots.push({
          id: `dot_child_${union.id}_${child.id}`,
          x: busX,
          y: child.y + child.height / 2,
          color: unionColor,
          isHighlighted: Boolean(isUnionActive),
        });
      });
    }
  });

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <defs>
        {/* Glow filter for highlighted lines */}
        <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#6366f1" floodOpacity="0.75" />
        </filter>
      </defs>

      {/* Layer 1: Base Connector Lines */}
      {edges.map((edge) => {
        const highlighted = isEdgeHighlighted(edge);
        const isPath = pathEdgeIds.has(edge.id);
        if (highlighted || isPath) return null;

        const { strokeColor, strokeDash, opacityMultiplier } = getEdgeStroke(edge);
        const baseOpacity = hasActivePath ? 0.12 : hasAnyActive ? 0.22 : 0.85;
        const finalOpacity = opacityMultiplier !== undefined ? opacityMultiplier : baseOpacity;

        return (
          <path
            key={edge.id}
            d={edge.pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2.5}
            strokeDasharray={strokeDash}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={finalOpacity}
            className="transition-opacity duration-150"
          />
        );
      })}

      {/* Layer 2: Highlighted Foreground Lines with Glow Underlay */}
      {edges.map((edge) => {
        const highlighted = isEdgeHighlighted(edge);
        if (!highlighted || pathEdgeIds.has(edge.id)) return null;

        const { strokeColor, strokeDash } = getEdgeStroke(edge);

        return (
          <g key={`hl_group_${edge.id}`}>
            {/* Glow underlay */}
            <path
              d={edge.pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.35}
              className="transition-all duration-150"
            />
            {/* Crisp highlighted foreground line */}
            <path
              d={edge.pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={3.8}
              strokeDasharray={strokeDash}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-150"
            />
          </g>
        );
      })}

      {/* Layer 2.5: Highlighted Relationship Path Edges */}
      {edges.map((edge) => {
        if (!pathEdgeIds.has(edge.id)) return null;

        return (
          <g key={`path_edge_${edge.id}`} className="relationship-path-edge pointer-events-none">
            {/* Wide radiant glowing halo underlay */}
            <path
              d={edge.pathD}
              fill="none"
              stroke="#6366f1"
              strokeWidth={11}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.45}
              className="animate-pulse"
            />
            {/* High-contrast solid indigo path core */}
            <path
              d={edge.pathD}
              fill="none"
              stroke="#4338ca"
              strokeWidth={4.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Flowing animated dash tracer */}
            <path
              d={edge.pathD}
              fill="none"
              stroke="#e0e7ff"
              strokeWidth={2.5}
              strokeDasharray="7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="relationship-path-dash"
            />
          </g>
        );
      })}

      {/* Layer 3: Junction Connection Dots */}
      {junctionDots.map((dot) => {
        const isPathDot = Array.from(pathUnionIds).some((uId) => dot.id.includes(uId));
        return (
          <circle
            key={dot.id}
            cx={dot.x}
            cy={dot.y}
            r={isPathDot ? 5.5 : dot.isHighlighted ? 4.8 : 3.5}
            fill={isPathDot ? '#4f46e5' : dot.color}
            stroke="#ffffff"
            strokeWidth={isPathDot ? 2.2 : 1.6}
            opacity={hasActivePath && !isPathDot ? 0.15 : hasAnyActive && !dot.isHighlighted ? 0.22 : 1.0}
            className="transition-all duration-150"
          />
        );
      })}

      {/* Layer 4: Interactive Invisible Hit Areas for Connector Lines */}
      {edges.map((edge) => (
        <path
          key={`hit_${edge.id}`}
          d={edge.pathD}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onMouseEnter={() => setHoveredEdgeId(edge.id)}
          onMouseLeave={() => setHoveredEdgeId(null)}
        />
      ))}

      {/* Layer 5: Union Nodes (Marriage, Divorce, Partnership Anchors) */}
      {Object.values(unions).map((union) => {
        const isPartnerActive = activePersonId && union.data.partnerIds.includes(activePersonId);
        const isChildActive = activePersonId && union.data.childrenIds.includes(activePersonId);
        const isUnionHovered = activeUnionId === union.id;
        const isEdgeHitForUnion =
          hoveredEdgeId &&
          (edges.find((e) => e.id === hoveredEdgeId)?.sourceId === union.id ||
            edges.find((e) => e.id === hoveredEdgeId)?.targetId === union.id);
        const isPathUnion = pathUnionIds.has(union.id);
        const isActive = isPartnerActive || isChildActive || isUnionHovered || isEdgeHitForUnion || isPathUnion;

        const unionType = union.data.type || 'married';
        const isDivorced = unionType === 'divorced';
        const isSeparated = unionType === 'separated';

        // 4D Temporal evaluations
        const isTemporalActive = temporalYear !== null && temporalYear !== undefined;
        const marriageYearNum = union.data.marriageDate ? parseInt(union.data.marriageDate.split('-')[0], 10) : null;
        const divorceYearNum = union.data.divorceDate ? parseInt(union.data.divorceDate.split('-')[0], 10) : null;

        const isUnmarriedInYear = isTemporalActive && marriageYearNum !== null && temporalYear < marriageYearNum;
        const isJustWedInYear = isTemporalActive && marriageYearNum !== null && temporalYear === marriageYearNum;
        const isDivorcedEffective = !isTemporalActive
          ? isDivorced
          : isDivorced && (!divorceYearNum || temporalYear >= divorceYearNum);

        // Badge color scheme matches branch color for married couples
        const badgeColor = isUnmarriedInYear
          ? '#94a3b8'
          : isJustWedInYear
          ? '#f59e0b'
          : isDivorcedEffective
          ? '#ef4444'
          : isSeparated
          ? '#f59e0b'
          : union.color || '#6366f1';

        const activeBg = isDivorcedEffective ? '#ef4444' : isSeparated ? '#f59e0b' : union.color || '#4f46e5';

        // Divorce year if specified
        const divorceYear = union.data.divorceDate ? union.data.divorceDate.split('-')[0] : '';
        const marriageYear = union.data.marriageDate ? union.data.marriageDate.split('-')[0] : '';

        return (
          <g
            key={`union_${union.id}`}
            transform={`translate(${union.x}, ${union.y})`}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            className="group"
            onMouseEnter={() => {
              setInternalHoveredUnionId(union.id);
              onHoverUnion?.(union.id);
            }}
            onMouseLeave={() => {
              setInternalHoveredUnionId(null);
              onHoverUnion?.(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectUnion?.(union.id);
            }}
          >
            {/* If Divorced & effective in temporal year: Draw double diagonal divorce slash marks (//) across anchor */}
            {isDivorcedEffective && (
              <g stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round">
                <line x1={-20} y1={-7} x2={-14} y2={7} />
                <line x1={-16} y1={-7} x2={-10} y2={7} />
                <line x1={10} y1={-7} x2={16} y2={7} />
                <line x1={14} y1={-7} x2={20} y2={7} />
              </g>
            )}

            {/* If Separated: Draw single slash */}
            {isSeparated && !isUnmarriedInYear && (
              <g stroke="#f59e0b" strokeWidth={2} strokeLinecap="round">
                <line x1={-16} y1={-6} x2={-10} y2={6} />
                <line x1={10} y1={-6} x2={16} y2={6} />
              </g>
            )}

            {/* Celebratory golden halo rings if wed this exact year! */}
            {isJustWedInYear && (
              <>
                <circle r={18} fill="none" stroke="#f59e0b" strokeWidth={2} className="animate-ping opacity-60" />
                <circle r={16} fill="none" stroke="#f59e0b" strokeWidth={1.8} />
              </>
            )}

            {/* Glowing radar pulse if union connects relatives on the relationship path */}
            {isPathUnion && (
              <>
                <circle r={19} fill="none" stroke="#6366f1" strokeWidth={3} className="animate-ping opacity-60" />
                <circle r={16} fill="none" stroke="#818cf8" strokeWidth={2} className="animate-pulse opacity-85" />
              </>
            )}

            {/* Outer circle anchor badge */}
            <circle
              r={13}
              fill={isActive ? activeBg : isUnmarriedInYear ? '#f8fafc' : isJustWedInYear ? '#fef3c7' : '#ffffff'}
              stroke={isActive ? activeBg : badgeColor}
              strokeWidth={isJustWedInYear ? 2.5 : 2}
              strokeDasharray={isUnmarriedInYear ? '3 3' : undefined}
              opacity={isUnmarriedInYear ? 0.45 : 1}
              className="transition-all duration-150 shadow-sm group-hover:scale-115"
            />

            {/* Icon inside badge */}
            {isDivorcedEffective ? (
              // Broken / Slashed rings
              <g transform="translate(0, 0)">
                <circle
                  cx={-3.5}
                  cy={0}
                  r={4.5}
                  fill="none"
                  stroke={isActive ? '#ffffff' : '#ef4444'}
                  strokeWidth={1.8}
                />
                <circle
                  cx={3.5}
                  cy={0}
                  r={4.5}
                  fill="none"
                  stroke={isActive ? '#ffffff' : '#ef4444'}
                  strokeWidth={1.8}
                />
                {/* Diagonal lightning/crack slash */}
                <line
                  x1={-3}
                  y1={-5}
                  x2={3}
                  y2={5}
                  stroke={isActive ? '#ffffff' : '#ef4444'}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </g>
            ) : isSeparated && !isUnmarriedInYear ? (
              // Separated rings with gap
              <g transform="translate(0, 0)">
                <circle
                  cx={-4}
                  cy={0}
                  r={4.2}
                  fill="none"
                  stroke={isActive ? '#ffffff' : '#f59e0b'}
                  strokeWidth={1.8}
                />
                <circle
                  cx={4}
                  cy={0}
                  r={4.2}
                  fill="none"
                  stroke={isActive ? '#ffffff' : '#f59e0b'}
                  strokeWidth={1.8}
                />
              </g>
            ) : (
              // Interlocking wedding rings styled with branch color
              <g transform="translate(0, 0)" opacity={isUnmarriedInYear ? 0.4 : 1}>
                <circle
                  cx={-3.5}
                  cy={0}
                  r={4.5}
                  fill="none"
                  stroke={isActive ? '#ffffff' : isJustWedInYear ? '#d97706' : badgeColor}
                  strokeWidth={1.8}
                />
                <circle
                  cx={3.5}
                  cy={0}
                  r={4.5}
                  fill="none"
                  stroke={isActive ? '#ffffff' : isJustWedInYear ? '#d97706' : badgeColor}
                  strokeWidth={1.8}
                />
              </g>
            )}

            {/* Text pill for divorce or dates */}
            {isDivorcedEffective && (
              <g transform="translate(0, 22)">
                <rect
                  x={-28}
                  y={-7}
                  width={56}
                  height={14}
                  rx={7}
                  fill="#fee2e2"
                  stroke="#ef4444"
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={3.5}
                  textAnchor="middle"
                  fill="#991b1b"
                  fontSize={8}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {divorceYear ? `DIV. ${divorceYear}` : 'DIVORCED'}
                </text>
              </g>
            )}

            {isJustWedInYear && (
              <g transform="translate(0, 22)">
                <rect
                  x={-34}
                  y={-7}
                  width={68}
                  height={14}
                  rx={7}
                  fill="#fef3c7"
                  stroke="#f59e0b"
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={3.5}
                  textAnchor="middle"
                  fill="#92400e"
                  fontSize={8}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  WED {marriageYear} 💍
                </text>
              </g>
            )}

            {isUnmarriedInYear && (
              <g transform="translate(0, 22)">
                <rect
                  x={-34}
                  y={-7}
                  width={68}
                  height={14}
                  rx={7}
                  fill="#f1f5f9"
                  stroke="#94a3b8"
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={3.5}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize={7.5}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  UNMARRIED
                </text>
              </g>
            )}

            {!isDivorcedEffective && !isJustWedInYear && !isUnmarriedInYear && marriageYear && (
              <g transform="translate(0, 22)" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <rect
                  x={-24}
                  y={-7}
                  width={48}
                  height={14}
                  rx={7}
                  fill="#e0e7ff"
                  stroke={badgeColor}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={3.5}
                  textAnchor="middle"
                  fill="#3730a3"
                  fontSize={8}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  M. {marriageYear}
                </text>
              </g>
            )}

            {/* Quick add child button on union hover */}
            {onAddChildToUnion && (
              <g
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer"
                transform="translate(18, -12)"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChildToUnion(union.id);
                }}
              >
                <circle r={9} fill={badgeColor} className="opacity-90 hover:opacity-100 shadow-sm" />
                <line x1={-4} y1={0} x2={4} y2={0} stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
                <line x1={0} y1={-4} x2={0} y2={4} stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};
