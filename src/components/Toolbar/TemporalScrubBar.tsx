import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { TreeData } from '../../types/tree';
import {
  MAJOR_WORLD_EVENTS,
  getHistoricalMoments,
  computeRoomStats,
  getTreeYearBounds,
  type HistoricalMoment,
  type WorldEvent,
  getWorldEventsInYear,
} from '../../services/temporalEngine';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Sparkles,
  X,
  Globe,
  Heart,
  Baby,
  Cake,
  Users,
  Search,
} from 'lucide-react';

interface TemporalScrubBarProps {
  tree: TreeData;
  temporalYear: number | null;
  onYearChange: (year: number) => void;
  onClose: () => void;
  activeMoment: HistoricalMoment | null;
  onSelectMoment: (moment: HistoricalMoment | null) => void;
}

export const TemporalScrubBar: React.FC<TemporalScrubBarProps> = ({
  tree,
  temporalYear,
  onYearChange,
  onClose,
  activeMoment,
  onSelectMoment,
}) => {
  const { minYear, maxYear, defaultYear } = useMemo(() => getTreeYearBounds(tree), [tree]);
  const currentYear = temporalYear ?? defaultYear;

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2>(1);
  const [isMomentsOpen, setIsMomentsOpen] = useState(false);
  const [momentsFilter, setMomentsFilter] = useState<'all' | 'family' | 'world'>('all');
  const [momentsSearch, setMomentsSearch] = useState('');
  const [hoveredEvent, setHoveredEvent] = useState<WorldEvent | null>(null);

  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const momentsContainerRef = useRef<HTMLDivElement | null>(null);

  // Compute room stats and historical moments
  const roomStats = useMemo(() => {
    return computeRoomStats(tree, currentYear, activeMoment);
  }, [tree, currentYear, activeMoment]);

  const allMoments = useMemo(() => {
    return getHistoricalMoments(tree);
  }, [tree]);

  // World events in the current active year
  const currentWorldEvents = useMemo(() => {
    return getWorldEventsInYear(currentYear);
  }, [currentYear]);

  // Filter moments for dropdown
  const filteredMoments = useMemo(() => {
    return allMoments.filter((m) => {
      if (momentsFilter === 'family' && m.type === 'world') return false;
      if (momentsFilter === 'world' && m.type !== 'world') return false;
      if (momentsSearch.trim()) {
        const query = momentsSearch.toLowerCase();
        return (
          m.title.toLowerCase().includes(query) ||
          (m.subtitle && m.subtitle.toLowerCase().includes(query)) ||
          m.year.toString().includes(query)
        );
      }
      return true;
    });
  }, [allMoments, momentsFilter, momentsSearch]);

  // Auto-play interval engine
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.round(900 / playbackSpeed);
      playTimerRef.current = setInterval(() => {
        onYearChange(currentYear >= maxYear ? minYear : currentYear + 1);
      }, intervalMs);
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    };
  }, [isPlaying, currentYear, maxYear, minYear, playbackSpeed, onYearChange]);

  // Close moments dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        momentsContainerRef.current &&
        !momentsContainerRef.current.contains(e.target as Node)
      ) {
        setIsMomentsOpen(false);
      }
    };

    if (isMomentsOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isMomentsOpen]);

  // Step controls
  const handleStepYear = (delta: number) => {
    const next = Math.max(minYear, Math.min(maxYear, currentYear + delta));
    onYearChange(next);
    if (activeMoment && activeMoment.year !== next) {
      onSelectMoment(null);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onYearChange(val);
    if (activeMoment && activeMoment.year !== val) {
      onSelectMoment(null);
    }
  };

  const handleSelectHistoricalMoment = (moment: HistoricalMoment) => {
    onYearChange(moment.year);
    onSelectMoment(moment);
    setIsMomentsOpen(false);
  };

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-35 max-w-[96vw] w-[920px] select-none">
      <div className="bg-slate-900/92 backdrop-blur-xl border border-slate-700/70 shadow-2xl rounded-2xl p-3 sm:p-3.5 text-white flex flex-col gap-2.5 transition-all">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 border-b border-slate-800/80 pb-2.5">
          {/* Left: Mode Title & Quick Counts */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold text-xs tracking-wide shadow-xs flex-shrink-0">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="hidden xs:inline">4D Temporal Scrub</span>
              <span className="xs:hidden">4D Scrub</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-800/50">
                <Users className="w-3 h-3" />
                <strong>{roomStats.livingCount}</strong> alive in room
              </span>
              <span className="text-slate-500 text-[11px]">
                {roomStats.unbornCount} unborn • {roomStats.deceasedCount} deceased
              </span>
            </div>
          </div>

          {/* Center: Year Display & World Event Badge */}
          <div className="flex items-center gap-2 flex-1 justify-center max-w-[420px]">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-400 drop-shadow-sm">
                {currentYear}
              </span>
            </div>

            {/* World Event Pill */}
            {currentWorldEvents.length > 0 && (
              <div
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-950/60 border border-indigo-700/50 text-indigo-200 text-xs font-medium truncate max-w-[260px] shadow-xs cursor-pointer hover:bg-indigo-900/60 transition-colors"
                title={currentWorldEvents[0].description}
                onClick={() => {
                  const ev = currentWorldEvents[0];
                  onSelectMoment({
                    id: `we_${ev.id}`,
                    year: ev.year,
                    title: ev.title,
                    subtitle: ev.description,
                    type: 'world',
                  });
                }}
              >
                <Globe className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span className="truncate">{currentWorldEvents[0].title}</span>
              </div>
            )}
          </div>

          {/* Right: Moments Popover & Close Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0" ref={momentsContainerRef}>
            {/* Historical Moments Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setIsMomentsOpen((prev) => !prev)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isMomentsOpen || activeMoment
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-800/90 hover:bg-slate-750 text-slate-200 border-slate-700 hover:border-slate-600'
                }`}
                title="Historical Moments: Click to see who was physically in the room"
              >
                <Sparkles className={`w-3.5 h-3.5 ${activeMoment ? 'text-slate-950' : 'text-amber-400'}`} />
                <span className="hidden sm:inline">Who Was in the Room?</span>
                <span className="sm:hidden">Moments</span>
              </button>

              {/* Historical Moments Popover Menu */}
              {isMomentsOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2.5 animate-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Historical Moments & Life Events</span>
                    </div>
                    <button
                      onClick={() => setIsMomentsOpen(false)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Filter tabs & Search */}
                  <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-[11px]">
                    <button
                      onClick={() => setMomentsFilter('all')}
                      className={`flex-1 py-1 rounded-lg font-medium transition-colors ${
                        momentsFilter === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setMomentsFilter('family')}
                      className={`flex-1 py-1 rounded-lg font-medium transition-colors ${
                        momentsFilter === 'family' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Family
                    </button>
                    <button
                      onClick={() => setMomentsFilter('world')}
                      className={`flex-1 py-1 rounded-lg font-medium transition-colors ${
                        momentsFilter === 'world' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      World Events
                    </button>
                  </div>

                  {/* Search bar */}
                  <div className="flex items-center bg-slate-950/70 rounded-xl px-2.5 py-1.5 border border-slate-800 text-xs text-slate-200">
                    <Search className="w-3.5 h-3.5 text-slate-500 mr-2 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="Search milestone, relative, or event..."
                      value={momentsSearch}
                      onChange={(e) => setMomentsSearch(e.target.value)}
                      className="bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none w-full"
                    />
                  </div>

                  {/* Moments List */}
                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                    {filteredMoments.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 text-center">
                        No events found matching your search
                      </div>
                    ) : (
                      filteredMoments.map((moment) => {
                        const isCurrentActive =
                          activeMoment?.id === moment.id ||
                          (!activeMoment && currentYear === moment.year && moment.type === 'world');

                        return (
                          <div
                            key={moment.id}
                            onClick={() => handleSelectHistoricalMoment(moment)}
                            className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer transition-all border ${
                              isCurrentActive
                                ? 'bg-amber-500/20 border-amber-500/50 text-white'
                                : 'bg-slate-800/40 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 flex-shrink-0 mt-0.5">
                              {moment.type === 'wedding' ? (
                                <Heart className="w-3.5 h-3.5 text-rose-400" />
                              ) : moment.type === 'birthday' ? (
                                <Cake className="w-3.5 h-3.5 text-amber-400" />
                              ) : moment.type === 'birth' ? (
                                <Baby className="w-3.5 h-3.5 text-emerald-400" />
                              ) : moment.type === 'memorial' ? (
                                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <h4 className="text-xs font-semibold truncate text-white">
                                  {moment.title}
                                </h4>
                                <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/50">
                                  {moment.year}
                                </span>
                              </div>
                              {moment.subtitle && (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {moment.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Exit Temporal Mode Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Close 4D Timeline (return to full tree view)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Middle Slider & Playback Row */}
        <div className="flex items-center gap-2.5">
          {/* Play / Pause Button */}
          <button
            onClick={() => setIsPlaying((prev) => !prev)}
            className={`p-2 rounded-xl flex items-center justify-center transition-all ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
            title={isPlaying ? 'Pause timeline animation (Space)' : 'Play timeline animation through years (Space)'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {/* Speed Toggle */}
          <button
            onClick={() => {
              setPlaybackSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 0.5 : 1));
            }}
            className="px-2 py-1 text-[11px] font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
            title="Toggle playback speed (0.5x, 1x, 2x)"
          >
            {playbackSpeed}x
          </button>

          {/* Stepper: -10 Years */}
          <button
            onClick={() => handleStepYear(-10)}
            className="hidden sm:flex p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors items-center justify-center"
            title="Step back 10 years"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Stepper: -1 Year */}
          <button
            onClick={() => handleStepYear(-1)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center"
            title="Step back 1 year (Left Arrow)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Range Slider Container with World Event Ticks */}
          <div className="relative flex-1 flex items-center h-8">
            {/* World Event Pin Marks along the rail */}
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-2 pointer-events-none z-10 flex items-center">
              {MAJOR_WORLD_EVENTS.filter((e) => e.year >= minYear && e.year <= maxYear).map((ev) => {
                const percent = ((ev.year - minYear) / (maxYear - minYear)) * 100;
                const isSelected = currentYear === ev.year;
                const isWar = ev.category === 'war';
                const isScience = ev.category === 'science';

                return (
                  <div
                    key={ev.id}
                    style={{ left: `${percent}%` }}
                    className="absolute -translate-x-1/2 group/pin pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onYearChange(ev.year);
                      onSelectMoment({
                        id: `we_${ev.id}`,
                        year: ev.year,
                        title: ev.title,
                        subtitle: ev.description,
                        type: 'world',
                      });
                    }}
                    onMouseEnter={() => setHoveredEvent(ev)}
                    onMouseLeave={() => setHoveredEvent(null)}
                  >
                    <div
                      className={`w-2 h-2 rounded-full transition-all border ${
                        isSelected
                          ? 'bg-amber-400 border-white scale-140 ring-2 ring-amber-400/50'
                          : isWar
                          ? 'bg-rose-500/80 border-rose-300 hover:scale-125'
                          : isScience
                          ? 'bg-cyan-400/80 border-cyan-200 hover:scale-125'
                          : 'bg-indigo-400/80 border-indigo-200 hover:scale-125'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Hovered event preview tooltip */}
            {hoveredEvent && (
              <div
                style={{
                  left: `${((hoveredEvent.year - minYear) / (maxYear - minYear)) * 100}%`,
                }}
                className="absolute -top-7 -translate-x-1/2 bg-slate-950 text-slate-100 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-slate-700 pointer-events-none whitespace-nowrap shadow-xl z-30"
              >
                {hoveredEvent.year} • {hoveredEvent.title}
              </div>
            )}

            {/* Range Input */}
            <input
              type="range"
              min={minYear}
              max={maxYear}
              value={currentYear}
              onChange={handleSliderChange}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none hover:bg-slate-750 transition-colors z-20"
            />
          </div>

          {/* Stepper: +1 Year */}
          <button
            onClick={() => handleStepYear(1)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center"
            title="Step forward 1 year (Right Arrow)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Stepper: +10 Years */}
          <button
            onClick={() => handleStepYear(10)}
            className="hidden sm:flex p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors items-center justify-center"
            title="Step forward 10 years"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>

          {/* Direct Year Input */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-800/90 px-2 py-1 rounded-xl border border-slate-700">
            <input
              type="number"
              min={minYear}
              max={maxYear}
              value={currentYear}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1000 && val <= 3000) {
                  onYearChange(Math.max(minYear, Math.min(maxYear, val)));
                }
              }}
              className="w-14 bg-transparent text-xs font-mono font-bold text-center text-amber-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Bottom Narrative / Generational Overlap Summary Banner */}
        <div className="flex items-center justify-between gap-3 bg-slate-950/60 rounded-xl px-3 py-2 border border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="font-normal leading-tight">{roomStats.narrativeSummary}</span>
          </div>

          {activeMoment && (
            <button
              onClick={() => onSelectMoment(null)}
              className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium flex-shrink-0"
            >
              Clear Moment Focus
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
