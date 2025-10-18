// src/components/sessions/SessionCostBreakdown.js
import React, { useState, useEffect } from "react";
import { DollarSign, TrendingUp, Navigation, Users } from "lucide-react";
import {
  calculateTotalSessionCost,
  formatCurrency,
  getCompensationTypeDisplay
} from "../../utils/sessionCostCalculations";
import "./SessionCostBreakdown.css";

/**
 * SessionCostBreakdown Component
 * Displays labor and mileage costs for ALL photographers assigned to a session
 *
 * @param {Object} session - Session object with date, startTime, endTime
 * @param {Array} photographers - Array of photographer objects assigned to session
 * @param {Array} teamMembers - Full team member data for lookups
 * @param {Object} school - School object with coordinates
 * @param {Array} allTimeEntriesInWeek - All time entries for the week (for accurate OT calculation)
 * @param {string} mode - Display mode: 'full' (detailed) or 'compact' (summary only)
 */
const SessionCostBreakdown = ({
  session,
  photographers = [],
  teamMembers = [],
  school,
  allTimeEntriesInWeek = [],
  mode = 'full'
}) => {
  const [photographerCosts, setPhotographerCosts] = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const calculateCosts = () => {
      try {
        setLoading(true);
        setError(null);

        // Validate required data
        if (!session) {
          setError("Session data not available");
          setLoading(false);
          return;
        }

        if (!photographers || photographers.length === 0) {
          setError("No photographers assigned to this session");
          setLoading(false);
          return;
        }

        if (!teamMembers || teamMembers.length === 0) {
          setError("Team member data not available");
          setLoading(false);
          return;
        }

        // Calculate costs for each photographer
        const costs = [];
        let grandTotal = 0;

        photographers.forEach((photographer) => {
          // Find full team member data
          const photographerId = photographer.id || photographer;
          const teamMember = teamMembers.find(m => m.id === photographerId);

          if (!teamMember) {
            // Photographer not found in team members
            costs.push({
              photographer: photographer,
              name: photographer.name || 'Unknown Photographer',
              error: 'Photographer details not found',
              costData: null
            });
            return;
          }

          // Calculate costs for this photographer (with all time entries for accurate OT)
          const costData = calculateTotalSessionCost(
            session,
            teamMember,
            school,
            allTimeEntriesInWeek
          );

          costs.push({
            photographer: teamMember,
            name: teamMember.displayName || `${teamMember.firstName} ${teamMember.lastName}`,
            error: null,
            costData: costData
          });

          grandTotal += costData.totalCost;
        });

        setPhotographerCosts(costs);
        setTotalCost(grandTotal);
        setLoading(false);
      } catch (err) {
        console.error("Error calculating session costs:", err);
        setError("Unable to calculate costs");
        setLoading(false);
      }
    };

    calculateCosts();
  }, [session, photographers, teamMembers, school, allTimeEntriesInWeek]);

  // Loading state
  if (loading) {
    return (
      <div className="session-cost-breakdown">
        <div className="session-cost-loading">Calculating costs...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="session-cost-breakdown">
        <div className="session-cost-error">{error}</div>
      </div>
    );
  }

  // No cost data
  if (photographerCosts.length === 0) {
    return null;
  }

  // Compact mode - just show total
  if (mode === 'compact') {
    return (
      <div className="session-cost-compact">
        <DollarSign size={14} />
        <span className="session-cost-total">{formatCurrency(totalCost)}</span>
      </div>
    );
  }

  // Full mode - show detailed breakdown
  return (
    <div className="session-cost-breakdown">
      <div className="session-cost-header">
        <h3 className="session-cost-title">
          <DollarSign size={16} />
          Session Costs
          {photographerCosts.length > 1 && (
            <span className="session-cost-photographer-count">
              <Users size={14} />
              {photographerCosts.length} Photographers
            </span>
          )}
        </h3>
      </div>

      <div className="session-cost-body">
        {/* Per-Photographer Breakdown */}
        {photographerCosts.map((photographerCost, index) => {
          const { name, error, costData } = photographerCost;

          // If there was an error for this photographer
          if (error || !costData) {
            return (
              <div key={index} className="session-cost-photographer-section error">
                <div className="session-cost-photographer-header">
                  <span className="session-cost-photographer-name">{name}</span>
                  <span className="session-cost-photographer-error">{error || 'Data unavailable'}</span>
                </div>
              </div>
            );
          }

          return (
            <div key={index} className="session-cost-photographer-section">
              {/* Photographer Name */}
              <div className="session-cost-photographer-header">
                <span className="session-cost-photographer-name">{name}</span>
                <span className="session-cost-photographer-total">
                  {formatCurrency(costData.totalCost)}
                </span>
              </div>

              {/* Labor Cost */}
              <div className="session-cost-section">
                <div className="session-cost-section-header">
                  <TrendingUp size={14} />
                  <span className="session-cost-section-title">Labor</span>
                  <span className="session-cost-section-amount">
                    {formatCurrency(costData.laborCost)}
                  </span>
                </div>
                <div className="session-cost-details">
                  <div className="session-cost-detail-row">
                    <span className="session-cost-detail-label">
                      {costData.hours.toFixed(1)} hours × {getCompensationTypeDisplay(costData.compensationType)}
                      {costData.compensationType === 'hourly' && ` (${formatCurrency(costData.hourlyRate)}/hr)`}
                    </span>
                  </div>
                  {costData.isOvertimeShift && (
                    <div className="session-cost-detail-row session-cost-overtime">
                      <span className="session-cost-detail-label">Overtime pay</span>
                      <span className="session-cost-detail-value">
                        {formatCurrency(costData.overtimePay)}
                      </span>
                    </div>
                  )}
                  {costData.compensationType === 'salary' && (
                    <div className="session-cost-detail-note">
                      Salaried - included in base pay
                    </div>
                  )}
                </div>
              </div>

              {/* Mileage Cost */}
              {costData.distance > 0 ? (
                <div className="session-cost-section">
                  <div className="session-cost-section-header">
                    <Navigation size={14} />
                    <span className="session-cost-section-title">Mileage</span>
                    <span className="session-cost-section-amount">
                      {formatCurrency(costData.mileageCost)}
                    </span>
                  </div>
                  <div className="session-cost-details">
                    <div className="session-cost-detail-row">
                      <span className="session-cost-detail-label">
                        {costData.distance.toFixed(1)} mi (round trip) × {formatCurrency(costData.mileageRate)}/mi
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="session-cost-section">
                  <div className="session-cost-section-header">
                    <Navigation size={14} />
                    <span className="session-cost-section-title">Mileage</span>
                    <span className="session-cost-section-amount">{formatCurrency(0)}</span>
                  </div>
                  <div className="session-cost-details">
                    <div className="session-cost-detail-note">
                      {!photographerCost.photographer.homeAddress
                        ? "Home address not set"
                        : !school?.coordinates
                        ? "School location not set"
                        : "No mileage data"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Grand Total (only show if multiple photographers) */}
        {photographerCosts.length > 1 && (
          <div className="session-cost-grand-total-section">
            <span className="session-cost-total-label">Total Session Cost</span>
            <span className="session-cost-total-amount">
              {formatCurrency(totalCost)}
            </span>
          </div>
        )}

        {/* Single photographer - show total */}
        {photographerCosts.length === 1 && (
          <div className="session-cost-total-section">
            <span className="session-cost-total-label">Total Session Cost</span>
            <span className="session-cost-total-amount">
              {formatCurrency(totalCost)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionCostBreakdown;
