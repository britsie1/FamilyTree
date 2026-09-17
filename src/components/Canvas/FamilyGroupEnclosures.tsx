import React from 'react';
import type { FamilyGroup } from '../../types/tree';

interface FamilyGroupEnclosuresProps {
  familyGroups?: FamilyGroup[];
}

export const FamilyGroupEnclosures: React.FC<FamilyGroupEnclosuresProps> = ({ familyGroups }) => {
  if (!familyGroups || familyGroups.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {familyGroups.map((group) => {
        if (!group.bounds || group.bounds.width <= 0 || group.bounds.height <= 0) {
          return null;
        }

        const { minX, minY, width, height } = group.bounds;

        return (
          <div
            key={group.id}
            data-testid={`family-group-enclosure-${group.id}`}
            className="absolute rounded-3xl transition-all duration-300 pointer-events-none"
            style={{
              left: `${minX}px`,
              top: `${minY}px`,
              width: `${width}px`,
              height: `${height}px`,
              backgroundColor: group.bgColor,
              border: `2px dashed ${group.borderColor}`,
              boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.03)',
            }}
          >
            {/* Floating Family Branch Legend Badge */}
            <div
              className="absolute -top-3.5 left-6 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold shadow-sm border bg-white dark:bg-slate-900 backdrop-blur-sm pointer-events-none select-none"
              style={{
                borderColor: group.borderColor,
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
                style={{ backgroundColor: group.color }}
              />
              <span style={{ color: group.color }} className="font-bold tracking-tight">
                {group.name}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                ({group.memberIds.length} {group.memberIds.length === 1 ? 'member' : 'members'})
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
