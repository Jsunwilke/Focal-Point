// src/components/districts/DistrictCard.js
import React, { useState } from 'react';
import { Building2, School, Edit2, Trash2, MoreVertical, ChevronRight } from 'lucide-react';
import Button from '../shared/Button';
import './DistrictCard.css';

const DistrictCard = ({ 
  district, 
  onEdit, 
  onDelete, 
  onViewSchools,
  onManageSchools 
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleEdit = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    onEdit(district);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete(district);
  };

  const handleManageSchools = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    onManageSchools(district);
  };

  const handleCardClick = () => {
    onViewSchools(district);
  };

  return (
    <div className="district-card" onClick={handleCardClick}>
      <div className="district-card__header">
        <div className="district-card__icon">
          <Building2 size={24} />
        </div>
        <div className="district-card__menu">
          <button
            className="district-card__menu-button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <MoreVertical size={16} />
          </button>
          {showMenu && (
            <>
              <div 
                className="menu-backdrop" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div className="district-card__menu-dropdown">
                <button onClick={handleEdit}>
                  <Edit2 size={14} />
                  Edit District
                </button>
                <button onClick={handleManageSchools}>
                  <School size={14} />
                  Manage Schools
                </button>
                <div className="menu-divider" />
                <button onClick={handleDelete} className="danger">
                  <Trash2 size={14} />
                  Delete District
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="district-card__content">
        <h3 className="district-card__name">{district.name}</h3>
        <div className="district-card__stats">
          <div className="district-card__stat">
            <School size={16} />
            <span>{district.schoolCount || 0} schools</span>
          </div>
        </div>
      </div>

      <div className="district-card__footer">
        <span className="district-card__view-link">
          View Schools
          <ChevronRight size={14} />
        </span>
      </div>
    </div>
  );
};

export default DistrictCard;