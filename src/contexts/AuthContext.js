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

const AuthContext = createContext({});

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

  // Load user profile - exposed as a function so it can be called after updates
  const loadUserProfile = async (uid = null) => {
    const userId = uid || user?.uid;
    if (!userId) return null;

    try {
      const profile = await getUserProfile(userId);
      setUserProfile(profile);
      return profile;
    } catch (error) {
      console.error("Error loading user profile:", error);
      return null;
    }
  };

  // Load organization - exposed as a function so it can be called after updates
  const loadOrganization = async (organizationID = null) => {
    const orgId =
      organizationID || userProfile?.organizationID || organization?.id;
    if (!orgId) return null;

    try {
      const org = await getOrganization(orgId);
      setOrganization(org);
      return org;
    } catch (error) {
      console.error("Error loading organization:", error);
      return null;
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          // Get user profile
          const profile = await loadUserProfile(user.uid);

          // Get organization if user has one
          if (profile?.organizationID) {
            await loadOrganization(profile.organizationID);
          }
        } catch (error) {
          console.error("Error loading user data:", error);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setOrganization(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Reload user profile when userProfile changes (for organization loading)
  useEffect(() => {
    if (userProfile?.organizationID && !organization) {
      loadOrganization(userProfile.organizationID);
    }
  }, [userProfile]);

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
      console.error("Sign out error:", error);
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
