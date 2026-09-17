import React from 'react';
import { Lock, LogIn } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { loadCurrentTree } from '../../services/storage';
import { useCollabStore } from '../../stores/useCollabStore';
import type { TreeData } from '../../types/tree';

export interface AccessDeniedOverlayProps {
  onSwitchTree: (tree: TreeData, isCloud?: boolean) => void;
  onClearUrl: () => void;
}

export const AccessDeniedOverlay: React.FC<AccessDeniedOverlayProps> = ({
  onSwitchTree,
  onClearUrl,
}) => {
  const { user, signInWithGoogle } = useAuth();
  const accessDeniedMessage = useCollabStore((s) => s.accessDeniedMessage);
  const setAccessDeniedMessage = useCollabStore((s) => s.setAccessDeniedMessage);

  if (!accessDeniedMessage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900 flex items-center justify-center mx-auto shadow-xs">
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Access Restricted</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            {accessDeniedMessage}
          </p>
        </div>
        <div className="pt-2 flex flex-col gap-2">
          {!user ? (
            <button
              onClick={() => signInWithGoogle()}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign in with Google</span>
            </button>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Signed in as <strong>{user.email}</strong>
            </p>
          )}
          <button
            onClick={() => {
              setAccessDeniedMessage(null);
              onClearUrl();
              onSwitchTree(loadCurrentTree(), false);
            }}
            className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Return to My Local Trees
          </button>
        </div>
      </div>
    </div>
  );
};
