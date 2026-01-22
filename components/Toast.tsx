import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 5000); // Auto close after 5s

    return () => clearTimeout(timer);
  }, [id, onClose]);

  const bgColors = {
    success: 'bg-green-100 border-green-600',
    error: 'bg-red-100 border-red-600',
    info: 'bg-blue-100 border-blue-600',
  };

  const icons = {
    success: <CheckCircle size={20} className="text-green-700" />,
    error: <AlertCircle size={20} className="text-red-700" />,
    info: <Info size={20} className="text-blue-700" />,
  };

  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border-2 shadow-neo-sm min-w-[300px] max-w-md animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto ${bgColors[type]}`}>
      <div className="shrink-0">{icons[type]}</div>
      <p className="flex-1 text-sm font-bold text-black">{message}</p>
      <button onClick={() => onClose(id)} className="p-1 hover:bg-black/5 rounded">
        <X size={16} />
      </button>
    </div>
  );
};
