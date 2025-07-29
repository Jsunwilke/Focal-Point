import { Timestamp } from 'firebase/firestore';

class OrganizationCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_org_';
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
    this.TEAM_CACHE_AGE = 60 * 60 * 1000; // 1 hour for team members
  }

  // Schools cache key
  getSchoolsKey(organizationId) {
    return `${this.CACHE_PREFIX}schools_${organizationId}`;
  }

  // Team members cache key
  getTeamMembersKey(organizationId) {
    return `${this.CACHE_PREFIX}team_${organizationId}`;
  }

  // Organization data cache key
  getOrganizationKey(organizationId) {
    return `${this.CACHE_PREFIX}data_${organizationId}`;
  }

  // Cache schools
  setCachedSchools(organizationId, schools) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        organizationId,
        data: schools
      };
      localStorage.setItem(this.getSchoolsKey(organizationId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache schools:', error);
    }
  }

  // Get cached schools
  getCachedSchools(organizationId) {
    try {
      const key = this.getSchoolsKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.MAX_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached schools:', error);
      return null;
    }
  }

  // Cache team members
  setCachedTeamMembers(organizationId, members) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        organizationId,
        data: members.map(member => this.serializeUser(member))
      };
      localStorage.setItem(this.getTeamMembersKey(organizationId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache team members:', error);
    }
  }

  // Get cached team members
  getCachedTeamMembers(organizationId) {
    try {
      const key = this.getTeamMembersKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age (shorter for team members)
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.TEAM_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      // Deserialize members
      const members = cacheData.data.map(member => this.deserializeUser(member));
      return members;
    } catch (error) {
      console.warn('Failed to retrieve cached team members:', error);
      return null;
    }
  }

  // Cache organization data
  setCachedOrganization(organizationId, orgData) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: this.serializeOrganization(orgData)
      };
      localStorage.setItem(this.getOrganizationKey(organizationId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache organization data:', error);
    }
  }

  // Get cached organization data
  getCachedOrganization(organizationId) {
    try {
      const key = this.getOrganizationKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.MAX_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      return this.deserializeOrganization(cacheData.data);
    } catch (error) {
      console.warn('Failed to retrieve cached organization:', error);
      return null;
    }
  }

  // Update single school in cache
  updateCachedSchool(organizationId, updatedSchool) {
    try {
      const cachedSchools = this.getCachedSchools(organizationId);
      if (!cachedSchools) return;

      const index = cachedSchools.findIndex(school => school.id === updatedSchool.id);
      if (index !== -1) {
        cachedSchools[index] = updatedSchool;
        this.setCachedSchools(organizationId, cachedSchools);
      }
    } catch (error) {
      console.warn('Failed to update cached school:', error);
    }
  }

  // Remove school from cache
  removeCachedSchool(organizationId, schoolId) {
    try {
      const cachedSchools = this.getCachedSchools(organizationId);
      if (!cachedSchools) return;

      const filteredSchools = cachedSchools.filter(school => school.id !== schoolId);
      this.setCachedSchools(organizationId, filteredSchools);
    } catch (error) {
      console.warn('Failed to remove cached school:', error);
    }
  }

  // Clear specific caches
  clearSchoolsCache(organizationId) {
    try {
      localStorage.removeItem(this.getSchoolsKey(organizationId));
    } catch (error) {
      console.warn('Failed to clear schools cache:', error);
    }
  }

  clearTeamMembersCache(organizationId) {
    try {
      localStorage.removeItem(this.getTeamMembersKey(organizationId));
    } catch (error) {
      console.warn('Failed to clear team members cache:', error);
    }
  }

  clearOrganizationCache(organizationId) {
    try {
      localStorage.removeItem(this.getOrganizationKey(organizationId));
      this.clearSchoolsCache(organizationId);
      this.clearTeamMembersCache(organizationId);
    } catch (error) {
      console.warn('Failed to clear organization cache:', error);
    }
  }

  // Serialize user for storage
  serializeUser(user) {
    try {
      const serialized = { ...user };
      
      // Convert Timestamp fields
      const timestampFields = ['createdAt', 'updatedAt', 'lastLogin'];
      timestampFields.forEach(field => {
        if (serialized[field] && serialized[field].toMillis) {
          serialized[field] = {
            _isTimestamp: true,
            seconds: serialized[field].seconds,
            nanoseconds: serialized[field].nanoseconds
          };
        }
      });

      return serialized;
    } catch (error) {
      console.warn('Failed to serialize user:', error);
      return user;
    }
  }

  // Deserialize user from storage
  deserializeUser(user) {
    try {
      const deserialized = { ...user };
      
      // Restore Timestamp fields
      const timestampFields = ['createdAt', 'updatedAt', 'lastLogin'];
      timestampFields.forEach(field => {
        if (deserialized[field]?._isTimestamp) {
          deserialized[field] = new Timestamp(
            deserialized[field].seconds,
            deserialized[field].nanoseconds
          );
        }
      });

      return deserialized;
    } catch (error) {
      console.warn('Failed to deserialize user:', error);
      return user;
    }
  }

  // Serialize organization for storage
  serializeOrganization(org) {
    try {
      const serialized = { ...org };
      
      // Convert Timestamp fields
      if (serialized.createdAt && serialized.createdAt.toMillis) {
        serialized.createdAt = {
          _isTimestamp: true,
          seconds: serialized.createdAt.seconds,
          nanoseconds: serialized.createdAt.nanoseconds
        };
      }
      if (serialized.updatedAt && serialized.updatedAt.toMillis) {
        serialized.updatedAt = {
          _isTimestamp: true,
          seconds: serialized.updatedAt.seconds,
          nanoseconds: serialized.updatedAt.nanoseconds
        };
      }

      return serialized;
    } catch (error) {
      console.warn('Failed to serialize organization:', error);
      return org;
    }
  }

  // Deserialize organization from storage
  deserializeOrganization(org) {
    try {
      const deserialized = { ...org };
      
      // Restore Timestamp fields
      if (deserialized.createdAt?._isTimestamp) {
        deserialized.createdAt = new Timestamp(
          deserialized.createdAt.seconds,
          deserialized.createdAt.nanoseconds
        );
      }
      if (deserialized.updatedAt?._isTimestamp) {
        deserialized.updatedAt = new Timestamp(
          deserialized.updatedAt.seconds,
          deserialized.updatedAt.nanoseconds
        );
      }

      return deserialized;
    } catch (error) {
      console.warn('Failed to deserialize organization:', error);
      return org;
    }
  }

  // Get cache statistics
  getCacheStats(organizationId) {
    try {
      const schools = this.getCachedSchools(organizationId);
      const teamMembers = this.getCachedTeamMembers(organizationId);
      const orgData = this.getCachedOrganization(organizationId);
      
      return {
        hasCachedSchools: !!schools,
        schoolCount: schools ? schools.length : 0,
        hasCachedTeamMembers: !!teamMembers,
        teamMemberCount: teamMembers ? teamMembers.length : 0,
        hasCachedOrgData: !!orgData
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        hasCachedSchools: false,
        schoolCount: 0,
        hasCachedTeamMembers: false,
        teamMemberCount: 0,
        hasCachedOrgData: false
      };
    }
  }

  // Clear all organization caches
  clearAllOrganizationCaches() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} organization cache items`);
    } catch (error) {
      console.warn('Failed to clear all organization caches:', error);
    }
  }
}

// Create singleton instance
export const organizationCacheService = new OrganizationCacheService();
export default organizationCacheService;