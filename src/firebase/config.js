import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:
    process.env.REACT_APP_FIREBASE_API_KEY ||
    "AIzaSyDt4mswBUoezAZgaklrqReiI5De6TyF5o0",
  authDomain:
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN ||
    "focal-point-c452c.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "focal-point-c452c",
  storageBucket:
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET ||
    "focal-point-c452c.firebasestorage.app",
  messagingSenderId:
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "157275128489",
  appId:
    process.env.REACT_APP_FIREBASE_APP_ID ||
    "1:157275128489:web:d92d4907730ca0b7f7dfb8",
  measurementId:
    process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-RRWX7C9PVR",
};

// Initialize Firebase - check if already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Use only the default database for all collections
const firestore = getFirestore(app); // This connects to the (default) database

// Initialize Firebase Storage
const storage = getStorage(app);

export { app, auth, firestore, storage };
