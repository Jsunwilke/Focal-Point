// Helper function to count valid athletes (those with last names)
export const countValidAthletes = (roster) => {
  if (!roster || !Array.isArray(roster)) return 0;
  return roster.filter(
    (athlete) => athlete.lastName && athlete.lastName.trim() !== ""
  ).length;
};

// Helper function to count photographed athletes (those with image numbers)
export const countPhotographedAthletes = (roster) => {
  if (!roster || !Array.isArray(roster)) return 0;
  return roster.filter(
    (athlete) => athlete.imageNumbers && athlete.imageNumbers.trim() !== ""
  ).length;
};

// Generate unique ID for new entries
export const generateUniqueId = () => {
  return "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
};

// Calculate job statistics
export const calculateJobStats = (roster) => {
  const stats = {
    sportStats: {},
    totalSports: 0,
    totalAthletes: 0,
    totalPhotographed: 0,
    overallPercentage: 0,
  };

  if (!roster || !Array.isArray(roster)) return stats;

  roster.forEach((athlete) => {
    // Only count athletes with last names (valid athletes)
    if (!athlete.lastName || athlete.lastName.trim() === "") return;

    const sport = athlete.group || "No Sport Assigned";

    if (!stats.sportStats[sport]) {
      stats.sportStats[sport] = {
        total: 0,
        photographed: 0,
      };
    }

    stats.sportStats[sport].total++;
    stats.totalAthletes++;

    if (athlete.imageNumbers && athlete.imageNumbers.trim() !== "") {
      stats.sportStats[sport].photographed++;
      stats.totalPhotographed++;
    }
  });

  stats.totalSports = Object.keys(stats.sportStats).length;
  stats.overallPercentage =
    stats.totalAthletes > 0
      ? Math.round((stats.totalPhotographed / stats.totalAthletes) * 100)
      : 0;

  return stats;
};

