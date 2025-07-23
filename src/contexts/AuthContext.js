// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/config";
import { signInUser, createUser, signOutUser } from "../firebase/auth";
import {
  getUserProfile,
  getOrganization,
  createUserProfile,
  createOrganization,
} from "../firebase/firestore";
import secureLogger from '../utils/secureLogger';

const AuthContext = createContext({});

// Utility function to update favicon
const updateFavicon = (logoURL) => {
  if (!logoURL) return;
  
  try {
    // Remove existing favicons
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach(link => link.remove());
    
    // Add new favicon
    const link = document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'icon';
    link.href = logoURL;
    document.head.appendChild(link);
    
    // Also add as shortcut icon for broader compatibility
    const shortcutLink = document.createElement('link');
    shortcutLink.type = 'image/x-icon';
    shortcutLink.rel = 'shortcut icon';
    shortcutLink.href = logoURL;
    document.head.appendChild(shortcutLink);
  } catch (error) {
    console.error('Error updating favicon:', error);
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [organizationLoading, setOrganizationLoading] = useState(false);

  // Load user profile - exposed as a function so it can be called after updates
  const loadUserProfile = async (uid = null) => {
    const userId = uid || user?.uid;
    secureLogger.debug("loadUserProfile called", { hasUserId: !!userId });
    if (!userId) {
      secureLogger.warn("No userId provided to loadUserProfile");
      return null;
    }

    try {
      const profile = await getUserProfile(userId);
      secureLogger.debug("getUserProfile completed", { 
        hasProfile: !!profile, 
        hasOrganizationID: !!profile?.organizationID,
        isActive: profile?.isActive,
        hasEmail: !!profile?.email 
      });
      setUserProfile(profile);
      return profile;
    } catch (error) {
      secureLogger.error("Error in loadUserProfile", error);
      return null;
    }
  };

  // Load organization - exposed as a function so it can be called after updates
  const loadOrganization = async (organizationID = null) => {
    const orgId =
      organizationID || userProfile?.organizationID || organization?.id;
    secureLogger.debug("loadOrganization called", { hasOrgId: !!orgId });
    if (!orgId) {
      secureLogger.warn("No organizationID provided to loadOrganization");
      return null;
    }

    // Prevent concurrent organization loads
    if (organizationLoading) {
      secureLogger.debug("Organization already loading, skipping duplicate request");
      return null;
    }

    // Check if we already have this organization loaded
    if (organization?.id === orgId) {
      secureLogger.debug("Organization already loaded, skipping");
      return organization;
    }

    setOrganizationLoading(true);
    try {
      const org = await getOrganization(orgId);
      secureLogger.debug("getOrganization completed", { 
        hasOrganization: !!org, 
        hasOrgId: !!org?.id,
        hasOrgName: !!org?.name 
      });
      setOrganization(org);
      
      // Update favicon if organization has a logo
      if (org?.logoURL) {
        updateFavicon(org.logoURL);
      }
      
      return org;
    } catch (error) {
      secureLogger.error("Error in loadOrganization", error);
      return null;
    } finally {
      setOrganizationLoading(false);
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      secureLogger.debug("Auth state changed", { hasUser: !!user, hasUid: !!user?.uid });
      
      if (user) {
        setUser(user);
        secureLogger.debug("User set in state");
        
        try {
          // Get user profile
          secureLogger.debug("Loading user profile");
          const profile = await loadUserProfile(user.uid);
          secureLogger.debug("User profile loaded", { 
            hasProfile: !!profile, 
            hasOrganizationID: !!profile?.organizationID,
            isActive: profile?.isActive 
          });

          // Get organization if user has one
          if (profile?.organizationID) {
            secureLogger.debug("Loading organization", { hasOrganizationID: !!profile.organizationID });
            const org = await loadOrganization(profile.organizationID);
            secureLogger.debug("Organization loaded", { 
              hasOrganization: !!org, 
              hasOrgId: !!org?.id,
              hasOrgName: !!org?.name 
            });
          } else {
            secureLogger.warn("No organizationID found in profile");
          }
        } catch (error) {
          secureLogger.error("Error loading user data", error);
        }
      } else {
        secureLogger.debug("User logged out");
        setUser(null);
        setUserProfile(null);
        setOrganization(null);
      }
      
      secureLogger.debug("Setting loading to false");
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Reload user profile when userProfile changes (for organization loading)
  useEffect(() => {
    // Only load organization if we have a profile with organizationID and no organization loaded
    // This prevents double loading since auth state change already loads the organization
    if (userProfile?.organizationID && !organization && !loading && !organizationLoading) {
      loadOrganization(userProfile.organizationID);
    }
  }, [userProfile, organization, loading, organizationLoading]);

  // Sign in
  const signin = async (email, password) => {
    setLoading(true);
    try {
      const user = await signInUser(email, password);
      return user;
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signout = async () => {
    try {
      await signOutUser();
    } catch (error) {
      secureLogger.error("Sign out error", error);
      throw error;
    }
  };

  // Create studio (organization + admin user)
  const createStudio = async (email, password, studioData, userData) => {
    setLoading(true);
    try {
      // Create user account
      const user = await createUser(email, password);

      // Create organization
      const organizationID = await createOrganization(studioData);

      // Create user profile with organization link
      await createUserProfile(user.uid, {
        ...userData,
        email,
        organizationID,
        role: "admin",
      });

      return user;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    userProfile,
    organization,
    loading,
    signin,
    signout,
    createStudio,
    loadUserProfile,
    loadOrganization,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
