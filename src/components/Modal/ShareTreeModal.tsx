import React, { useState, useEffect } from 'react';
import type { TreeData, CloudTreeData, ShareRole, SharedUser } from '../../types/tree';
import { useAuth } from '../../contexts/AuthContext';
import {
  saveTreeToCloud,
  getCloudTree,
  updateTreeSharingSettings,
  encodeEmailKey,
  normalizeEmail,
  RECOMMENDED_FIRESTORE_RULES,
} from '../../services/firestoreService';
import { generateId, isPresetTreeId } from '../../services/storage';
import { getFirebaseDiagnostics } from '../../services/firebase';
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
  Copy,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface ShareTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tree: TreeData;
  isCloudTree?: boolean;
  onTreeUpdated?: (cloudTree: CloudTreeData) => void;
}

export const ShareTreeModal: React.FC<ShareTreeModalProps> = ({
  isOpen,
  onClose,
  tree,
  isCloudTree = false,
  onTreeUpdated,
}) => {
  const { user, isConfigured, signInWithGoogle } = useAuth();
  const diagnostics = getFirebaseDiagnostics();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rulesCopied, setRulesCopied] = useState(false);
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

  const isPermissionError = Boolean(
    errorMessage &&
      (errorMessage.toLowerCase().includes('permission') ||
        errorMessage.toLowerCase().includes('rules') ||
        errorMessage.toLowerCase().includes('insufficient'))
  );

  // Define syncWithCloud so both useEffect and Retry button can invoke it
  const syncWithCloud = async () => {
    if (!isConfigured || !user) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const currentId = isPresetTreeId(tree.id) ? generateId('tree') : tree.id;
      const targetTree = currentId !== tree.id ? { ...tree, id: currentId } : tree;

      let existing: CloudTreeData | null = null;
      try {
        existing = await getCloudTree(currentId);
      } catch (fetchErr) {
        console.warn('Could not fetch cloud tree directly, will attempt upload:', fetchErr);
        existing = null;
      }

      if (existing) {
        setCloudTree(existing);
        setIsPublic(existing.isPublic ?? false);
        setPublicRole(existing.publicRole || 'viewer');
        setSharedWith(existing.sharedWith || {});
      } else {
        // Immediately sync local tree to cloud so it's persisted and shareable
        const saved = await saveTreeToCloud(targetTree, user, {
          isPublic: isPublic,
          publicRole: publicRole,
          sharedWith: sharedWith,
          sharedEmails: Object.values(sharedWith).map((u) => normalizeEmail(u.email)),
        });
        setCloudTree(saved);
        if (onTreeUpdated) onTreeUpdated(saved);
      }
    } catch (err: any) {
      console.error('Cloud sync error:', err);
      setErrorMessage(err.message || 'Could not sync tree to cloud.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !isConfigured || !user) return;
    syncWithCloud();
  }, [isOpen, tree.id, user?.uid, isConfigured, isCloudTree]);

  if (!isOpen) return null;

  const shareTreeId = cloudTree?.id || tree.id;
  const shareUrl = `${window.location.origin}${window.location.pathname}?treeId=${encodeURIComponent(shareTreeId)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);

      // In background, ensure tree is uploaded if not yet
      if (!cloudTree && user) {
        setSaving(true);
        handleEnsureCloudTree()
          .catch((err) => {
            console.error('Background cloud save failed:', err);
            setErrorMessage(err.message || 'Failed to save to cloud.');
          })
          .finally(() => {
            setSaving(false);
          });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to copy link to clipboard.');
    }
  };

  const handleEnsureCloudTree = async (): Promise<CloudTreeData> => {
    if (!user) throw new Error('You must be logged in to share this tree.');
    if (cloudTree) return cloudTree;

    const targetTree = isPresetTreeId(tree.id) ? { ...tree, id: generateId('tree') } : tree;

    // Save to Firestore now
    const saved = await saveTreeToCloud(targetTree, user, {
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
      const activeCloud = await handleEnsureCloudTree();
      const emails = Object.values(updatedSharedWith).map((u) => normalizeEmail(u.email));
      await updateTreeSharingSettings(activeCloud.id, {
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
      const activeCloud = await handleEnsureCloudTree();
      const emails = Object.values(updated).map((u) => normalizeEmail(u.email));
      await updateTreeSharingSettings(activeCloud.id, {
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
      const activeCloud = await handleEnsureCloudTree();
      const emails = Object.values(updated).map((u) => normalizeEmail(u.email));
      await updateTreeSharingSettings(activeCloud.id, {
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
      const activeCloud = await handleEnsureCloudTree();
      const emails = Object.values(sharedWith).map((u) => normalizeEmail(u.email));
      await updateTreeSharingSettings(activeCloud.id, {
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
      const activeCloud = await handleEnsureCloudTree();
      const emails = Object.values(sharedWith).map((u) => normalizeEmail(u.email));
      await updateTreeSharingSettings(activeCloud.id, {
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
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Cloud & Sharing Not Configured</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Firebase environment variables were not detected in this build.
              </p>

              {diagnostics.missingRequired.length > 0 && (
                <div className="bg-white/80 rounded-xl p-3 border border-amber-200/60 space-y-1.5 font-mono text-[11px]">
                  <p className="font-sans font-semibold text-slate-700">Missing required build variables:</p>
                  <ul className="list-disc list-inside text-rose-600 space-y-0.5">
                    {diagnostics.missingRequired.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-amber-100/70 rounded-xl p-3 text-[11px] space-y-2 text-amber-900">
                <p className="font-semibold text-slate-900">⚡ How to resolve on Netlify:</p>
                <ol className="list-decimal list-inside space-y-1 text-amber-800">
                  <li>In Netlify, go to <strong>Site configuration &gt; Environment variables</strong>.</li>
                  <li>Ensure your variables start with <code>VITE_FIREBASE_</code> (e.g. <code>VITE_FIREBASE_API_KEY</code>).</li>
                  <li>
                    <strong>Important:</strong> Because Vite bakes variables at build time, go to <strong>Deploys &gt; Trigger deploy &gt; Clear cache and deploy site</strong> to rebuild your app.
                  </li>
                  <li>In Firebase Console, add your Netlify domain to <strong>Authentication &gt; Settings &gt; Authorized domains</strong>.</li>
                </ol>
              </div>
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
              {/* Status Header: Loading, Auto-correction notice, Error with Retry, or Success */}
              {loading && (
                <div className="flex items-center gap-2.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 p-3 rounded-xl animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold">Connecting to cloud storage...</span>
                    <span className="text-[11px] text-blue-600 block">Syncing tree permissions and collaborators.</span>
                  </div>
                </div>
              )}

              {/* If Project ID was an App ID and was auto-corrected */}
              {diagnostics.wasAutoCorrected && (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Project ID Auto-Detected</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    In Netlify, <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">VITE_FIREBASE_PROJECT_ID</code> was set to an App ID (<code className="font-mono text-[10px]">{diagnostics.rawProjectId}</code>).
                    We automatically resolved your Project ID to <code className="font-mono font-bold text-amber-950">{diagnostics.projectId}</code>.
                  </p>
                </div>
              )}

              {/* If Project ID was an App ID and could NOT be auto-corrected */}
              {diagnostics.isProjectIdAppIdFormat && !diagnostics.wasAutoCorrected && (
                <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl p-3.5 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>Netlify Variable Error: App ID used instead of Project ID</span>
                  </div>
                  <p className="leading-relaxed">
                    In Netlify, <code className="bg-rose-100 px-1 py-0.5 rounded font-mono font-bold">VITE_FIREBASE_PROJECT_ID</code> is set to an App ID (<code className="font-mono">{diagnostics.rawProjectId}</code>).
                  </p>
                  <div className="bg-white/90 border border-rose-200 rounded-lg p-2.5 text-[11px] text-slate-700 space-y-1">
                    <p className="font-semibold text-slate-900">How to fix:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>In Firebase Console, go to <strong>Project Settings &gt; General</strong>.</li>
                      <li>Copy the <strong>Project ID</strong> (e.g. <code>my-tree-12345</code>), NOT the App ID.</li>
                      <li>In Netlify, update <code>VITE_FIREBASE_PROJECT_ID</code> and redeploy.</li>
                    </ol>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="text-xs bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <p className="font-semibold leading-snug">{errorMessage}</p>
                      <div className="bg-white/80 border border-rose-200 rounded-lg p-2 text-[11px] space-y-1 text-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Connected Project ID:</span>
                          <code className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                            {diagnostics.projectId || 'Not configured'}
                          </code>
                        </div>
                        {diagnostics.isProjectIdAppIdFormat && (
                          <p className="text-amber-700 font-medium">
                            ⚠️ This value looks like an App ID. In Firebase Console, copy the Project ID (e.g. <code>familytree-xyz</code>).
                          </p>
                        )}
                      </div>

                      {/* Specialized guidance for Firestore Permission Denied */}
                      {isPermissionError && (
                        <div className="bg-amber-50/95 border border-amber-300 rounded-xl p-3.5 text-[11px] text-amber-950 space-y-2.5 mt-2">
                          <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span>Firestore Security Rules update required</span>
                          </div>
                          <p className="leading-relaxed text-amber-800">
                            Firestore rejected the save operation because security rules in your Firebase Console project are locking database writes (or default Test Mode expired).
                          </p>
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(RECOMMENDED_FIRESTORE_RULES);
                                  setRulesCopied(true);
                                  setTimeout(() => setRulesCopied(false), 2500);
                                } catch (copyErr) {
                                  console.error('Failed to copy rules:', copyErr);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer text-xs"
                            >
                              {rulesCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{rulesCopied ? 'Rules Copied to Clipboard!' : 'Copy Recommended Rules'}</span>
                            </button>
                            {diagnostics.projectId && (
                              <a
                                href={`https://console.firebase.google.com/project/${encodeURIComponent(diagnostics.projectId)}/firestore/rules`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 font-semibold border border-amber-300 rounded-lg shadow-2xs transition-colors cursor-pointer text-xs"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
                                <span>Open Firebase Console Rules ↗</span>
                              </a>
                            )}
                          </div>
                          <ol className="list-decimal list-inside space-y-1 text-amber-900/90 pt-1 font-sans">
                            <li>Click <strong>Copy Recommended Rules</strong> above.</li>
                            <li>Open your Firebase Console Rules tab using the button above.</li>
                            <li>Paste the rules into the online editor and click <strong>Publish</strong>.</li>
                            <li>Come back here and click <strong>Retry Cloud Sync</strong> below.</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-rose-200/60">
                    <span className="text-[11px] text-rose-600">
                      You can still copy the link or manage settings.
                    </span>
                    <button
                      type="button"
                      onClick={syncWithCloud}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      <span>Retry Cloud Sync</span>
                    </button>
                  </div>
                </div>
              )}

              {cloudTree && !loading && !errorMessage && (
                <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50/80 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tree is synced with Cloud Firestore</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700">{diagnostics.projectId}</span>
                </div>
              )}

              {!cloudTree && !loading && !errorMessage && (
                <div className="bg-indigo-50/70 border border-indigo-200 text-indigo-900 rounded-xl p-3 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span>This tree will be saved to your cloud storage when shared.</span>
                  </div>
                  <button
                    type="button"
                    onClick={syncWithCloud}
                    disabled={saving || loading}
                    className="text-[11px] bg-white hover:bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                  >
                    Sync now
                  </button>
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
                    className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 text-white font-semibold px-3.5 py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                  >
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Add</span>
                  </button>
                </form>
              </div>

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
