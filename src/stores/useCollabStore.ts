import { create } from 'zustand';
import type { UserPermission } from '../types/tree';

export interface CollabStoreState {
  isCloudTree: boolean;
  userPermission: UserPermission;
  cloudSyncStatus: 'synced' | 'saving' | 'error' | 'offline';
  cloudSyncError: string | null;
  cloudLoading: boolean;
  accessDeniedMessage: string | null;
  isShareModalOpen: boolean;

  setIsCloudTree: (isCloudTree: boolean) => void;
  setUserPermission: (userPermission: UserPermission) => void;
  setCloudSyncStatus: (
    status: 'synced' | 'saving' | 'error' | 'offline',
    error?: string | null
  ) => void;
  setCloudLoading: (cloudLoading: boolean) => void;
  setAccessDeniedMessage: (accessDeniedMessage: string | null) => void;
  setIsShareModalOpen: (isShareModalOpen: boolean) => void;
  resetCollab: () => void;
}

export const useCollabStore = create<CollabStoreState>((set) => ({
  isCloudTree: false,
  userPermission: 'owner',
  cloudSyncStatus: 'synced',
  cloudSyncError: null,
  cloudLoading: false,
  accessDeniedMessage: null,
  isShareModalOpen: false,

  setIsCloudTree: (isCloudTree) => set({ isCloudTree }),
  setUserPermission: (userPermission) => set({ userPermission }),
  setCloudSyncStatus: (cloudSyncStatus, cloudSyncError = null) =>
    set({ cloudSyncStatus, cloudSyncError }),
  setCloudLoading: (cloudLoading) => set({ cloudLoading }),
  setAccessDeniedMessage: (accessDeniedMessage) => set({ accessDeniedMessage }),
  setIsShareModalOpen: (isShareModalOpen) => set({ isShareModalOpen }),

  resetCollab: () =>
    set({
      isCloudTree: false,
      userPermission: 'owner',
      cloudSyncStatus: 'synced',
      cloudSyncError: null,
      cloudLoading: false,
      accessDeniedMessage: null,
    }),
}));
