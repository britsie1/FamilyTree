import React from 'react';

export interface CompassRoseProps {
  size?: number;
  className?: string;
  opacity?: number;
}

export const CompassRose: React.FC<CompassRoseProps> = ({
  size = 200,
  className = '',
  opacity = 0.55,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-100 -100 200 200"
      className={`select-none pointer-events-none ${className}`}
      style={{ opacity }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Gradients for antique brass / copper effect */}
        <radialGradient id="compass-center-glow" cx="0" cy="0" r="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fdf6e2" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#f4ebd0" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f4ebd0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gold-leaf-dark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="gold-leaf-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>

      {/* Background Soft Glow */}
      <circle cx="0" cy="0" r="92" fill="url(#compass-center-glow)" />

      {/* Outer Astronomical Ring */}
      <circle
        cx="0"
        cy="0"
        r="88"
        fill="none"
        stroke="#8c6d46"
        strokeWidth="1.2"
        strokeDasharray="1.5 3"
      />
      <circle cx="0" cy="0" r="84" fill="none" stroke="#6e4d2a" strokeWidth="1.8" />
      <circle cx="0" cy="0" r="80" fill="none" stroke="#8c6d46" strokeWidth="0.8" />

      {/* 360 Degree Ticks */}
      {Array.from({ length: 36 }).map((_, i) => {
        const angle = i * 10;
        const isMajor = i % 9 === 0;
        const r1 = isMajor ? 74 : 77;
        const r2 = 80;
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={`tick_${i}`}
            x1={r1 * Math.cos(rad)}
            y1={r1 * Math.sin(rad)}
            x2={r2 * Math.cos(rad)}
            y2={r2 * Math.sin(rad)}
            stroke="#6e4d2a"
            strokeWidth={isMajor ? 1.5 : 0.75}
          />
        );
      })}

      {/* Secondary 16-point points (NW, NE, SW, SE) */}
      <g>
        {/* NW-SE & NE-SW 45-degree points */}
        <polygon points="0,0 -12,-12 0,-62 0,0" fill="#9a7b56" />
        <polygon points="0,0 0,-62 12,-12 0,0" fill="#c4a47c" />

        <polygon points="0,0 12,-12 62,0 0,0" fill="#9a7b56" />
        <polygon points="0,0 62,0 12,12 0,0" fill="#c4a47c" />

        <polygon points="0,0 12,12 0,62 0,0" fill="#9a7b56" />
        <polygon points="0,0 0,62 -12,12 0,0" fill="#c4a47c" />

        <polygon points="0,0 -12,12 -62,0 0,0" fill="#9a7b56" />
        <polygon points="0,0 -62,0 -12,-12 0,0" fill="#c4a47c" />
      </g>

      {/* Inner Ring */}
      <circle cx="0" cy="0" r="42" fill="none" stroke="#7a5530" strokeWidth="1" />
      <circle cx="0" cy="0" r="38" fill="none" stroke="#9c7a52" strokeWidth="0.8" strokeDasharray="2 2" />

      {/* Primary 4 Major Cardinal Points (North, South, East, West) */}
      {/* North Arrow */}
      <polygon points="0,0 -10,-10 0,-78 0,0" fill="#78350f" />
      <polygon points="0,0 0,-78 10,-10 0,0" fill="#b45309" />

      {/* East Arrow */}
      <polygon points="0,0 10,-10 78,0 0,0" fill="#78350f" />
      <polygon points="0,0 78,0 10,10 0,0" fill="#b45309" />

      {/* South Arrow */}
      <polygon points="0,0 10,10 0,78 0,0" fill="#78350f" />
      <polygon points="0,0 0,78 -10,10 0,0" fill="#b45309" />

      {/* West Arrow */}
      <polygon points="0,0 -10,10 -78,0 0,0" fill="#78350f" />
      <polygon points="0,0 -78,0 -10,-10 0,0" fill="#b45309" />

      {/* Ornate Fleur-de-lis on North */}
      <g transform="translate(0, -82) scale(0.65)">
        <path
          d="M0,-14 C3,-9 7,-5 7,0 C7,4 4,7 0,7 C-4,7 -7,4 -7,0 C-7,-5 -3,-9 0,-14 Z"
          fill="#b45309"
        />
        <path
          d="M-4,0 C-9,-3 -13,-1 -13,3 C-13,7 -8,9 -4,7 Z"
          fill="#92400e"
        />
        <path
          d="M4,0 C9,-3 13,-1 13,3 C13,7 8,9 4,7 Z"
          fill="#d97706"
        />
        <rect x="-6" y="5" width="12" height="2" fill="#78350f" rx="1" />
      </g>

      {/* Center Boss / Medallion */}
      <circle cx="0" cy="0" r="14" fill="#603813" stroke="#b45309" strokeWidth="1.5" />
      <circle cx="0" cy="0" r="8" fill="#d97706" />
      <circle cx="0" cy="0" r="3.5" fill="#fef3c7" />

      {/* Cardinal Labels */}
      <text
        x="0"
        y="-64"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#5a3714"
        fontSize="12"
        fontWeight="bold"
        fontFamily="'Cinzel', 'EB Garamond', Georgia, serif"
      >
        N
      </text>
      <text
        x="67"
        y="1"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#5a3714"
        fontSize="11"
        fontWeight="bold"
        fontFamily="'Cinzel', 'EB Garamond', Georgia, serif"
      >
        E
      </text>
      <text
        x="0"
        y="67"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#5a3714"
        fontSize="11"
        fontWeight="bold"
        fontFamily="'Cinzel', 'EB Garamond', Georgia, serif"
      >
        S
      </text>
      <text
        x="-67"
        y="1"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#5a3714"
        fontSize="11"
        fontWeight="bold"
        fontFamily="'Cinzel', 'EB Garamond', Georgia, serif"
      >
        W
      </text>
    </svg>
  );
};
