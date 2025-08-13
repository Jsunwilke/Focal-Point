import { 
  doc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp,
  setDoc,
  firestore
} from './firestoreWrapper';

class PresenceService {
  constructor() {
    this.isOnline = true;
    this.currentUserId = null;
    this.presenceRef = null;
    this.lastSeenInterval = null;
    this.userPresenceListeners = new Map();
  }

  async initializePresence(userId) {
    if (!userId) return;
    
    this.currentUserId = userId;
    this.presenceRef = doc(firestore, 'presence', userId);
    
    // Set initial online status
    await this.setOnlineStatus(true);
    
    // Update last seen every 30 seconds
    this.lastSeenInterval = setInterval(() => {
      if (this.isOnline) {
        this.updateLastSeen();
      }
    }, 30000);
    
    // Listen for window focus/blur
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('blur', this.handleBlur);
    
    // Listen for visibility change
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Set offline on window unload
    window.addEventListener('beforeunload', this.handleUnload);
  }

  handleFocus = () => {
    this.setOnlineStatus(true);
  };

  handleBlur = () => {
    // Don't immediately go offline on blur
    setTimeout(() => {
      if (!document.hasFocus()) {
        this.setOnlineStatus(false);
      }
    }, 60000); // Go offline after 1 minute of inactivity
  };

  handleVisibilityChange = () => {
    if (document.hidden) {
      this.setOnlineStatus(false);
    } else {
      this.setOnlineStatus(true);
    }
  };

  handleUnload = () => {
    this.setOnlineStatus(false);
  };

  async setOnlineStatus(isOnline) {
    if (!this.presenceRef) return;
    
    this.isOnline = isOnline;
    
    try {
      await setDoc(this.presenceRef, {
        online: isOnline,
        lastSeen: serverTimestamp(),
        ...(isOnline && { status: 'online' })
      }, { merge: true });
    } catch (error) {
      console.error('Error setting online status:', error);
    }
  }

  async updateLastSeen() {
    if (!this.presenceRef) return;
    
    try {
      await updateDoc(this.presenceRef, {
        lastSeen: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating last seen:', error);
    }
  }

  async setCustomStatus(status, emoji = null) {
    if (!this.presenceRef) return;
    
    try {
      await updateDoc(this.presenceRef, {
        customStatus: status,
        statusEmoji: emoji,
        statusUpdatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error setting custom status:', error);
    }
  }

  subscribeToUserPresence(userId, callback) {
    if (this.userPresenceListeners.has(userId)) {
      // Unsubscribe from existing listener
      const unsubscribe = this.userPresenceListeners.get(userId);
      unsubscribe();
    }
    
    const presenceRef = doc(firestore, 'presence', userId);
    const unsubscribe = onSnapshot(presenceRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const isOnline = data.online && this.isRecentlyActive(data.lastSeen);
        
        callback({
          online: isOnline,
          lastSeen: data.lastSeen,
          customStatus: data.customStatus,
          statusEmoji: data.statusEmoji
        });
      } else {
        callback({
          online: false,
          lastSeen: null
        });
      }
    });
    
    this.userPresenceListeners.set(userId, unsubscribe);
    return unsubscribe;
  }

  isRecentlyActive(lastSeen) {
    if (!lastSeen) return false;
    
    const lastSeenTime = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const now = new Date();
    const diffMinutes = (now - lastSeenTime) / (1000 * 60);
    
    // Consider online if active in last 2 minutes
    return diffMinutes < 2;
  }

  getPresenceStatus(lastSeen) {
    if (!lastSeen) return 'offline';
    
    const lastSeenTime = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const now = new Date();
    const diffMinutes = (now - lastSeenTime) / (1000 * 60);
    
    if (diffMinutes < 2) return 'online';
    if (diffMinutes < 5) return 'away';
    return 'offline';
  }

  formatLastSeen(lastSeen) {
    if (!lastSeen) return 'Never';
    
    const lastSeenTime = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const now = new Date();
    const diffMs = now - lastSeenTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return lastSeenTime.toLocaleDateString();
  }

  cleanup() {
    if (this.lastSeenInterval) {
      clearInterval(this.lastSeenInterval);
    }
    
    // Remove event listeners
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleUnload);
    
    // Unsubscribe from all presence listeners
    this.userPresenceListeners.forEach(unsubscribe => unsubscribe());
    this.userPresenceListeners.clear();
    
    // Set offline status
    this.setOnlineStatus(false);
  }
}

export default new PresenceService();