import React from 'react';
import { useNotificationStore, type AppNotification } from '../../stores/useNotificationStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const NotificationToastContainer: React.FC = () => {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismissNotification);

  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed top-16 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none"
      aria-live="polite"
    >
      {notifications.map((notif) => (
        <ToastItem key={notif.id} notification={notif} onDismiss={() => dismiss(notif.id)} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  notification: AppNotification;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ notification, onDismiss }) => {
  const { type, title, message, action } = notification;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-emerald-200 dark:border-emerald-900/50';
      case 'warning':
        return 'border-amber-200 dark:border-amber-900/50';
      case 'error':
        return 'border-rose-200 dark:border-rose-900/50';
      case 'info':
      default:
        return 'border-indigo-200 dark:border-indigo-900/50';
    }
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3 sm:p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border ${getBorderColor()} transition-all animate-in slide-in-from-top-2 duration-200`}
      role="alert"
    >
      {getIcon()}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
        {message && (
          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug break-words">
            {message}
          </p>
        )}
        {action && (
          <button
            onClick={() => {
              action.onClick();
              onDismiss();
            }}
            className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors underline cursor-pointer"
          >
            {action.label}
          </button>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
