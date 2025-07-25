// src/utils/sessionTypes.js
// Utility functions for managing session types

// Default session type that always exists
export const DEFAULT_SESSION_TYPE = {
  id: 'other',
  name: 'Other',
  color: '#000000'
};

// Get session types for an organization
export const getOrganizationSessionTypes = (organization) => {
  if (!organization) {
    return [{ ...DEFAULT_SESSION_TYPE, order: 9999 }];
  }

  let customTypes = organization.sessionTypes || [];
  
  // Add order field to types that don't have it (backward compatibility)
  customTypes = customTypes.map((type, index) => ({
    ...type,
    order: type.order !== undefined ? type.order : (type.id === 'other' ? 9999 : index + 1)
  }));
  
  // Always ensure "Other" is available
  const hasOther = customTypes.some(type => type.id === 'other');
  if (!hasOther) {
    customTypes.push({ ...DEFAULT_SESSION_TYPE, order: 9999 });
  }
  
  // Sort by order, ensuring "Other" is always last
  return customTypes.sort((a, b) => {
    // Other always goes last
    if (a.id === 'other') return 1;
    if (b.id === 'other') return -1;
    // Sort by order field
    return (a.order || 0) - (b.order || 0);
  });
};

// Get color for a session type (handles both single string and array)
export const getSessionTypeColor = (sessionType, organization) => {
  if (!sessionType) {
    return DEFAULT_SESSION_TYPE.color;
  }

  // Handle array of session types - return first color for now
  if (Array.isArray(sessionType)) {
    if (sessionType.length === 0) {
      return DEFAULT_SESSION_TYPE.color;
    }
    sessionType = sessionType[0];
  }

  const sessionTypes = getOrganizationSessionTypes(organization);
  const typeConfig = sessionTypes.find(type => 
    type.id === sessionType || type.name.toLowerCase() === sessionType.toLowerCase()
  );
  
  return typeConfig ? typeConfig.color : DEFAULT_SESSION_TYPE.color;
};

// Get colors for multiple session types
export const getSessionTypeColors = (sessionTypes, organization) => {
  if (!sessionTypes) {
    return [DEFAULT_SESSION_TYPE.color];
  }

  // Handle single session type (backward compatibility)
  if (typeof sessionTypes === 'string') {
    return [getSessionTypeColor(sessionTypes, organization)];
  }

  // Handle array of session types
  if (Array.isArray(sessionTypes)) {
    if (sessionTypes.length === 0) {
      return [DEFAULT_SESSION_TYPE.color];
    }
    
    const orgSessionTypes = getOrganizationSessionTypes(organization);
    return sessionTypes.map(type => {
      const typeConfig = orgSessionTypes.find(orgType => 
        orgType.id === type || orgType.name.toLowerCase() === type.toLowerCase()
      );
      return typeConfig ? typeConfig.color : DEFAULT_SESSION_TYPE.color;
    });
  }

  return [DEFAULT_SESSION_TYPE.color];
};

// Get session type name for display (handles both single string and array)
export const getSessionTypeName = (sessionType, organization) => {
  if (!sessionType) {
    return DEFAULT_SESSION_TYPE.name;
  }

  // Handle array of session types
  if (Array.isArray(sessionType)) {
    if (sessionType.length === 0) {
      return DEFAULT_SESSION_TYPE.name;
    }
    sessionType = sessionType[0];
  }

  const sessionTypes = getOrganizationSessionTypes(organization);
  const typeConfig = sessionTypes.find(type => 
    type.id === sessionType || type.name.toLowerCase() === sessionType.toLowerCase()
  );
  
  return typeConfig ? typeConfig.name : sessionType;
};

// Get session type names for multiple types
export const getSessionTypeNames = (sessionTypes, organization) => {
  if (!sessionTypes) {
    return [DEFAULT_SESSION_TYPE.name];
  }

  // Handle single session type (backward compatibility)
  if (typeof sessionTypes === 'string') {
    return [getSessionTypeName(sessionTypes, organization)];
  }

  // Handle array of session types
  if (Array.isArray(sessionTypes)) {
    if (sessionTypes.length === 0) {
      return [DEFAULT_SESSION_TYPE.name];
    }
    
    const orgSessionTypes = getOrganizationSessionTypes(organization);
    return sessionTypes.map(type => {
      const typeConfig = orgSessionTypes.find(orgType => 
        orgType.id === type || orgType.name.toLowerCase() === type.toLowerCase()
      );
      return typeConfig ? typeConfig.name : type;
    });
  }

  return [DEFAULT_SESSION_TYPE.name];
};

// Create a new session type
export const createSessionType = (name, color) => {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    name: name,
    color: color
  };
};

// Validate session type data
export const validateSessionType = (sessionType) => {
  const errors = {};
  
  if (!sessionType.name || sessionType.name.trim() === '') {
    errors.name = 'Session type name is required';
  }
  
  if (!sessionType.color || !/^#[0-9A-F]{6}$/i.test(sessionType.color)) {
    errors.color = 'Valid hex color is required';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Get default session types for new organizations
export const getDefaultSessionTypesForNewOrg = () => {
  return [
    { id: 'sports', name: 'Sports Photography', color: '#8b5cf6', order: 1 },
    { id: 'portrait', name: 'Portrait Day', color: '#3b82f6', order: 2 },
    { id: 'event', name: 'School Event', color: '#f59e0b', order: 3 },
    { id: 'graduation', name: 'Graduation', color: '#10b981', order: 4 },
    { ...DEFAULT_SESSION_TYPE, order: 9999 } // Other always last
  ];
};

// Helper function to ensure sessionTypes is always an array
export const normalizeSessionTypes = (sessionTypes) => {
  if (!sessionTypes) {
    return ['other'];
  }
  
  if (typeof sessionTypes === 'string') {
    return [sessionTypes];
  }
  
  if (Array.isArray(sessionTypes)) {
    return sessionTypes.length > 0 ? sessionTypes : ['other'];
  }
  
  return ['other'];
};

// Helper function to get the primary session type for backwards compatibility
export const getPrimarySessionType = (sessionTypes) => {
  const normalized = normalizeSessionTypes(sessionTypes);
  return normalized[0];
};

// Reorder session types array
export const reorderSessionTypes = (sessionTypes, fromIndex, toIndex) => {
  const result = Array.from(sessionTypes);
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  
  // Update order values based on new positions
  return result.map((type, index) => ({
    ...type,
    order: type.id === 'other' ? 9999 : index + 1
  }));
};

// Get the next order value for a new session type
export const getNextSessionTypeOrder = (sessionTypes) => {
  const nonOtherTypes = sessionTypes.filter(type => type.id !== 'other');
  if (nonOtherTypes.length === 0) return 1;
  
  const maxOrder = Math.max(...nonOtherTypes.map(type => type.order || 0));
  return maxOrder + 1;
};