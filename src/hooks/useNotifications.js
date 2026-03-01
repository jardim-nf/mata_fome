// src/hooks/useNotifications.js
import { useState, useCallback } from 'react';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((type, title, message, duration = 5000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newNotification = {
      id,
      type, // 'success', 'error', 'warning', 'info'
      title,
      message,
      timestamp: new Date(),
      duration,
      visible: true
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-remove após duração
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications
  };
};