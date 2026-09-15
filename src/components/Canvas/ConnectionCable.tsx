import React from 'react';

export type PortType = 'parent' | 'child' | 'partner' | 'sibling';

interface ConnectionCableProps {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  portType: PortType;
  hoveredTargetName?: string | null;
}

export const ConnectionCable: React.FC<ConnectionCableProps> = ({
  startX,
  startY,
  currentX,
  currentY,
  portType,
  hoveredTargetName,
}) => {
  const dx = currentX - startX;
  const dy = currentY - startY;

  // Compute smooth cubic Bezier curve based on port type direction
  let p1x = startX;
  let p1y = startY;
  let p2x = currentX;
  let p2y = currentY;

  if (portType === 'child') {
    // Flows downwards
    const bend = Math.max(Math.abs(dy) * 0.5, 40);
    p1y = startY + bend;
    p2y = currentY - bend;
  } else if (portType === 'parent') {
    // Flows upwards
    const bend = Math.max(Math.abs(dy) * 0.5, 40);
    p1y = startY - bend;
    p2y = currentY + bend;
  } else {
    // Flows sideways (partner or sibling)
    const bend = Math.max(Math.abs(dx) * 0.5, 40);
    p1x = startX + (dx >= 0 ? bend : -bend);
    p2x = currentX + (dx >= 0 ? -bend : bend);
  }

  const pathD = `M ${startX} ${startY} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${currentX} ${currentY}`;

  const strokeColor =
    portType === 'child'
      ? '#4f46e5' // Indigo
      : portType === 'partner'
      ? '#e11d48' // Rose
      : portType === 'sibling'
      ? '#d97706' // Amber
      : '#0284c7'; // Sky (parent)

  return (
    <g className="pointer-events-none select-none z-50">
      {/* Outer soft glow line */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={7}
        strokeOpacity={0.25}
        strokeLinecap="round"
      />

      {/* Main dashed animated connection cable */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={3}
        strokeDasharray="6 4"
        strokeLinecap="round"
        className="animate-[dash_1s_linear_infinite]"
      />

      {/* Origin anchor dot */}
      <circle cx={startX} cy={startY} r={5} fill={strokeColor} stroke="#ffffff" strokeWidth={2} />

      {/* Target endpoint ring / beacon */}
      <circle
        cx={currentX}
        cy={currentY}
        r={9}
        fill={strokeColor}
        fillOpacity={0.3}
        stroke={strokeColor}
        strokeWidth={2}
      />
      <circle cx={currentX} cy={currentY} r={3.5} fill="#ffffff" />

      {/* Floating tooltip badge near endpoint */}
      <foreignObject
        x={currentX + 16}
        y={currentY - 14}
        width={220}
        height={40}
        className="overflow-visible pointer-events-none"
      >
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold text-white shadow-xl backdrop-blur-md whitespace-nowrap bg-slate-900/90 border border-slate-700/60">
          <span
            className="w-2 h-2 rounded-full animate-ping"
            style={{ backgroundColor: strokeColor }}
          />
          {hoveredTargetName ? (
            <span>Link with <strong>{hoveredTargetName}</strong></span>
          ) : (
            <span>Release to add <strong>{portType}</strong></span>
          )}
        </div>
      </foreignObject>
    </g>
  );
};
