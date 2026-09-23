import React, { useState, useMemo } from 'react';
import type { TreeData } from '../../types/tree';
import {
  computeTreeStatistics,
  auditTreeHealth,
  generateHealthReportMarkdown,
  type HealthAnomalySeverity,
} from '../../services/treeHealthAndStatsService';
import { getPersonDisplayName } from '../../services/treeOperations';
import {
  X,
  Activity,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Info,
  Users,
  Layers,
  Heart,
  Calendar,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Award,
  Crown,
  MapPin,
  Sparkles,
} from 'lucide-react';

export interface TreeStatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tree: TreeData;
  onSelectPerson?: (personId: string) => void;
}

export const TreeStatisticsModal: React.FC<TreeStatisticsModalProps> = ({
  isOpen,
  onClose,
  tree,
  onSelectPerson,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'health' | 'milestones'>('overview');
  const [healthFilter, setHealthFilter] = useState<'all' | HealthAnomalySeverity>('all');
  const [copied, setCopied] = useState<boolean>(false);

  const stats = useMemo(() => computeTreeStatistics(tree), [tree]);
  const health = useMemo(() => auditTreeHealth(tree), [tree]);

  if (!isOpen) return null;

  const handleCopyReport = async () => {
    try {
      const md = generateHealthReportMarkdown(tree);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy report:', err);
    }
  };

  const handleJumpToPerson = (personId: string) => {
    if (onSelectPerson) {
      onSelectPerson(personId);
    }
    onClose();
  };

  const filteredAnomalies = health.anomalies.filter((a) => {
    if (healthFilter === 'all') return true;
    return a.severity === healthFilter;
  });

  const getHealthBadge = () => {
    if (health.status === 'excellent') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{health.score}% • Excellent Health</span>
        </span>
      );
    }
    if (health.status === 'good') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>{health.score}% • Good Quality</span>
        </span>
      );
    }
    if (health.status === 'needs_attention') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>{health.score}% • Needs Review</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
        <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
        <span>{health.score}% • Critical Issues</span>
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] max-h-[90dvh] overflow-hidden animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 dark:shadow-indigo-950 flex-shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  Tree Health & Statistics
                </h2>
                {getHealthBadge()}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {tree.name || 'Untitled Tree'} • {stats.totalPeople} {stats.totalPeople === 1 ? 'relative' : 'relatives'} recorded
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleCopyReport}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              title="Copy detailed markdown report to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Report</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-4 sm:px-6 pt-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Overview & Demographics</span>
            </button>

            <button
              onClick={() => setActiveTab('health')}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'health'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Health Audit</span>
              {health.anomalies.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    health.errorCount > 0
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {health.anomalies.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('milestones')}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'milestones'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Records & Milestones</span>
            </button>
          </div>

          <button
            onClick={handleCopyReport}
            className="sm:hidden p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            title="Copy Report"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto overscroll-contain flex-1 p-4 sm:p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Quick KPI Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-slate-800/60 border border-indigo-100 dark:border-slate-700 flex flex-col">
                  <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
                    <span className="text-[11px] font-semibold">Total People</span>
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {stats.totalPeople}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {stats.livingCount} living • {stats.deceasedCount} passed
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-violet-50/60 dark:bg-slate-800/60 border border-violet-100 dark:border-slate-700 flex flex-col">
                  <div className="flex items-center justify-between text-violet-600 dark:text-violet-400 mb-1">
                    <span className="text-[11px] font-semibold">Family Unions</span>
                    <Heart className="w-4 h-4" />
                  </div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {stats.totalUnions}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    ~{stats.averageChildrenPerUnion} children / union
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-slate-800/60 border border-sky-100 dark:border-slate-700 flex flex-col">
                  <div className="flex items-center justify-between text-sky-600 dark:text-sky-400 mb-1">
                    <span className="text-[11px] font-semibold">Generations</span>
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {stats.generationSpan}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Depth range: {stats.minGeneration ?? 1} to {stats.maxGeneration ?? 1}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-slate-800/60 border border-emerald-100 dark:border-slate-700 flex flex-col">
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
                    <span className="text-[11px] font-semibold">Avg Lifespan</span>
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {stats.averageLifespan !== null ? `${stats.averageLifespan}` : '—'}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {stats.averageLifespan !== null ? 'years at passing' : 'Need birth/death dates'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-slate-800/60 border border-amber-100 dark:border-slate-700 flex flex-col">
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
                    <span className="text-[11px] font-semibold">Earliest Year</span>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {stats.milestones.earliestBirth?.year || '—'}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    {stats.milestones.earliestBirth ? getPersonDisplayName(stats.milestones.earliestBirth.person) : 'No dates'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-slate-800/60 border border-rose-100 dark:border-slate-700 flex flex-col">
                  <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1">
                    <span className="text-[11px] font-semibold">Health Score</span>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {health.score}%
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {health.errorCount} err • {health.warningCount} warn
                  </span>
                </div>
              </div>

              {/* Gender Breakdown Bar */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                    Gender Demographics
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {stats.totalPeople} Total
                  </span>
                </div>

                {/* Progress multi-segment bar */}
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-750 flex overflow-hidden">
                  {stats.genderPercentages.male > 0 && (
                    <div
                      style={{ width: `${stats.genderPercentages.male}%` }}
                      className="bg-blue-500 transition-all duration-300"
                      title={`Male: ${stats.genderCounts.male} (${stats.genderPercentages.male}%)`}
                    />
                  )}
                  {stats.genderPercentages.female > 0 && (
                    <div
                      style={{ width: `${stats.genderPercentages.female}%` }}
                      className="bg-rose-500 transition-all duration-300"
                      title={`Female: ${stats.genderCounts.female} (${stats.genderPercentages.female}%)`}
                    />
                  )}
                  {stats.genderPercentages.other > 0 && (
                    <div
                      style={{ width: `${stats.genderPercentages.other}%` }}
                      className="bg-purple-500 transition-all duration-300"
                      title={`Other: ${stats.genderCounts.other} (${stats.genderPercentages.other}%)`}
                    />
                  )}
                  {stats.genderPercentages.unspecified > 0 && (
                    <div
                      style={{ width: `${stats.genderPercentages.unspecified}%` }}
                      className="bg-slate-300 dark:bg-slate-600 transition-all duration-300"
                      title={`Unspecified: ${stats.genderCounts.unspecified} (${stats.genderPercentages.unspecified}%)`}
                    />
                  )}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      Male: <strong>{stats.genderCounts.male}</strong> ({stats.genderPercentages.male}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      Female: <strong>{stats.genderCounts.female}</strong> ({stats.genderPercentages.female}%)
                    </span>
                  </div>
                  {stats.genderCounts.other > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        Other: <strong>{stats.genderCounts.other}</strong>
                      </span>
                    </div>
                  )}
                  {stats.genderCounts.unspecified > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="text-slate-500 dark:text-slate-400">
                        Unspecified: <strong>{stats.genderCounts.unspecified}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Surnames & Origins Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Surnames */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Top Family Surnames</span>
                  </h3>

                  {stats.topSurnames.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                      No surnames recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {stats.topSurnames.slice(0, 6).map((item, idx) => (
                        <div key={item.surname} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {idx + 1}. {item.surname}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                              {item.count} ({item.percentage}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-750 overflow-hidden">
                            <div
                              style={{ width: `${Math.max(5, item.percentage)}%` }}
                              className="h-full bg-indigo-500 rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top Birthplaces */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Common Birthplaces</span>
                  </h3>

                  {stats.topBirthplaces.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                      No birthplace locations recorded yet. Add birthplaces in the Inspector to see geographical patterns.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {stats.topBirthplaces.slice(0, 6).map((item, idx) => (
                        <div key={item.place} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
                              {idx + 1}. {item.place}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                              {item.count} ({item.percentage}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-750 overflow-hidden">
                            <div
                              style={{ width: `${Math.max(5, item.percentage)}%` }}
                              className="h-full bg-emerald-500 rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HEALTH AUDIT */}
          {activeTab === 'health' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Filter Pills */}
              <div className="flex items-center gap-2 flex-wrap pb-1 border-b border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setHealthFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    healthFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  All ({health.anomalies.length})
                </button>
                <button
                  onClick={() => setHealthFilter('error')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                    healthFilter === 'error'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                  }`}
                >
                  <AlertOctagon className="w-3 h-3" />
                  <span>Errors ({health.errorCount})</span>
                </button>
                <button
                  onClick={() => setHealthFilter('warning')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                    healthFilter === 'warning'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Warnings ({health.warningCount})</span>
                </button>
                <button
                  onClick={() => setHealthFilter('info')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                    healthFilter === 'info'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                  }`}
                >
                  <Info className="w-3 h-3" />
                  <span>Suggestions ({health.infoCount})</span>
                </button>
              </div>

              {/* Anomaly list */}
              {filteredAnomalies.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Clean Bill of Health!
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                      {healthFilter === 'all'
                        ? 'No chronological contradictions, impossible age gaps, duplicate entries, or disconnected loops found.'
                        : `No ${healthFilter} issues detected in this category.`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAnomalies.map((item) => {
                    const isErr = item.severity === 'error';
                    const isWarn = item.severity === 'warning';

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          isErr
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                            : isWarn
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isErr
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                                : isWarn
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                                : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {isErr ? (
                              <AlertOctagon className="w-4 h-4" />
                            ) : isWarn ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : (
                              <Info className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                {item.title}
                              </h4>
                              <span
                                className={`text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded ${
                                  isErr
                                    ? 'bg-rose-200/70 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200'
                                    : isWarn
                                    ? 'bg-amber-200/70 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {item.category}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* Jump Action */}
                        {item.personId && (
                          <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                            <button
                              onClick={() => handleJumpToPerson(item.personId!)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
                                isErr
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                  : isWarn
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                              title={`Focus ${item.personName || 'person'} in the canvas to fix`}
                            >
                              <span>Go to Relative</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RECORDS & MILESTONES */}
          {activeTab === 'milestones' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Notable genealogical milestones calculated automatically across your family tree.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Oldest Living */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Oldest Living Relative</span>
                    </span>
                    {stats.milestones.oldestLiving && (
                      <span className="text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        {stats.milestones.oldestLiving.age} years old
                      </span>
                    )}
                  </div>
                  {stats.milestones.oldestLiving ? (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {getPersonDisplayName(stats.milestones.oldestLiving.person)}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Born: {stats.milestones.oldestLiving.person.birthDate || 'Unknown'}
                        {stats.milestones.oldestLiving.person.birthPlace && ` • ${stats.milestones.oldestLiving.person.birthPlace}`}
                      </p>
                      <button
                        onClick={() => handleJumpToPerson(stats.milestones.oldestLiving!.person.id)}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        <span>Focus on Tree</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                      No living relatives with recorded birth years.
                    </p>
                  )}
                </div>

                {/* Longest Lifespan */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                      <Crown className="w-4 h-4" />
                      <span>Longest Recorded Lifespan</span>
                    </span>
                    {stats.milestones.longestLived && (
                      <span className="text-xs font-mono font-bold bg-violet-50 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-800">
                        {stats.milestones.longestLived.age} years
                      </span>
                    )}
                  </div>
                  {stats.milestones.longestLived ? (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {getPersonDisplayName(stats.milestones.longestLived.person)}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {stats.milestones.longestLived.person.birthDate} — {stats.milestones.longestLived.person.deathDate}
                      </p>
                      <button
                        onClick={() => handleJumpToPerson(stats.milestones.longestLived!.person.id)}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        <span>Focus on Tree</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                      Requires both birth date and death date recorded.
                    </p>
                  )}
                </div>

                {/* Earliest Ancestor */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>Earliest Recorded Birth</span>
                    </span>
                    {stats.milestones.earliestBirth && (
                      <span className="text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                        Year {stats.milestones.earliestBirth.year}
                      </span>
                    )}
                  </div>
                  {stats.milestones.earliestBirth ? (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {getPersonDisplayName(stats.milestones.earliestBirth.person)}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Born: {stats.milestones.earliestBirth.person.birthDate || stats.milestones.earliestBirth.year}
                      </p>
                      <button
                        onClick={() => handleJumpToPerson(stats.milestones.earliestBirth!.person.id)}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        <span>Focus on Tree</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                      No birth dates recorded yet.
                    </p>
                  )}
                </div>

                {/* Largest Family */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>Largest Family Union</span>
                    </span>
                    {stats.milestones.largestFamily && (
                      <span className="text-xs font-mono font-bold bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800">
                        {stats.milestones.largestFamily.childCount} children
                      </span>
                    )}
                  </div>
                  {stats.milestones.largestFamily ? (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {stats.milestones.largestFamily.parents.length > 0
                          ? stats.milestones.largestFamily.parents.map(getPersonDisplayName).join(' & ')
                          : 'Family Union'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {stats.milestones.largestFamily.childCount} direct children recorded in union
                      </p>
                      {stats.milestones.largestFamily.parents[0] && (
                        <button
                          onClick={() => handleJumpToPerson(stats.milestones.largestFamily!.parents[0].id)}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          <span>Focus on Tree</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                      No children recorded in family unions yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
