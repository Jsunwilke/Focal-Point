// src/firebase/taskTemplates.js
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { firestore } from './config';
import { readCounter } from '../services/readCounter';

/**
 * Create a new task template
 */
export const createTaskTemplate = async (organizationID, userId, templateData) => {
  try {
    const templateRef = await addDoc(collection(firestore, 'taskTemplates'), {
      ...templateData,
      organizationID,
      createdBy: userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    readCounter.recordRead('write', 'taskTemplates', 'createTaskTemplate', 1);
    return templateRef.id;
  } catch (error) {
    console.error('Error creating task template:', error);
    throw error;
  }
};

/**
 * Get all templates for an organization
 */
export const getTaskTemplates = async (organizationID) => {
  try {
    const q = query(
      collection(firestore, 'taskTemplates'),
      where('organizationID', '==', organizationID),
      orderBy('name', 'asc')
    );

    const snapshot = await getDocs(q);
    readCounter.recordRead('query', 'taskTemplates', 'getTaskTemplates', snapshot.size);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting task templates:', error);
    throw error;
  }
};

/**
 * Get a single template by ID
 */
export const getTaskTemplate = async (templateId) => {
  try {
    const templateRef = doc(firestore, 'taskTemplates', templateId);
    const templateDoc = await getDoc(templateRef);

    readCounter.recordRead('get', 'taskTemplates', 'getTaskTemplate', 1);

    if (!templateDoc.exists()) {
      throw new Error('Template not found');
    }

    return {
      id: templateDoc.id,
      ...templateDoc.data()
    };
  } catch (error) {
    console.error('Error getting task template:', error);
    throw error;
  }
};

/**
 * Update a task template
 */
export const updateTaskTemplate = async (templateId, updates) => {
  try {
    const templateRef = doc(firestore, 'taskTemplates', templateId);
    await updateDoc(templateRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });

    readCounter.recordRead('write', 'taskTemplates', 'updateTaskTemplate', 1);
  } catch (error) {
    console.error('Error updating task template:', error);
    throw error;
  }
};

/**
 * Delete a task template
 */
export const deleteTaskTemplate = async (templateId) => {
  try {
    const templateRef = doc(firestore, 'taskTemplates', templateId);
    await deleteDoc(templateRef);

    readCounter.recordRead('write', 'taskTemplates', 'deleteTaskTemplate', 1);
  } catch (error) {
    console.error('Error deleting task template:', error);
    throw error;
  }
};

/**
 * Create a task from a template
 */
export const createTaskFromTemplate = async (template, overrides = {}) => {
  const taskData = {
    title: template.title,
    description: template.description || '',
    priority: template.priority || 'medium',
    type: template.type || 'general',
    status: template.status || 'todo',
    tags: template.tags || [],
    assignedTo: overrides.assignedTo || template.assignedTo || null,
    dueDate: overrides.dueDate || null,
    subtasks: template.subtasks || [],
    checklist: template.checklist || [],
    estimatedTime: template.estimatedTime || null,
    ...overrides
  };

  return taskData;
};
