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
    return [DEFAULT_SESSION_TYPE];
  }

  const customTypes = organization.sessionTypes || [];
  
  // Always ensure "Other" is available
  const hasOther = customTypes.some(type => type.id === 'other');
  if (!hasOther) {
    return [...customTypes, DEFAULT_SESSION_TYPE];
  }
  
  return customTypes;
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
    { id: 'sports', name: 'Sports Photography', color: '#8b5cf6' },
    { id: 'portrait', name: 'Portrait Day', color: '#3b82f6' },
    { id: 'event', name: 'School Event', color: '#f59e0b' },
    { id: 'graduation', name: 'Graduation', color: '#10b981' },
    DEFAULT_SESSION_TYPE
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