import { useCollabStore } from '../stores/useCollabStore';
import { useNotificationStore } from '../stores/useNotificationStore';

export function reportLocalSave(success: boolean, error?: unknown): boolean {
  const store = useCollabStore.getState();
  const message = success ? null :
    `Changes could not be saved on this device. Keep this tab open and export a JSON backup. ${error instanceof Error ? error.message : ''}`.trim();
  if (message && store.localSaveError !== message) {
    useNotificationStore.getState().dismissNotification('local-save-failed');
    useNotificationStore.getState().addNotification({
      id: 'local-save-failed', type: 'error', title: 'Your changes are not safely saved',
      message, durationMs: 0,
    });
  }
  if (success) useNotificationStore.getState().dismissNotification('local-save-failed');
  store.setLocalSaveError(message);
  return success;
}