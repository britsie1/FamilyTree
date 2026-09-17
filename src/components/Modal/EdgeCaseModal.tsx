import React from 'react';
import { X, GitMerge, Sparkles, CheckCircle2 } from 'lucide-react';

interface EdgeCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDemo: () => void;
}

export const EdgeCaseModal: React.FC<EdgeCaseModalProps> = ({
  isOpen,
  onClose,
  onLoadDemo,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50 to-slate-50 dark:from-indigo-950/40 dark:to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <GitMerge className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Complex Genealogy & Edge Cases</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">How crossed lines and pedigree collapse are solved</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-[70vh] overflow-y-auto">
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-1 flex items-center gap-1.5">
              <span>The Problem: Dad's Brother Marries Mom's Sister</span>
            </h4>
            <p>
              When two brothers from Family A marry two sisters from Family B, their children are
              <strong> double first cousins</strong> (they share 100% identical grandparents on both
              sides). In traditional genealogical tools, lines cross over each other in an illegible
              tangle.
            </p>
          </div>

          <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 rounded-xl p-3.5 space-y-2">
            <h4 className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 text-xs">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Our Multi-Layered Algorithmic Solution
            </h4>

            <div className="space-y-2 text-slate-700 dark:text-slate-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Union-Centric Graph Architecture:</strong> Marriages are treated as discrete
                  relational nodes rather than direct person-to-person links, allowing any blended or
                  inter-family configuration.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Barycentric Generational Layout:</strong> Automatically groups sibling pods
                  and aligns partner unions side-by-side to drastically minimize long cross-cutting lines.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Smart Bridge-Hop (Jump-Over) Connectors:</strong> When relationship lines
                  must intersect, vertical lines render an elevated 3D circular arc ("bridge hop") over
                  horizontal marriage buses, eliminating visual ambiguity.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Interactive Lineage Highlighting:</strong> Hovering or selecting any card
                  illuminates only its connected family lines in bright indigo and dims background edges.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Drag-and-Drop Fine Tuning:</strong> Drag any card to reposition it anywhere on
                  the infinite canvas. Coordinates are saved to LocalStorage!
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
          <button
            onClick={() => {
              onLoadDemo();
              onClose();
            }}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline cursor-pointer"
          >
            Load Double In-Law Demo Tree
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};
