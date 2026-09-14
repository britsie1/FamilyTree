import React, { useState, useEffect } from 'react';
import type { TreeData, CloudTreeData, ShareRole, SharedUser } from '../../types/tree';
import { useAuth } from '../../contexts/AuthContext';
import {
  saveTreeToCloud,
  getCloudTree,
  updateTreeSharingSettings,
  encodeEmailKey,
  normalizeEmail,
} from '../../services/firestoreService';
import {
  X,
  Share2,
  Lock,
  Globe,
  Link as LinkIcon,
  Check,
  Trash2,
  Users,
  ChevronDown,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface ShareTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tree: TreeData;
  onTreeUpdated?: (cloudTree: CloudTreeData) => void;
}

export const ShareTreeModal: React.FC<ShareTreeModalProps> = ({
  isOpen,
  onClose,
  tree,
  onTreeUpdated,
}) => {
  const { user, isConfigured, signInWithGoogle } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cloud tree state
  const [cloudTree, setCloudTree] = useState<CloudTreeData | null>(null);

  // Form states
  const [emailInput, setEmailInput] = useState('');
  const [inputRole, setInputRole] = useState<ShareRole>('viewer');

  // Sharing settings
  const [isPublic, setIsPublic] = useState(false);
  const [publicRole, setPublicRole] = useState<ShareRole>('viewer');
  const [sharedWith, setSharedWith] = useState<Record<string, SharedUser>>({});

  // When modal opens, load or initialize cloud tree metadata
  useEffect(() => {
    if (!isOpen || !isConfigured || !user) return;

    let isMounted = true;
    setLoading(true);

    getCloudTree(tree.id)
      .then((existing) => {
        if (!isMounted) return;
        if (existing) {
          setCloudTree(existing);
          setIsPublic(existing.isPublic ?? false);
          setPublicRole(existing.publicRole || 'viewer');
          setSharedWith(existing.sharedWith || {});
        } else {
          // Tree is not yet in cloud, will be uploaded on first share action
          setCloudTree(null);
          setIsPublic(false);
          setPublicRole('viewer');
          setSharedWith({});
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching cloud tree for sharing:', err);
        setErrorMessage('Could not check cloud status: ' + err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, tree.id, user, isConfigured]);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}${window.location.pathname}?treeId=${encodeURIComponent(tree.id)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleEnsureCloudTree = async (): Promise<CloudTreeData> => {
    if (!user) throw new Error('You must be logged in to share this tree.');
    if (cloudTree) return cloudTree;

    // Save to Firestore now
    const saved = await saveTreeToCloud(tree, user, {
      isPublic,
      publicRole,
      sharedWith,
      sharedEmails: Object.values(sharedWith).map((u) => normalizeEmail(u.email)),
    });
    setCloudTree(saved);
    if (onTreeUpdated) onTreeUpdated(saved);
    return saved;
  };

  const handleAddPerson = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = emailInput.trim();
    if (!raw) return;

    // Basic email check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(raw)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const norm = normalizeEmail(raw);
    if (user && norm === normalizeEmail(user.email || '')) {
      setErrorMessage('You are already the owner of this tree.');
      return;
    }

    const encoded = encodeEmailKey(norm);
    const updatedSharedWith: Record<string, SharedUser> = {
      ...sharedWith,
      [encoded]: {
        email: norm,
        role: inputRole,
        addedAt: new Date().toISOString(),
      },
    };

    setSharedWith(updatedSharedWith);
    setEmailInput('');
    setErrorMessage(null);

    // Persist immediately if cloud tree exists
    try {
      setSaving(true);
      await handleEnsureCloudTree();
      const emails = Object.values(updatedSharedWith).map((u) => normalizeEmail(u.email));
      await updateTreeSharingSettings(tree.id, {
        isPublic,
        publicRole,
        sharedWith: updatedSharedWith,
        sharedEmails: emails,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update sharing.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeUserRole = async (encodedKey: string, newRole: ShareRole) => {
    const updated = { ...sharedWith };
    if (updated[encodedKey]) {
      updated[encodedKey] = { ...updated[encodedKey], role: newRole };
    }
    setSharedWith(updated);

    try {
      setSaving(true);
      await handleEnsureCloudTree();
      const emails = Object.values(updated).map((u) => normalizeEmail(u.email));
      await updateTreeSharingSettings(tree.id, {
        isPublic,
        publicRole,
        sharedWith: updated,
        sharedEmails: emails,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update user role.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUser = async (encodedKey: string) => {
    const updated = { ...sharedWith };
    delete updated[encodedKey];
    setSharedWith(updated);

    try {
      setSaving(true);
      await handleEnsureCloudTree();
      const emails = Object.values(updated).map((u) => normalizeEmail(u.email));
      await updateTreeSharingSettings(tree.id, {
        isPublic,
        publicRole,
        sharedWith: updated,
        sharedEmails: emails,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove user access.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublic = async (newIsPublic: boolean) => {
    setIsPublic(newIsPublic);
    try {
      setSaving(true);
      await handleEnsureCloudTree();
      const emails = Object.values(sharedWith).map((u) => normalizeEmail(u.email));
      await updateTreeSharingSettings(tree.id, {
        isPublic: newIsPublic,
        publicRole,
        sharedWith,
        sharedEmails: emails,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update general access.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePublicRole = async (newRole: ShareRole) => {
    setPublicRole(newRole);
    try {
      setSaving(true);
      await handleEnsureCloudTree();
      const emails = Object.values(sharedWith).map((u) => normalizeEmail(u.email));
      await updateTreeSharingSettings(tree.id, {
        isPublic,
        publicRole: newRole,
        sharedWith,
        sharedEmails: emails,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update public role.');
    } finally {
      setSaving(false);
    }
  };

  const sharedUsersList = Object.entries(sharedWith);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">
                Share "{tree.name || 'Untitled Tree'}"
              </h3>
              <p className="text-xs text-slate-500">
                Grant view or edit access via private emails or public link.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Case 1: Firebase not configured */}
          {!isConfigured && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Cloud & Sharing Not Configured</span>
              </div>
              <p className="text-amber-700 leading-relaxed">
                Cloud sync and sharing are not enabled yet for this deployment. Please contact the project administrator.
              </p>
            </div>
          )}

          {/* Case 2: Configured but not logged in */}
          {isConfigured && !user && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Sign in to share</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Local trees stay saved in your browser. Sign in with Google to save this tree to the cloud and share it with others.
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (err: any) {
                    setErrorMessage(err.message || 'Failed to sign in.');
                  }
                }}
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold px-4 py-2 rounded-xl text-xs shadow-xs hover:shadow transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>
            </div>
          )}

          {/* Case 3: Logged in and configured -> Google Drive sharing interface */}
          {isConfigured && user && (
            <>
              {loading && (
                <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Loading sharing permissions...</span>
                </div>
              )}

              {!loading && (
                <>
                  {/* Notice if tree is being promoted from local to cloud */}
                  {!cloudTree && (
                    <div className="bg-indigo-50/70 border border-indigo-200 text-indigo-900 rounded-xl p-3 text-xs flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      <span>
                        This tree will be saved to your cloud storage account upon sharing.
                      </span>
                    </div>
                  )}

                  {/* Add people input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Add people with email address
                    </label>
                    <form onSubmit={handleAddPerson} className="flex items-center gap-2">
                      <input
                        type="email"
                        placeholder="Add people by email..."
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <select
                        value={inputRole}
                        onChange={(e) => setInputRole(e.target.value as ShareRole)}
                        className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2.5 py-2 rounded-xl focus:outline-none cursor-pointer font-medium text-slate-700"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        type="submit"
                        disabled={!emailInput.trim() || saving}
                        className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 text-white font-semibold px-3.5 py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                  {errorMessage && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* People with access list */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      People with access
                    </h4>
                    <div className="space-y-2 border border-slate-200 rounded-xl p-2.5 bg-slate-50/50">
                      {/* Owner item */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.displayName || 'Owner'}
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {(user.displayName || user.email || 'O')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {user.displayName || 'You'} (You)
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Owner
                        </span>
                      </div>

                      {/* Shared collaborators */}
                      {sharedUsersList.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-2">
                          No collaborators added yet.
                        </p>
                      ) : (
                        sharedUsersList.map(([encodedKey, shared]) => (
                          <div
                            key={encodedKey}
                            className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                                {shared.email[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-800 truncate">
                                  {shared.email}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <select
                                value={shared.role}
                                onChange={(e) =>
                                  handleChangeUserRole(encodedKey, e.target.value as ShareRole)
                                }
                                disabled={saving}
                                className="text-[11px] font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none cursor-pointer"
                              >
                                <option value="viewer">Viewer</option>
                                <option value="editor">Editor</option>
                              </select>
                              <button
                                onClick={() => handleRemoveUser(encodedKey)}
                                title="Remove access"
                                disabled={saving}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* General Access (Drive style) */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      General access
                    </h4>
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            isPublic ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isPublic ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="relative inline-block">
                            <select
                              value={isPublic ? 'anyone' : 'restricted'}
                              onChange={(e) => handleTogglePublic(e.target.value === 'anyone')}
                              disabled={saving}
                              className="text-xs font-bold text-slate-900 bg-transparent pr-5 border-none focus:outline-none cursor-pointer appearance-none"
                            >
                              <option value="restricted">Restricted</option>
                              <option value="anyone">Anyone with the link</option>
                            </select>
                            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {isPublic
                              ? 'Anyone on the internet with the link can access'
                              : 'Only people with access can open with the link'}
                          </p>
                        </div>
                      </div>

                      {isPublic && (
                        <select
                          value={publicRole}
                          onChange={(e) => handleChangePublicRole(e.target.value as ShareRole)}
                          disabled={saving}
                          className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none cursor-pointer shadow-2xs"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs'
            }`}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <LinkIcon className="w-4 h-4 text-blue-600" />}
            <span>{copied ? 'Link copied!' : 'Copy link'}</span>
          </button>

          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
