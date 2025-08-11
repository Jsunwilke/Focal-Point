import { useState, useEffect } from 'react';

export const useFirebaseConnection = () => {
  const [isConnected, setIsConnected] = useState(navigator.onLine);
  const [lastConnectionChange, setLastConnectionChange] = useState(new Date());

  useEffect(() => {

    // Monitor online/offline events
    const handleOnline = () => {
      setIsConnected(true);
      setLastConnectionChange(new Date());
    };

    const handleOffline = () => {
      setIsConnected(false);
      setLastConnectionChange(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isConnected, lastConnectionChange };
};