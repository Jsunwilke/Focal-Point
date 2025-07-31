// src/components/shared/GoogleMapModal.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { GoogleMap, LoadScript, Marker, useJsApiLoader } from "@react-google-maps/api";
import { X, Search, MapPin, Navigation } from "lucide-react";
import Button from "./Button";
import "./MapModal.css";

const libraries = ["places", "marker"];

const GoogleMapModal = ({ 
  isOpen, 
  onClose, 
  initialCoordinates = [39.7817, -89.6501], // Default to Springfield, IL
  initialAddress = "",
  onCoordinatesChange,
  title = "Set Location",
  subtitle = "Search for an address or drag the pin to set the exact location",
  organizationAddress = null
}) => {
  const [position, setPosition] = useState(initialCoordinates);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [map, setMap] = useState(null);
  const [geocoder, setGeocoder] = useState(null);
  const [marker, setMarker] = useState(null);
  const [autocomplete, setAutocomplete] = useState(null);
  const searchInputRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  const [organizationCoordinates, setOrganizationCoordinates] = useState(null);
  const [organizationCity, setOrganizationCity] = useState(null);

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  
  // Debug logging
  if (!apiKey) {
    console.warn("Google Maps API key is not configured. Please add REACT_APP_GOOGLE_MAPS_API_KEY to your .env file and restart the development server.");
  }
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || "",
    libraries
  });

  // Initialize geocoder when API is loaded
  useEffect(() => {
    if (isLoaded && window.google) {
      setGeocoder(new window.google.maps.Geocoder());
    }
  }, [isLoaded]);

  // Geocode organization address when available
  useEffect(() => {
    if (!geocoder || !organizationAddress || organizationCoordinates) return;
    
    // Build address string from organization address object
    const { street, city, state, zipCode } = organizationAddress;
    const addressParts = [street, city, state, zipCode].filter(Boolean);
    
    if (addressParts.length > 0) {
      const fullAddress = addressParts.join(", ");
      
      // Store the city for later use
      if (city) {
        setOrganizationCity(city);
      }
      
      geocoder.geocode({ address: fullAddress }, (results, status) => {
        if (status === "OK" && results[0]) {
          const location = results[0].geometry.location;
          setOrganizationCoordinates({
            lat: location.lat(),
            lng: location.lng()
          });
        } else {
          console.warn("Could not geocode organization address:", fullAddress);
        }
      });
    }
  }, [geocoder, organizationAddress, organizationCoordinates]);

  // Initialize traditional Places Autocomplete when modal opens
  useEffect(() => {
    if (!isOpen || !isLoaded || !window.google || !searchInputRef.current || autocomplete) return;
    
    try {
      // Create session token for better autocomplete results
      const sessionToken = new window.google.maps.places.AutocompleteSessionToken();
      
      // Configure autocomplete with strong location bias
      const autocompleteOptions = {
        componentRestrictions: { country: 'us' },
        types: ['address'],
        fields: ['formatted_address', 'geometry', 'name'],
        sessionToken: sessionToken
      };
      
      // Add location-specific options if organization coordinates available
      if (organizationCoordinates) {
        // Use location + radius for stronger bias than bounds
        autocompleteOptions.location = new window.google.maps.LatLng(
          organizationCoordinates.lat, 
          organizationCoordinates.lng
        );
        autocompleteOptions.radius = 80000; // 80km (~50 miles) radius for strong local bias
        autocompleteOptions.strictBounds = false; // Allow results outside but strongly prefer within
      }
      
      const autocompleteInstance = new window.google.maps.places.Autocomplete(
        searchInputRef.current, 
        autocompleteOptions
      );
      
      // Listen for place selection
      const placeChangedListener = autocompleteInstance.addListener('place_changed', () => {
        const place = autocompleteInstance.getPlace();
        
        if (place.geometry && place.geometry.location) {
          const location = place.geometry.location;
          const newPosition = [location.lat(), location.lng()];
          setPosition(newPosition);
          
          // Update search query and input value with the formatted address
          const address = place.formatted_address || place.name || '';
          setSearchQuery(address);
          setInputValue(address);
          
          // Pan map to new location
          if (map) {
            map.panTo(location);
            map.setZoom(18);
          }
          
          setSearchError("");
        }
      });
      
      setAutocomplete(autocompleteInstance);
      
      // Cleanup function
      return () => {
        if (placeChangedListener) {
          window.google.maps.event.removeListener(placeChangedListener);
        }
      };
    } catch (error) {
      console.error("Error initializing Autocomplete:", error);
      // Autocomplete not available, will fall back to manual search
    }
  }, [isOpen, isLoaded, map, organizationCoordinates]);

  // Update position when initial coordinates change
  useEffect(() => {
    if (initialCoordinates && initialCoordinates.length === 2) {
      setPosition(initialCoordinates);
    }
  }, [initialCoordinates]);

  // Initialize input value when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(initialAddress || searchQuery || "");
    }
  }, [isOpen, initialAddress]);

  // Auto-geocode initial address when modal opens
  useEffect(() => {
    const autoGeocodeInitialAddress = async () => {
      if (isOpen && initialAddress && initialAddress.trim() && geocoder) {
        setSearchQuery(initialAddress);
        setIsSearching(true);
        setSearchError("");

        try {
          geocoder.geocode({ address: initialAddress }, (results, status) => {
            if (status === "OK" && results[0]) {
              const location = results[0].geometry.location;
              const newPosition = [location.lat(), location.lng()];
              setPosition(newPosition);
              
              // Pan map to new location
              if (map) {
                map.panTo(location);
                map.setZoom(18);
              }
              setIsSearching(false);
            } else {
              setSearchError(`Could not find location for: ${initialAddress}`);
              setIsSearching(false);
            }
          });
        } catch (error) {
          console.error("Auto-geocoding error:", error);
          setSearchError(`Failed to locate: ${initialAddress}`);
          setIsSearching(false);
        }
      }
    };

    autoGeocodeInitialAddress();
  }, [isOpen, initialAddress, geocoder, map]);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim() || !geocoder) return;

    setIsSearching(true);
    setSearchError("");

    // If search doesn't include a comma (no city/state), add organization city if available
    let searchAddress = searchQuery;
    if (!searchQuery.includes(',') && organizationCity) {
      searchAddress = `${searchQuery}, ${organizationCity}`;
      console.log("Enhanced search with city:", searchAddress);
    }

    geocoder.geocode({ address: searchAddress }, (results, status) => {
      if (status === "OK" && results[0]) {
        const location = results[0].geometry.location;
        const newPosition = [location.lat(), location.lng()];
        setPosition(newPosition);
        
        // Pan map to new location
        if (map) {
          map.panTo(location);
          map.setZoom(18);
        }
        
        // Update input with the full address
        const fullAddress = results[0].formatted_address;
        setInputValue(fullAddress);
        setSearchQuery(fullAddress);
      } else {
        // If enhanced search failed, try original query
        if (searchAddress !== searchQuery) {
          geocoder.geocode({ address: searchQuery }, (fallbackResults, fallbackStatus) => {
            if (fallbackStatus === "OK" && fallbackResults[0]) {
              const location = fallbackResults[0].geometry.location;
              const newPosition = [location.lat(), location.lng()];
              setPosition(newPosition);
              
              if (map) {
                map.panTo(location);
                map.setZoom(18);
              }
              
              const fullAddress = fallbackResults[0].formatted_address;
              setInputValue(fullAddress);
              setSearchQuery(fullAddress);
            } else {
              setSearchError("No results found for this address");
            }
          });
        } else {
          setSearchError("No results found for this address");
        }
      }
      setIsSearching(false);
    });
  }, [searchQuery, geocoder, map, organizationCity]);


  const handleSearchKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleUseLocation = () => {
    onCoordinatesChange(position);
    onClose();
  };

  const handleCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (geoPosition) => {
          const newPos = [geoPosition.coords.latitude, geoPosition.coords.longitude];
          setPosition(newPos);
          if (map) {
            map.panTo({ lat: newPos[0], lng: newPos[1] });
            map.setZoom(18);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setSearchError("Unable to get your current location");
        }
      );
    } else {
      setSearchError("Geolocation is not supported by this browser");
    }
  };

  const onMapLoad = useCallback((map) => {
    setMap(map);
  }, []);

  const onMarkerLoad = useCallback((marker) => {
    setMarker(marker);
  }, []);

  const onMarkerDragEnd = useCallback((e) => {
    const newPosition = [e.latLng.lat(), e.latLng.lng()];
    setPosition(newPosition);
    setSearchError("");
  }, []);

  const formatCoordinates = (coords) => {
    if (!coords || coords.length !== 2) return "0.0000, 0.0000";
    return `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
  };

  if (!isOpen) return null;

  if (loadError) {
    return (
      <div className="map-modal-error">
        <p>Error loading Google Maps. Please check your API key.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="map-modal-loading">
        <p>Loading Google Maps...</p>
      </div>
    );
  }

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="map-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="map-modal__header">
          <div className="map-modal__header-content">
            <h2 className="map-modal__title">
              <MapPin size={20} />
              {title}
            </h2>
            <p className="map-modal__subtitle">
              {initialAddress 
                ? `Setting location for: ${initialAddress}`
                : subtitle
              }
            </p>
          </div>
          <div className="map-modal__header-controls">
            <button className="map-modal__close" onClick={onClose} type="button">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="map-modal__search">
          <div className="map-modal__search-input">
            <Search size={16} className="map-modal__search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Enter address to search..."
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setSearchQuery(e.target.value);
              }}
              onKeyDown={handleSearchKeyPress}
              className="map-modal__search-field"
              disabled={isSearching}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="map-modal__search-btn"
            >
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>
          
          <Button
            type="button"
            variant="outline"
            onClick={handleCurrentLocation}
            className="map-modal__location-btn"
          >
            <Navigation size={16} />
            Use My Location
          </Button>
        </div>

        {(searchError || (isSearching && initialAddress)) && (
          <div className={`map-modal__${searchError ? 'error' : 'info'}`}>
            {searchError || (isSearching && initialAddress ? `Finding location for: ${initialAddress}...` : "")}
          </div>
        )}

        <div className="map-modal__map-container">
          <GoogleMap
            mapContainerStyle={{
              width: '100%',
              height: '400px'
            }}
            center={{ lat: position[0], lng: position[1] }}
            zoom={18}
            onLoad={onMapLoad}
            options={{
              mapTypeId: 'hybrid', // Satellite view with labels
              mapTypeControl: true,
              streetViewControl: false,
              fullscreenControl: false,
              clickableIcons: false,
              mapTypeControlOptions: {
                mapTypeIds: ['roadmap', 'satellite', 'hybrid'],
                position: window.google?.maps?.ControlPosition?.TOP_RIGHT
              }
            }}
          >
            <Marker
              position={{ lat: position[0], lng: position[1] }}
              draggable={true}
              onLoad={onMarkerLoad}
              onDragEnd={onMarkerDragEnd}
            />
          </GoogleMap>
        </div>

        <div className="map-modal__coordinates">
          <div className="map-modal__coordinates-info">
            <span className="map-modal__coordinates-label">
              GPS Coordinates:
            </span>
            <span className="map-modal__coordinates-value">
              {formatCoordinates(position)}
            </span>
          </div>
          <p className="map-modal__coordinates-hint">
            Drag the pin to update the location
          </p>
        </div>

        <div className="map-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleUseLocation}>
            <MapPin size={16} />
            Use This Location
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default GoogleMapModal;