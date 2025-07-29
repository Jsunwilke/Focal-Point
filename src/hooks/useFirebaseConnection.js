import { useState, useEffect } from 'react';

export const useFirebaseConnection = () => {
  const [isConnected, setIsConnected] = useState(navigator.onLine);
  const [lastConnectionChange, setLastConnectionChange] = useState(new Date());

  useEffect(() => {
    console.log('[FirebaseConnection] Setting up connection monitoring...');
    console.log('[FirebaseConnection] Initial connection state:', navigator.onLine);

    // Monitor online/offline events
    const handleOnline = () => {
      console.log('[FirebaseConnection] Browser online event');
      setIsConnected(true);
      setLastConnectionChange(new Date());
    };

    const handleOffline = () => {
      console.log('[FirebaseConnection] Browser offline event');
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