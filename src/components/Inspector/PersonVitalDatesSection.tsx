import React from 'react';
import type { Person, TreeData } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import { extractYear } from '../../services/temporalEngine';
import { calculateAge } from '../../services/dateUtils';
import { DatePartsInput } from '../Common/DatePartsInput';
import { useTreeStore } from '../../stores/useTreeStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { useTemporalStore } from '../../stores/useTemporalStore';
import { Calendar, MapPin, Clock, Sparkles } from 'lucide-react';

export interface PersonVitalDatesSectionProps {
  person: Person;
  tree?: TreeData;
  isReadOnly?: boolean;
  onUpdatePerson?: (personId: string, updates: Partial<Person>) => void;
  onJumpToYear?: (year: number, moment?: any) => void;
}

export const PersonVitalDatesSection: React.FC<PersonVitalDatesSectionProps> = ({
  person,
  tree: propTree,
  isReadOnly: propIsReadOnly,
  onUpdatePerson,
  onJumpToYear,
}) => {
  // Store access
  const storeTree = useTreeStore((s) => s.tree);
  const storeUpdatePerson = useTreeStore((s) => s.updatePerson);
  const storeUserPermission = useCollabStore((s) => s.userPermission);
  const storeJumpToYear = useTemporalStore((s) => s.jumpToYear);

  const tree = propTree || storeTree;
  const isReadOnly = propIsReadOnly !== undefined ? propIsReadOnly : storeUserPermission === 'viewer';
  const handleUpdate = onUpdatePerson || storeUpdatePerson;
  const handleJumpToYear = onJumpToYear || storeJumpToYear;

  const displayName = getPersonDisplayName(person);

  // Calculate age badge
  const renderAgeBadge = () => {
    if (person.birthDate && person.deathDate) {
      const ageAtDeath = calculateAge(person.birthDate, person.deathDate);
      return ageAtDeath !== null ? (
        <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
          Age {ageAtDeath} at death
        </span>
      ) : null;
    }
    if (person.birthDate && !person.isDeceased) {
      const currentAge = calculateAge(person.birthDate);
      return currentAge !== null ? (
        <span className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
          Age {currentAge}
        </span>
      ) : null;
    }
    return null;
  };

  // 4D Life Milestones & "Who Was in the Room?"
  const bYear = extractYear(person.birthDate);
  const dYear = extractYear(person.deathDate);
  const currentYear = new Date().getFullYear();

  const milestones: { label: string; year: number; type: 'birth' | 'birthday' | 'wedding' | 'memorial' }[] = [];

  if (bYear) {
    milestones.push({ label: `Birth (${bYear})`, year: bYear, type: 'birth' });
    [18, 50, 80].forEach((age) => {
      const y = bYear + age;
      if (y <= currentYear && (!dYear || y <= dYear)) {
        milestones.push({ label: `${age}th Birthday (${y})`, year: y, type: 'birthday' });
      }
    });
  }

  person.unionIds.forEach((uId) => {
    const u = tree.unions[uId];
    if (u) {
      const mYear = extractYear(u.marriageDate);
      if (mYear) {
        milestones.push({ label: `Wedding (${mYear})`, year: mYear, type: 'wedding' });
      }
    }
  });

  if (dYear) {
    milestones.push({ label: `Memorial (${dYear})`, year: dYear, type: 'memorial' });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Life & Dates</h4>
          {renderAgeBadge()}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={person.isDeceased || false}
            disabled={isReadOnly}
            onChange={(e) => handleUpdate(person.id, { isDeceased: e.target.checked })}
            className="rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
          />
          Deceased
        </label>
      </div>

      {/* Birth */}
      <div className="space-y-2 bg-slate-50/50 dark:bg-slate-850/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
        <DatePartsInput
          label="Birth Date"
          icon={<Calendar className="w-3 h-3 text-slate-400" />}
          value={person.birthDate}
          onChange={(val) => handleUpdate(person.id, { birthDate: val })}
          disabled={isReadOnly}
          yearPlaceholder="Birth Year (YYYY)"
        />
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-400" /> Birth Place
          </label>
          <input
            type="text"
            value={person.birthPlace || ''}
            onChange={(e) => handleUpdate(person.id, { birthPlace: e.target.value })}
            placeholder="City, Country"
            disabled={isReadOnly}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800/50"
          />
        </div>
      </div>

      {/* Death (if deceased) */}
      {person.isDeceased && (
        <div className="space-y-2 bg-slate-50/50 dark:bg-slate-850/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
          <DatePartsInput
            label="Death Date"
            icon={<Calendar className="w-3 h-3 text-slate-400" />}
            value={person.deathDate}
            onChange={(val) => handleUpdate(person.id, { deathDate: val })}
            disabled={isReadOnly}
            yearPlaceholder="Death Year (YYYY)"
          />
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" /> Death Place
            </label>
            <input
              type="text"
              value={person.deathPlace || ''}
              onChange={(e) => handleUpdate(person.id, { deathPlace: e.target.value })}
              placeholder="City, Country"
              disabled={isReadOnly}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800/50"
            />
          </div>
        </div>
      )}

      {/* 4D Life Milestones & "Who Was in the Room?" */}
      {milestones.length > 0 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-xl p-3 space-y-2 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Life Milestones (&quot;Who Was in the Room?&quot;)
            </span>
          </div>
          <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 leading-tight">
            Click any milestone to illuminate who was alive in the world to attend:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {milestones.map((m, idx) => (
              <button
                key={idx}
                onClick={() => {
                  handleJumpToYear(m.year, {
                    id: `inspector_moment_${person.id}_${m.year}`,
                    year: m.year,
                    title: `${displayName}'s ${m.label}`,
                    type: m.type,
                    personId: person.id,
                  });
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700 px-2 py-1 rounded-lg shadow-2xs transition-all hover:scale-102 cursor-pointer"
                title={`Jump to ${m.year} and see living relatives`}
              >
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
