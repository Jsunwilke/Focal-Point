// src/components/shared/SimpleAddressField.js
import React, { useState, useEffect } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { MapPin, Edit2 } from "lucide-react";
import Button from "./Button";
import GoogleMapModal from "./GoogleMapModal";
import "./SimpleAddressField.css";

const libraries = ["places", "marker"];

const mapContainerStyle = {
  width: "100%",
  height: "200px",
  borderRadius: "8px"
};

const SimpleAddressField = ({
  value = "",
  onChange,
  onCoordinatesChange,
  placeholder = "No address set",
  label = "Address",
  required = false,
  error = "",
  hint = "",
  disabled = false,
  initialCoordinates = null,
  organizationAddress = null
}) => {
  const [showMapModal, setShowMapModal] = useState(false);
  const [coordinates, setCoordinates] = useState(
    initialCoordinates ? { lat: initialCoordinates[0], lng: initialCoordinates[1] } : null
  );
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || "",
    libraries
  });

  // Parse coordinates from homeAddress string format "lat,lng"
  useEffect(() => {
    if (initialCoordinates && initialCoordinates.length === 2) {
      const newCoords = { lat: initialCoordinates[0], lng: initialCoordinates[1] };
      setCoordinates(newCoords);
      if (map) {
        map.panTo(newCoords);
      }
    }
  }, [initialCoordinates, map]);

  const onMapLoad = (map) => {
    setMap(map);
  };

  // Create/update marker when map and coordinates are ready
  useEffect(() => {
    if (!map || !coordinates) return;

    // Remove old marker if exists
    if (marker) {
      marker.setMap(null);
    }

    // Create standard marker (since we removed mapId)
    const newMarker = new window.google.maps.Marker({
      map: map,
      position: coordinates,
      title: "Current location",
      draggable: false
    });

    setMarker(newMarker);

    // Cleanup
    return () => {
      if (newMarker) {
        newMarker.setMap(null);
      }
    };
  }, [map, coordinates]);

  const handleAddressUpdate = (newCoordinates) => {
    // Update local state
    const coords = { lat: newCoordinates[0], lng: newCoordinates[1] };
    setCoordinates(coords);
    
    // Update parent component
    if (onCoordinatesChange) {
      onCoordinatesChange(newCoordinates);
    }
    
    // Close modal
    setShowMapModal(false);
  };

  if (loadError) {
    return (
      <div className="simple-address-field">
        <label className="form-label">{label}</label>
        <div className="address-field-error">Error loading maps</div>
      </div>
    );
  }

  return (
    <div className="simple-address-field">
      <label className="form-label">
        {label} {required && "*"}
      </label>
      
      <div className="address-input-group">
        <div className="address-input-wrapper">
          <MapPin size={16} className="address-input-icon" />
          <input
            type="text"
            className={`form-input address-input ${error ? "form-input--error" : ""}`}
            value={value || ""}
            onChange={(e) => onChange && onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowMapModal(true)}
          disabled={disabled}
          className="address-update-btn"
        >
          <Edit2 size={14} />
          Update Location
        </Button>
      </div>
      
      {error && <span className="form-error-text">{error}</span>}
      {hint && !error && <span className="form-hint">{hint}</span>}
      
      {isLoaded && coordinates && (
        <div className="address-map-preview">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={coordinates}
            zoom={16}
            onLoad={onMapLoad}
            options={{
              mapTypeId: 'hybrid',
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              zoomControl: true,
              clickableIcons: false
            }}
          >
          </GoogleMap>
        </div>
      )}
      
      {/* Map Modal for updating location */}
      <GoogleMapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        initialCoordinates={coordinates ? [coordinates.lat, coordinates.lng] : [39.7817, -89.6501]}
        initialAddress={value}
        onCoordinatesChange={handleAddressUpdate}
        title="Update Location"
        subtitle="Search for an address or drag the pin to set the location"
        organizationAddress={organizationAddress}
      />
    </div>
  );
};

export default SimpleAddressField;