// src/components/dashboard/PTOBalanceWidget.js
import React, { useState, useEffect } from 'react';
import { Users, Clock, TrendingUp, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getPTOBalance } from '../../services/ptoService';
import './PTOBalanceWidget.css';

const PTOBalanceWidget = () => {
  const { userProfile, organization } = useAuth();
  const [ptoBalance, setPtoBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPTOBalance = async () => {
      if (!userProfile || !organization || !organization.ptoSettings?.enabled) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        // Get current balance (automatic processing handles accrual)
        const balance = await getPTOBalance(userProfile.id, organization.id);
        setPtoBalance(balance);
      } catch (err) {
        console.error('Error loading PTO balance:', err);
        setError('Unable to load PTO balance');
      } finally {
        setLoading(false);
      }
    };

    loadPTOBalance();
  }, [userProfile, organization]);

  // Don't render if PTO is not enabled
  if (!organization?.ptoSettings?.enabled) {
    return null;
  }

  if (loading) {
    return (
      <div className="pto-widget">
        <div className="pto-widget__header">
          <Users className="pto-widget__icon" size={20} />
          <h3 className="pto-widget__title">PTO Balance</h3>
        </div>
        <div className="pto-widget__loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pto-widget">
        <div className="pto-widget__header">
          <Users className="pto-widget__icon" size={20} />
          <h3 className="pto-widget__title">PTO Balance</h3>
        </div>
        <div className="pto-widget__error">{error}</div>
      </div>
    );
  }

  if (!ptoBalance) {
    return null;
  }

  const formatHours = (hours) => {
    if (hours === 0) return '0 hours';
    if (hours === 1) return '1 hour';
    return `${hours} hours`;
  };

  const formatDays = (hours) => {
    const days = Math.floor(hours / 8);
    const remainingHours = hours % 8;
    
    if (days === 0) {
      return formatHours(remainingHours);
    } else if (remainingHours === 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else {
      return `${days} day${days !== 1 ? 's' : ''}, ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
  };

  const accrualRate = organization.ptoSettings?.accrualRate || 0;
  const accrualPeriod = organization.ptoSettings?.accrualPeriod || 40;
  const maxAccrual = organization.ptoSettings?.maxAccrual || 240;

  const balancePercentage = (ptoBalance.totalBalance / maxAccrual) * 100;

  return (
    <div className="pto-widget">
      <div className="pto-widget__header">
        <Users className="pto-widget__icon" size={20} />
        <h3 className="pto-widget__title">PTO Balance</h3>
      </div>

      <div className="pto-widget__content">
        {/* Current Balance */}
        <div className="pto-balance">
          <div className="pto-balance__main">
            <span className="pto-balance__hours">{ptoBalance.totalBalance}</span>
            <span className="pto-balance__unit">hours</span>
          </div>
          <div className="pto-balance__days">
            {formatDays(ptoBalance.totalBalance)} available
          </div>
        </div>

        {/* Compact Key Stats */}
        <div className="pto-compact-stats">
          <div className="pto-compact-stat">
            <div className="pto-compact-stat__value">{ptoBalance.bankingBalance || 0}</div>
            <div className="pto-compact-stat__label">Banking</div>
          </div>
          <div className="pto-compact-stat">
            <div className="pto-compact-stat__value">{ptoBalance.usedThisYear}</div>
            <div className="pto-compact-stat__label">Used</div>
          </div>
          <div className="pto-compact-stat">
            <div className="pto-compact-stat__value">{Math.round(balancePercentage)}%</div>
            <div className="pto-compact-stat__label">of Max</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PTOBalanceWidget;