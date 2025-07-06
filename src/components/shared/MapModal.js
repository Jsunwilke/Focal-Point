// src/components/shared/MapModal.js
import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { OpenStreetMapProvider } from "leaflet-geosearch";
import { X, Search, MapPin, Navigation, Map, Satellite } from "lucide-react";
import Button from "./Button";
import "leaflet/dist/leaflet.css";
import "./MapModal.css";

// Fix for default marker icons in React Leaflet
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom draggable marker component
const DraggableMarker = ({ position, onPositionChange }) => {
  const markerRef = useRef(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const newPosition = marker.getLatLng();
        onPositionChange([newPosition.lat, newPosition.lng]);
      }
    },
  };

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
};

// Component to handle map clicks
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
};

const MapModal = ({ 
  isOpen, 
  onClose, 
  initialCoordinates = [39.7817, -89.6501], // Default to Springfield, IL
  initialAddress = "",
  onCoordinatesChange 
}) => {
  const [position, setPosition] = useState(initialCoordinates);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [mapCenter, setMapCenter] = useState(initialCoordinates);
  const [viewMode, setViewMode] = useState("satellite"); // Default to satellite for parking identification
  const mapRef = useRef(null);
  const provider = useRef(new OpenStreetMapProvider());

  // Update position when initial coordinates change
  useEffect(() => {
    if (initialCoordinates && initialCoordinates.length === 2) {
      setPosition(initialCoordinates);
      setMapCenter(initialCoordinates);
    }
  }, [initialCoordinates]);

  // Auto-geocode initial address when modal opens
  useEffect(() => {
    const autoGeocodeInitialAddress = async () => {
      if (isOpen && initialAddress && initialAddress.trim()) {
        setSearchQuery(initialAddress);
        setIsSearching(true);
        setSearchError("");

        try {
          const results = await provider.current.search({ query: initialAddress });
          
          if (results && results.length > 0) {
            const result = results[0];
            const newPosition = [result.y, result.x]; // lat, lng
            setPosition(newPosition);
            setMapCenter(newPosition);
            
            // Pan map to new location
            if (mapRef.current) {
              mapRef.current.setView(newPosition, 18);
            }
          } else {
            setSearchError(`Could not find location for: ${initialAddress}`);
          }
        } catch (error) {
          console.error("Auto-geocoding error:", error);
          setSearchError(`Failed to locate: ${initialAddress}`);
        } finally {
          setIsSearching(false);
        }
      }
    };

    autoGeocodeInitialAddress();
  }, [isOpen, initialAddress]);

  const handlePositionChange = (newPosition) => {
    setPosition(newPosition);
    // Clear any search errors when user manually moves marker
    setSearchError("");
  };

  const handleMapClick = (newPosition) => {
    setPosition(newPosition);
    setSearchError("");
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError("");

    try {
      const results = await provider.current.search({ query: searchQuery });
      
      if (results && results.length > 0) {
        const result = results[0];
        const newPosition = [result.y, result.x]; // lat, lng
        setPosition(newPosition);
        setMapCenter(newPosition);
        
        // Pan map to new location
        if (mapRef.current) {
          mapRef.current.setView(newPosition, 18);
        }
      } else {
        setSearchError("No results found for this address");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setSearchError("Failed to search for address. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

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

  const formatCoordinates = (coords) => {
    if (!coords || coords.length !== 2) return "0.0000, 0.0000";
    return `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === "street" ? "satellite" : "street");
  };

  const getTileLayerConfig = () => {
    if (viewMode === "satellite") {
      return {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      };
    } else {
      return {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      };
    }
  };

  const handleCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPos = [position.coords.latitude, position.coords.longitude];
          setPosition(newPos);
          setMapCenter(newPos);
          if (mapRef.current) {
            mapRef.current.setView(newPos, 18);
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

  if (!isOpen) return null;

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
              Set School Location
            </h2>
            <p className="map-modal__subtitle">
              {initialAddress 
                ? `Setting location for: ${initialAddress}`
                : "Search for an address or drag the pin to set the exact location"
              }
            </p>
          </div>
          <div className="map-modal__header-controls">
            <Button
              type="button"
              variant="outline"
              onClick={toggleViewMode}
              className="map-modal__view-toggle"
            >
              {viewMode === "satellite" ? (
                <>
                  <Map size={16} />
                  Street View
                </>
              ) : (
                <>
                  <Satellite size={16} />
                  Satellite View
                </>
              )}
            </Button>
            <button className="map-modal__close" onClick={onClose} type="button">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="map-modal__search">
          <div className="map-modal__search-input">
            <Search size={16} className="map-modal__search-icon" />
            <input
              type="text"
              placeholder="Enter school address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleSearchKeyPress}
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
          <MapContainer
            center={mapCenter}
            zoom={18}
            minZoom={15}
            maxZoom={20}
            maxNativeZoom={18}
            zoomSnap={0.5}
            style={{ height: "400px", width: "100%" }}
            ref={mapRef}
          >
            <TileLayer
              key={viewMode} // Force re-render when viewMode changes
              attribution={getTileLayerConfig().attribution}
              url={getTileLayerConfig().url}
            />
            <DraggableMarker
              position={position}
              onPositionChange={handlePositionChange}
            />
            <MapClickHandler onMapClick={handleMapClick} />
          </MapContainer>
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
            Drag the pin or click on the map to update the location
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

export default MapModal;