// Calculate organization-wide statistics
export const calculateOrganizationStats = (allJobs) => {
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
    totalShoots: 0,
    overallPercentage: 0,
  };

  if (!allJobs || !Array.isArray(allJobs)) return stats;

  // Track unique job IDs for shoot counting
  const processedJobs = new Set();

  allJobs.forEach((job) => {
    // Skip League jobs for organization stats
    if (job.seasonType === "League") return;

    // Only include Fall, Winter, and Spring Sports
    if (
      !["Fall Sports", "Winter Sports", "Spring Sports"].includes(
        job.seasonType
      )
    )
      return;

    // Count this job as a shoot
    if (job.id && !processedJobs.has(job.id)) {
      processedJobs.add(job.id);
      stats.totalShoots++;
    }

    // Track schools
    if (job.schoolName) {
      stats.totalSchools.add(job.schoolName);
    }

    // Process roster
    if (job.roster && Array.isArray(job.roster)) {
      job.roster.forEach((athlete) => {
        // Only count athletes with last names
        if (!athlete.lastName || athlete.lastName.trim() === "") return;

        // Exclude league sports based on common patterns
        const sport = (athlete.group || "").toLowerCase();
        const isLeagueSport =
          sport.includes("coach pitch") ||
          sport.includes("ll boys") ||
          sport.includes("ll girls") ||
          sport.includes("tee ball") ||
          sport.includes("little league") ||
          sport.includes("coach-pitch") ||
          sport.includes("t-ball");

        if (isLeagueSport) return;

        const sportName = athlete.group || "No Sport Assigned";

        if (!stats.sportStats[sportName]) {
          stats.sportStats[sportName] = {
            total: 0,
            photographed: 0,
            shoots: new Set(),
            shootCount: 0,
            averagePhotographedPerShoot: 0,
          };
        }

        // Track which jobs this sport appears in
        if (job.id) {
          stats.sportStats[sportName].shoots.add(job.id);
        }

        stats.sportStats[sportName].total++;
        stats.totalAthletes++;

        if (athlete.imageNumbers && athlete.imageNumbers.trim() !== "") {
          stats.sportStats[sportName].photographed++;
          stats.totalPhotographed++;
        }

        // Track by season type
        if (job.seasonType && stats.seasonStats[job.seasonType]) {
          stats.seasonStats[job.seasonType].total++;
          if (athlete.imageNumbers && athlete.imageNumbers.trim() !== "") {
            stats.seasonStats[job.seasonType].photographed++;
          }
        }
      });
    }
  });

  // Process sport stats to calculate shoot counts and averages
  Object.keys(stats.sportStats).forEach((sport) => {
    const sportData = stats.sportStats[sport];
    sportData.shootCount = sportData.shoots.size;
    sportData.averagePhotographedPerShoot =
      sportData.shootCount > 0
        ? Math.round(sportData.photographed / sportData.shootCount)
        : 0;

    // Clean up the Set (not needed in final stats)
    delete sportData.shoots;
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
};

// Generate colors for charts
export const generateColors = (count) => {
  const colors = [
    "#ff6384",
    "#36a2eb",
    "#ffce56",
    "#4bc0c0",
    "#9966ff",
    "#ff9f40",
    "#ff6384",
    "#c9cbcf",
    "#4bc0c0",
    "#ff6384",
  ];
  return colors.slice(0, count);
};

// Smart Field Calculation Functions

// Haversine formula to calculate distance between two points
export const calculateDistance = (lat1, lon1, lat2, lon2, unit = "miles") => {
  const R = unit === "miles" ? 3959 : 6371; // Earth's radius in miles or kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

// Geocode address to coordinates
export const geocodeAddress = async (address) => {
  try {
    // For web browsers, we'll use a simple geocoding service
    // In production, you'd want to use Google Maps API or similar
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
    );
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

// Calculate round trip mileage from home to multiple schools
export const calculateRoundTripMileage = async (userAddress, schoolAddresses, unit = "miles") => {
  try {
    if (!userAddress || !schoolAddresses || schoolAddresses.length === 0) {
      return 0;
    }

    // Geocode all addresses
    const homeCoords = await geocodeAddress(userAddress);
    if (!homeCoords) return 0;

    const schoolCoords = await Promise.all(
      schoolAddresses.map(address => geocodeAddress(address))
    );

    // Filter out failed geocoding attempts
    const validSchoolCoords = schoolCoords.filter(coords => coords !== null);
    if (validSchoolCoords.length === 0) return 0;

    // Calculate route: home -> school1 -> school2 -> ... -> home
    let totalDistance = 0;
    let currentCoords = homeCoords;

    // Add distance from home to first school
    for (const schoolCoord of validSchoolCoords) {
      totalDistance += calculateDistance(
        currentCoords.latitude,
        currentCoords.longitude,
        schoolCoord.latitude,
        schoolCoord.longitude,
        unit
      );
      currentCoords = schoolCoord;
    }

    // Add distance from last school back to home
    totalDistance += calculateDistance(
      currentCoords.latitude,
      currentCoords.longitude,
      homeCoords.latitude,
      homeCoords.longitude,
      unit
    );

    return Math.round(totalDistance * 10) / 10; // Round to 1 decimal place
  } catch (error) {
    console.error("Mileage calculation error:", error);
    return 0;
  }
};

// Smart field calculation engine
export const calculateSmartFieldValue = async (field, context) => {
  if (!field.smartConfig) {
    return field.defaultValue || "";
  }

  const { calculation, sourceFields, fallbackValue } = field.smartConfig;

  try {
    switch (calculation) {
      case "roundTripMileage":
        // User coordinates are stored as "lat,lng" format in userCoordinates field
        const userCoordinates = context.userProfile?.userCoordinates;
        if (!userCoordinates) {
          return field.smartConfig.fallbackValue || 0;
        }
        
        // Parse user coordinates
        const [userLat, userLng] = userCoordinates.split(',').map(coord => parseFloat(coord.trim()));
        if (isNaN(userLat) || isNaN(userLng)) {
          return field.smartConfig.fallbackValue || 0;
        }
        
        // Build school addresses or use coordinates if available
        const schoolLocations = context.selectedSchools?.map(school => {
          if (school?.coordinates) {
            // Use coordinates if available
            const [schoolLat, schoolLng] = school.coordinates.split(',').map(coord => parseFloat(coord.trim()));
            if (!isNaN(schoolLat) && !isNaN(schoolLng)) {
              return { lat: schoolLat, lng: schoolLng, type: 'coordinates' };
            }
          }
          
          // Fallback to address if no coordinates
          if (school?.street && school?.city && school?.state && school?.zipCode) {
            const address = `${school.street}, ${school.city}, ${school.state} ${school.zipCode}`;
            return { address, type: 'address' };
          }
          
          return null;
        }).filter(Boolean) || [];
        
        if (schoolLocations.length === 0) {
          return field.smartConfig.fallbackValue || 0;
        }
        
        // Calculate total round-trip mileage
        let totalDistance = 0;
        let currentLat = userLat;
        let currentLng = userLng;
        
        for (const location of schoolLocations) {
          if (location.type === 'coordinates') {
            // Direct coordinate calculation
            totalDistance += calculateDistance(currentLat, currentLng, location.lat, location.lng, field.smartConfig.units);
            currentLat = location.lat;
            currentLng = location.lng;
          } else {
            // Need to geocode address first
            try {
              const coords = await geocodeAddress(location.address);
              if (coords) {
                totalDistance += calculateDistance(currentLat, currentLng, coords.latitude, coords.longitude, field.smartConfig.units);
                currentLat = coords.latitude;
                currentLng = coords.longitude;
              }
            } catch (error) {
              console.error('Geocoding error for school:', location.address, error);
            }
          }
        }
        
        // Add distance back to home
        totalDistance += calculateDistance(currentLat, currentLng, userLat, userLng, field.smartConfig.units);
        
        return Math.round(totalDistance * 10) / 10; // Round to 1 decimal place

      case "currentDate":
        const date = new Date();
        const format = field.smartConfig.format || "US";
        if (format === "US" || format === "MM/DD/YYYY") {
          // US format: MM/DD/YYYY
          return date.toLocaleDateString('en-US');
        } else if (format === "YYYY-MM-DD") {
          return date.toISOString().split('T')[0];
        }
        return date.toLocaleDateString();

      case "currentTime":
        const time = new Date();
        const timeFormat = field.smartConfig.format || "US";
        if (timeFormat === "US" || timeFormat === "12-hour") {
          // US format: 12-hour with AM/PM
          return time.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
        } else if (timeFormat === "HH:mm" || timeFormat === "24-hour") {
          return time.toTimeString().slice(0, 5);
        }
        return time.toLocaleTimeString();

      case "photographerName":
        return context.userProfile?.firstName || 
               context.selectedPhotographer || 
               fallbackValue;

      case "schoolName":
        const schools = context.selectedSchools?.map(school => school?.value).filter(Boolean);
        return schools?.join(", ") || fallbackValue;

      case "photoCount":
        return context.attachedPhotos?.length || 0;

      case "currentLocation":
        // Get current GPS location using browser geolocation API
        if (navigator.geolocation) {
          return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude } = position.coords;
                const format = field.smartConfig.format || "coordinates";
                
                if (format === "coordinates") {
                  // Return as "lat,lng" format like your user coordinates
                  resolve(`${latitude.toFixed(6)},${longitude.toFixed(6)}`);
                } else {
                  // Return as readable format
                  resolve(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
                }
              },
              (error) => {
                console.error('Geolocation error:', error);
                resolve(fallbackValue || "Location unavailable");
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes cache
              }
            );
          });
        }
        return fallbackValue || "Geolocation not supported";

      case "weatherConditions":
        // Get weather conditions using a free weather API
        try {
          // First get current location for weather
          if (navigator.geolocation) {
            return new Promise((resolve) => {
              navigator.geolocation.getCurrentPosition(
                async (position) => {
                  const { latitude, longitude } = position.coords;
                  
                  try {
                    // Using Open-Meteo free weather API (no API key required)
                    const response = await fetch(
                      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=fahrenheit`
                    );
                    const data = await response.json();
                    
                    if (data.current_weather) {
                      const temp = Math.round(data.current_weather.temperature);
                      const weatherCode = data.current_weather.weathercode;
                      
                      // Basic weather condition mapping
                      const conditions = {
                        0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
                        45: "Foggy", 48: "Foggy", 51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
                        61: "Light Rain", 63: "Rain", 65: "Heavy Rain", 71: "Light Snow", 73: "Snow", 75: "Heavy Snow",
                        80: "Rain Showers", 81: "Heavy Showers", 95: "Thunderstorm", 96: "Thunderstorm with Hail"
                      };
                      
                      const condition = conditions[weatherCode] || "Unknown";
                      resolve(`${condition}, ${temp}°F`);
                    } else {
                      resolve(fallbackValue || "Weather unavailable");
                    }
                  } catch (error) {
                    console.error('Weather API error:', error);
                    resolve(fallbackValue || "Weather unavailable");
                  }
                },
                (error) => {
                  console.error('Geolocation error for weather:', error);
                  resolve(fallbackValue || "Location required for weather");
                }
              );
            });
          } else {
            return fallbackValue || "Geolocation not supported";
          }
        } catch (error) {
          console.error('Weather calculation error:', error);
          return fallbackValue || "Weather unavailable";
        }

      case "custom":
        // This would evaluate a custom expression
        // For now, return fallback
        return fallbackValue;

      default:
        return fallbackValue;
    }
  } catch (error) {
    console.error("Smart field calculation error:", error);
    return fallbackValue;
  }
};
