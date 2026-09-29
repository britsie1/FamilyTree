import { create } from 'zustand';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  durationMs?: number;
  createdAt: number;
}

export interface NotificationStoreState {
  notifications: AppNotification[];
  addNotification: (
    notification: Omit<AppNotification, 'id' | 'createdAt'> & { id?: string }
  ) => string;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationStoreState>((set) => ({
  notifications: [],

  addNotification: (params) => {
    const id = params.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newNotification: AppNotification = {
      ...params,
      id,
      durationMs: params.durationMs ?? 4500,
      createdAt: Date.now(),
    };

    set((state) => ({
      // Keep up to 5 concurrent toasts to prevent clutter
      notifications: [...state.notifications.slice(-4), newNotification],
    }));

    if (newNotification.durationMs && newNotification.durationMs > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, newNotification.durationMs);
    }

    return id;
  },

  dismissNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },
}));

/**
 * Convenience helper to show a snapshot notification with an optional action to open history.
 */
export function notifySnapshotTaken(reason: string, onOpenHistory?: () => void) {
  useNotificationStore.getState().addNotification({
    type: 'info',
    title: 'Automatic Snapshot Created',
    message: reason,
    action: onOpenHistory
      ? {
          label: 'View History',
          onClick: onOpenHistory,
        }
      : undefined,
  });
}

/**
 * Convenience helper to notify user of data repairs applied.
 */
export function notifyRepairsApplied(
  repairCount: number,
  details?: string,
  onOpenAudit?: () => void
) {
  if (repairCount <= 0) return;
  useNotificationStore.getState().addNotification({
    type: 'warning',
    title: 'Data Inconsistencies Repaired',
    message: details || `Automatically repaired ${repairCount} integrity ${repairCount === 1 ? 'issue' : 'issues'} at data boundary.`,
    action: onOpenAudit
      ? {
          label: 'Details',
          onClick: onOpenAudit,
        }
      : undefined,
    durationMs: 6000,
  });
}
