import React from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useUIStore, type ToastItem } from '../../store/uiStore';
import './Toast.css';

export function ToastContainer() {
  const toasts = useUIStore(s => s.toasts);
  const removeToast = useUIStore(s => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const icons = {
    success: <CheckCircle size={14} />,
    error: <AlertCircle size={14} />,
    warning: <AlertTriangle size={14} />,
    info: <Info size={14} />,
  };

  return (
    <div className={`toast toast-${toast.type}`} style={{ animation: 'slide-in-bottom 200ms ease' }}>
      <span className="toast-icon">{icons[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={onClose}><X size={12} /></button>
    </div>
  );
}
