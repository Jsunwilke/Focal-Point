// src/services/sportsFirestoreService.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "../firebase/config";

const SPORTS_JOBS_COLLECTION = "sportsJobs";
const DROPDOWN_DATA_COLLECTION = "schools";

// Sports Jobs Service
export const sportsJobsService = {
  // Create a new sports job
  async createJob(jobData, organizationID) {
    try {
      const job = {
        ...jobData,
        organizationID,
        isArchived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(firestore, SPORTS_JOBS_COLLECTION),
        job
      );
      return docRef.id;
    } catch (error) {
      console.error("Error creating job:", error);
      throw error;
    }
  },

  // Get all jobs for an organization
  async getJobs(organizationID, isArchived = null) {
    try {
      let q = query(
        collection(firestore, SPORTS_JOBS_COLLECTION),
        where("organizationID", "==", organizationID),
        orderBy("shootDate", "desc")
      );

      if (isArchived !== null) {
        q = query(
          collection(firestore, SPORTS_JOBS_COLLECTION),
          where("organizationID", "==", organizationID),
          where("isArchived", "==", isArchived),
          orderBy("shootDate", "desc")
        );
      }

      const querySnapshot = await getDocs(q);
      const jobs = [];

      querySnapshot.forEach((doc) => {
        jobs.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return jobs;
    } catch (error) {
      console.error("Error getting jobs:", error);
      throw error;
    }
  },

  // Get a single job by ID
  async getJob(jobId) {
    try {
      const docRef = doc(firestore, SPORTS_JOBS_COLLECTION, jobId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error getting job:", error);
      throw error;
    }
  },

  // Update a job
  async updateJob(jobId, updates) {
    try {
      const docRef = doc(firestore, SPORTS_JOBS_COLLECTION, jobId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating job:", error);
      throw error;
    }
  },

  // Delete a job
  async deleteJob(jobId) {
    try {
      await deleteDoc(doc(firestore, SPORTS_JOBS_COLLECTION, jobId));
    } catch (error) {
      console.error("Error deleting job:", error);
      throw error;
    }
  },

  // Update job roster
  async updateJobRoster(jobId, roster) {
    try {
      const docRef = doc(firestore, SPORTS_JOBS_COLLECTION, jobId);
      await updateDoc(docRef, {
        roster,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating roster:", error);
      throw error;
    }
  },

  // Update job groups
  async updateJobGroups(jobId, groupImages) {
    try {
      const docRef = doc(firestore, SPORTS_JOBS_COLLECTION, jobId);
      await updateDoc(docRef, {
        groupImages,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating groups:", error);
      throw error;
    }
  },

  // Toggle archive status
  async toggleArchiveStatus(jobId, isArchived) {
    try {
      const docRef = doc(firestore, SPORTS_JOBS_COLLECTION, jobId);
      await updateDoc(docRef, {
        isArchived,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error toggling archive status:", error);
      throw error;
    }
  },

  // Set up real-time listener for jobs
  subscribeToJobs(organizationID, callback, errorCallback) {
    try {
      const q = query(
        collection(firestore, SPORTS_JOBS_COLLECTION),
        where("organizationID", "==", organizationID),
        orderBy("shootDate", "desc")
      );

      return onSnapshot(
        q,
        (snapshot) => {
          const jobs = [];
          snapshot.forEach((doc) => {
            jobs.push({
              id: doc.id,
              ...doc.data(),
            });
          });
          callback(jobs);
        },
        (error) => {
          console.error("Error in jobs listener:", error);
          if (errorCallback) errorCallback(error);
        }
      );
    } catch (error) {
      console.error("Error setting up jobs listener:", error);
      if (errorCallback) errorCallback(error);
    }
  },

  // Batch update multiple jobs (for migration/bulk operations)
  async batchUpdateJobs(updates) {
    try {
      const batch = writeBatch(firestore);

      updates.forEach(({ jobId, data }) => {
        const docRef = doc(firestore, SPORTS_JOBS_COLLECTION, jobId);
        batch.update(docRef, {
          ...data,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
    } catch (error) {
      console.error("Error batch updating jobs:", error);
      throw error;
    }
  },
};

// Dropdown Data Service - Adapted to use existing schools collection
export const dropdownDataService = {
  // Get all school names from the schools collection
  async getSchoolNames(organizationID) {
    try {
      const q = query(
        collection(firestore, "schools"),
        where("organizationID", "==", organizationID),
        orderBy("name", "asc")
      );

      const querySnapshot = await getDocs(q);
      const schools = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.name) {
          schools.push(data.name);
        }
      });

      return schools;
    } catch (error) {
      console.error("Error getting school names:", error);
      throw error;
    }
  },

  // This is kept for backwards compatibility - but uses schools collection
  async addSchoolName(schoolName, organizationID) {
    try {
      // Check if school already exists
      const q = query(
        collection(firestore, "schools"),
        where("organizationID", "==", organizationID),
        where("name", "==", schoolName.trim())
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Add new school to schools collection
        await addDoc(collection(firestore, "schools"), {
          name: schoolName.trim(),
          organizationID,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Error adding school name:", error);
      throw error;
    }
  },
};

// Player Search Index Service (if using player search index)
export const playerSearchService = {
  // Get organization stats from player search index
  async getOrganizationStats(organizationID) {
    try {
      const q = query(
        collection(firestore, "playerSearchIndex"),
        where("organizationID", "==", organizationID)
      );

      const querySnapshot = await getDocs(q);

      const stats = {
        sportStats: {},
        seasonStats: {
          "Fall Sports": { total: 0, photographed: 0 },
          "Winter Sports": { total: 0, photographed: 0 },
          "Spring Sports": { total: 0, photographed: 0 },
        },
        totalSchools: new Set(),
        totalSports: 0,
        totalAthletes: 0,
        totalPhotographed: 0,
        overallPercentage: 0,
      };

      if (querySnapshot.empty) {
        return stats;
      }

      querySnapshot.forEach((doc) => {
        const player = doc.data();

        // Skip if not valid data or League type
        if (
          !player ||
          !player.lastName ||
          player.lastName.trim() === "" ||
          player.seasonType === "League"
        ) {
          return;
        }

        // Count this player
        stats.totalAthletes++;

        // Track schools
        if (player.schoolName) {
          stats.totalSchools.add(player.schoolName);
        }

        // Track by sport
        const sport = player.group || "No Sport Assigned";
        if (!stats.sportStats[sport]) {
          stats.sportStats[sport] = {
            total: 0,
            photographed: 0,
            shoots: new Set(),
            schoolShootCombos: new Set(),
          };
        }
        stats.sportStats[sport].total++;

        // Track shoots and school-shoot combinations for this sport
        if (player.jobId) {
          stats.sportStats[sport].shoots.add(player.jobId);
          if (player.schoolName) {
            stats.sportStats[sport].schoolShootCombos.add(
              `${player.schoolName}-${player.jobId}`
            );
          }
        }

        // Track if photographed
        if (player.imageNumbers && player.imageNumbers.trim() !== "") {
          stats.sportStats[sport].photographed++;
          stats.totalPhotographed++;
        }

        // Track by season
        if (stats.seasonStats[player.seasonType]) {
          stats.seasonStats[player.seasonType].total++;
          if (player.imageNumbers && player.imageNumbers.trim() !== "") {
            stats.seasonStats[player.seasonType].photographed++;
          }
        }
      });

      // Convert Sets to counts and calculate averages
      Object.keys(stats.sportStats).forEach((sport) => {
        const sportData = stats.sportStats[sport];
        sportData.shootCount = sportData.shoots.size;
        sportData.averagePhotographedPerShoot =
          sportData.shootCount > 0
            ? Math.round(sportData.photographed / sportData.shootCount)
            : 0;

        // Clean up the Sets
        delete sportData.shoots;
        delete sportData.schoolShootCombos;
      });

      // Convert school Set to count
      stats.totalSchools = stats.totalSchools.size;
      stats.totalSports = Object.keys(stats.sportStats).length;

      // Calculate overall percentage
      stats.overallPercentage =
        stats.totalAthletes > 0
          ? Math.round((stats.totalPhotographed / stats.totalAthletes) * 100)
          : 0;

      return stats;
    } catch (error) {
      console.error("Error getting organization stats:", error);
      throw error;
    }
  },
};
