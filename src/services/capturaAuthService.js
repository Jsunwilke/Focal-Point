// Captura API Authentication Service
// This service is simplified as authentication is now handled by Firebase Functions

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

class CapturaAuthService {
  constructor() {
    this.functions = functions;
  }

  // Make authenticated request through Firebase Functions
  async makeAuthenticatedRequest(functionName, data = {}) {
    try {
      const callable = httpsCallable(this.functions, functionName);
      const result = await callable(data);
      
      if (result.data.success) {
        return result.data.data;
      } else {
        throw new Error(result.data.error || 'Function call failed');
      }
    } catch (error) {
      console.error(`Error calling ${functionName}:`, error);
      throw error;
    }
  }

  // Clear any local state (kept for compatibility)
  clearToken() {
    // No local token to clear as it's managed by Firebase Functions
  }
}

// Export singleton instance
export const capturaAuthService = new CapturaAuthService();