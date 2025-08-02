import {
  collection as firestoreCollection,
  doc as firestoreDoc,
  getDocs as firestoreGetDocs,
  getDoc as firestoreGetDoc,
  getDocFromServer as firestoreGetDocFromServer,
  setDoc as firestoreSetDoc,
  addDoc as firestoreAddDoc,
  updateDoc as firestoreUpdateDoc,
  deleteDoc as firestoreDeleteDoc,
  query as firestoreQuery,
  where,
  orderBy,
  limit,
  startAfter,
  startAt,
  endAt,
  endBefore,
  onSnapshot as firestoreOnSnapshot,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
  documentId,
  increment
} from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { readCounter } from './readCounter';

// Helper to extract collection name from various inputs
const getCollectionName = (reference) => {
  if (typeof reference === 'string') {
    return reference.split('/')[0];
  }
  if (reference && reference.path) {
    return reference.path.split('/')[0];
  }
  if (reference && reference._query && reference._query.path) {
    return reference._query.path.segments[0];
  }
  return 'unknown';
};

// Wrapped collection function - now accepts multiple path segments
export const collection = (db, ...pathSegments) => {
  return firestoreCollection(db, ...pathSegments);
};

// Wrapped doc function
export const doc = (db, path, ...pathSegments) => {
  return firestoreDoc(db, path, ...pathSegments);
};

// Wrapped getDocs with automatic read tracking
export const getDocs = async (query, component = 'unknown') => {
  const collectionName = getCollectionName(query);
  
  try {
    const snapshot = await firestoreGetDocs(query);
    const docCount = snapshot.size;
    
    // Track the read
    readCounter.recordRead('getDocs', collectionName, component, docCount);
    
    return snapshot;
  } catch (error) {
    // Still track attempted read even on error
    readCounter.recordRead('getDocs-error', collectionName, component, 0);
    throw error;
  }
};

// Wrapped getDoc with automatic read tracking
export const getDoc = async (docRef, component = 'unknown') => {
  const collectionName = getCollectionName(docRef);
  
  try {
    const docSnap = await firestoreGetDoc(docRef);
    
    // Track the read (1 document)
    readCounter.recordRead('getDoc', collectionName, component, 1);
    
    return docSnap;
  } catch (error) {
    // Still track attempted read even on error
    readCounter.recordRead('getDoc-error', collectionName, component, 0);
    throw error;
  }
};

// Wrapped getDocFromServer with automatic read tracking - bypasses cache
export const getDocFromServer = async (docRef, component = 'unknown') => {
  const collectionName = getCollectionName(docRef);
  
  try {
    const docSnap = await firestoreGetDocFromServer(docRef);
    
    // Track the read (1 document)
    readCounter.recordRead('getDocFromServer', collectionName, component, 1);
    
    return docSnap;
  } catch (error) {
    // Still track attempted read even on error
    readCounter.recordRead('getDocFromServer-error', collectionName, component, 0);
    throw error;
  }
};

// Wrapped onSnapshot with automatic read tracking
export const onSnapshot = (reference, ...args) => {
  const collectionName = getCollectionName(reference);
  let component = 'unknown';
  let options = {};
  let onNext, onError, onCompletion;
  
  // Parse arguments (can be in different formats)
  if (args.length === 1 && typeof args[0] === 'function') {
    // onSnapshot(ref, callback)
    onNext = args[0];
  } else if (args.length === 2) {
    if (typeof args[0] === 'object' && typeof args[1] === 'function') {
      // onSnapshot(ref, options, callback)
      options = args[0];
      onNext = args[1];
    } else if (typeof args[0] === 'function' && typeof args[1] === 'function') {
      // onSnapshot(ref, onNext, onError)
      onNext = args[0];
      onError = args[1];
    }
  } else if (args.length === 3) {
    if (typeof args[0] === 'object' && typeof args[1] === 'function') {
      // onSnapshot(ref, options, onNext, onError)
      options = args[0];
      onNext = args[1];
      onError = args[2];
    } else if (typeof args[0] === 'function') {
      // onSnapshot(ref, onNext, onError, onCompletion)
      onNext = args[0];
      onError = args[1];
      onCompletion = args[2];
    }
  } else if (args.length === 4) {
    // onSnapshot(ref, options, onNext, onError, onCompletion)
    options = args[0];
    onNext = args[1];
    onError = args[2];
    onCompletion = args[3];
  }
  
  // Extract component from options if provided
  if (options && options.component) {
    component = options.component;
    delete options.component; // Remove our custom option before passing to Firebase
  }
  
  // Create listener ID for tracking
  const listenerId = readCounter.recordListener(collectionName, component);
  
  // Wrap the onNext callback to track updates
  const wrappedOnNext = (snapshot) => {
    const docCount = snapshot.size !== undefined ? snapshot.size : 1;
    
    // Track the read
    if (snapshot.metadata && !snapshot.metadata.fromCache) {
      readCounter.recordListenerUpdate(listenerId, collectionName, component, docCount);
    }
    
    // Call original callback
    if (onNext) onNext(snapshot);
  };
  
  // Create the unsubscribe function
  let unsubscribe;
  if (onError || onCompletion) {
    unsubscribe = firestoreOnSnapshot(reference, options, wrappedOnNext, onError, onCompletion);
  } else {
    unsubscribe = firestoreOnSnapshot(reference, options, wrappedOnNext);
  }
  
  // Wrap unsubscribe to track listener removal
  const wrappedUnsubscribe = () => {
    readCounter.removeListener(listenerId);
    return unsubscribe();
  };
  
  return wrappedUnsubscribe;
};

// Export write operations without tracking
export const setDoc = firestoreSetDoc;
export const addDoc = firestoreAddDoc;
export const updateDoc = firestoreUpdateDoc;
export const deleteDoc = firestoreDeleteDoc;

// Export query builders
export const query = firestoreQuery;
export { 
  where,
  orderBy,
  limit,
  startAfter,
  startAt,
  endAt,
  endBefore,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
  documentId,
  increment,
  firestore
};

// Helper function to create tracked getDocs with component name
export const createTrackedGetDocs = (component) => {
  return (query) => getDocs(query, component);
};

// Helper function to create tracked getDoc with component name
export const createTrackedGetDoc = (component) => {
  return (docRef) => getDoc(docRef, component);
};

// Helper function to create tracked onSnapshot with component name
export const createTrackedOnSnapshot = (component) => {
  return (reference, ...args) => {
    // Inject component into options
    if (args.length >= 2 && typeof args[0] === 'object') {
      args[0].component = component;
    } else {
      // Create options object with component
      const newArgs = [{ component }, ...args];
      return onSnapshot(reference, ...newArgs);
    }
    return onSnapshot(reference, ...args);
  };
};