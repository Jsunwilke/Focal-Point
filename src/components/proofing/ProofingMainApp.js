// src/components/proofing/ProofingMainApp.js
import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import TabNavigation from "./layout/TabNavigation";
import GalleryList from "./galleries/GalleryList";
import SearchControls from "./search/SearchControls";
import CreateGalleryModal from "./CreateGalleryModal";
import GalleryDetailsModal from "./GalleryDetailsModal";
import EditGalleryModal from "./EditGalleryModal";
import { subscribeToGalleries } from "../../services/proofingService";
import { proofingCacheService } from "../../services/proofingCacheService";
import { readCounter } from "../../services/readCounter";

const ProofingMainApp = () => {
  const { userProfile, organization } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [editingGallery, setEditingGallery] = useState(null);
  const [activeGalleries, setActiveGalleries] = useState([]);
  const [archivedGalleries, setArchivedGalleries] = useState([]);

  const [searchState, setSearchState] = useState({
    isActive: false,
    query: "",
  });

  // Load both active and archived galleries
  useEffect(() => {
    if (!organization?.id) return;

    setLoading(true);
    const unsubscribes = [];
    
    // Load active galleries
    const activeCacheKey = `${organization.id}_active`;
    const cachedActive = proofingCacheService.getCachedGalleries(activeCacheKey);
    if (cachedActive && cachedActive.length > 0) {
      setActiveGalleries(cachedActive);
      readCounter.recordCacheHit('proofGalleries', 'ProofingMainApp-Active', cachedActive.length);
    } else {
      readCounter.recordCacheMiss('proofGalleries', 'ProofingMainApp-Active');
    }

    // Subscribe to active galleries
    const unsubscribeActive = subscribeToGalleries(
      organization.id,
      (updatedGalleries) => {
        setActiveGalleries(updatedGalleries);
        proofingCacheService.setCachedGalleries(activeCacheKey, updatedGalleries);
      },
      (error) => {
        console.error("Error loading active galleries:", error);
      },
      false // not archived
    );
    unsubscribes.push(unsubscribeActive);

    // Load archived galleries
    const archivedCacheKey = `${organization.id}_archived`;
    const cachedArchived = proofingCacheService.getCachedGalleries(archivedCacheKey);
    if (cachedArchived && cachedArchived.length > 0) {
      setArchivedGalleries(cachedArchived);
      readCounter.recordCacheHit('proofGalleries', 'ProofingMainApp-Archived', cachedArchived.length);
    } else {
      readCounter.recordCacheMiss('proofGalleries', 'ProofingMainApp-Archived');
    }

    // Subscribe to archived galleries
    const unsubscribeArchived = subscribeToGalleries(
      organization.id,
      (updatedGalleries) => {
        setArchivedGalleries(updatedGalleries);
        proofingCacheService.setCachedGalleries(archivedCacheKey, updatedGalleries);
      },
      (error) => {
        console.error("Error loading archived galleries:", error);
      },
      true // archived
    );
    unsubscribes.push(unsubscribeArchived);

    setLoading(false);

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [organization?.id, showToast]);

  const handleViewGallery = (gallery) => {
    setSelectedGallery(gallery);
    setShowDetailsModal(true);
  };

  const handleEditGallery = (gallery) => {
    setEditingGallery(gallery);
    setShowEditModal(true);
  };

  const handleCreateGallery = () => {
    setShowCreateModal(true);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Reset search when changing tabs
    if (searchState.isActive) {
      setSearchState({
        isActive: false,
        query: "",
      });
    }
  };

  // Get the current galleries based on active tab
  const currentGalleries = activeTab === "archived" ? archivedGalleries : activeGalleries;

  // Show loading spinner while data is loading
  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading Proofing Galleries...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="proofing-container">
      {/* Header */}
      <div className="proofing-header">
        <div>
          <h1>Proofing Galleries</h1>
          <p>
            Managing galleries for{" "}
            <span style={{ fontWeight: 600 }}>{organization?.name}</span>
          </p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={handleCreateGallery}>
            <Plus size={16} />
            Create Gallery
          </button>
        </div>
      </div>

      <SearchControls
        searchState={searchState}
        setSearchState={setSearchState}
      />

      <TabNavigation 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
        activeCount={activeGalleries.length}
        archivedCount={archivedGalleries.length}
      />

      <div className="tab-content">
        <div
          className={`tab-pane ${activeTab === "active" ? "show active" : ""}`}
        >
          <GalleryList
            galleries={activeGalleries}
            isArchived={false}
            viewMode="flat"
            searchState={searchState}
            onViewGallery={handleViewGallery}
            onEditGallery={handleEditGallery}
          />
        </div>

        <div
          className={`tab-pane ${
            activeTab === "archived" ? "show active" : ""
          }`}
        >
          <GalleryList
            galleries={archivedGalleries}
            isArchived={true}
            viewMode="folders"
            searchState={searchState}
            onViewGallery={handleViewGallery}
            onEditGallery={handleEditGallery}
          />
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateGalleryModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          organization={organization}
          userProfile={userProfile}
        />
      )}

      {showDetailsModal && selectedGallery && (
        <GalleryDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedGallery(null);
          }}
          gallery={selectedGallery}
          organization={organization}
          userEmail={userProfile?.email}
        />
      )}

      {showEditModal && editingGallery && (
        <EditGalleryModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingGallery(null);
          }}
          gallery={editingGallery}
          organization={organization}
        />
      )}
    </div>
  );
};

export default ProofingMainApp;