// src/components/NotificationToast.tsx
'use client';

import { useState, useEffect } from 'react';
import { FiBell, FiX } from 'react-icons/fi';

interface NotificationToastProps {
  message: string;
  type?: 'success' | 'info' | 'warning';
  duration?: number;
  onClose?: () => void;
}

export function NotificationToast({ message, type = 'info', duration = 5000, onClose }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const bgColor = {
    success: 'bg-green-50 border-green-500 text-green-800',
    info: 'bg-blue-50 border-blue-500 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-500 text-yellow-800'
  }[type];

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md p-4 border-l-4 rounded-lg shadow-lg ${bgColor}`}>
      <div className="flex items-start gap-3">
        <FiBell className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            if (onClose) onClose();
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}