import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import '../styles/dashboard.css';
import '../styles/notifications.css';

export default function AiwavoHeader({
  title,
  subtitle,
  onToggleSidebar,
  showDateSelector = false,
  timeRange,
  setTimeRange,
  onNotificationClick,
  onHelpClick
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Profile Dropdown
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Notification Dropdown State
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const notifRef = useRef(null);

  // Helper for human-friendly relative time
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    let d = new Date(dateStr);
    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      d = new Date(dateStr.replace(' ', 'T') + 'Z');
    }
    const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifs(true);
      const res = await api.get('/notifications');
      if (res.data?.success && res.data?.data) {
        setNotifications(res.data.data.notifications || []);
        setUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch (err) {
      // In case of error, fallback to sensible state without breaking the header
      console.warn('Failed to load notifications:', err.message);
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  // Initial fetch and periodic polling (every 45s)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Handle outside clicks for Profile and Notifications dropdowns
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowDropdown(false);
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Toggle notification panel
  const handleToggleNotifications = () => {
    setShowDropdown(false);
    setShowNotifications((prev) => {
      const next = !prev;
      if (next) fetchNotifications();
      return next;
    });
    if (onNotificationClick) {
      onNotificationClick();
    }
  };

  // Toggle profile panel
  const handleToggleProfile = () => {
    setShowNotifications(false);
    setShowDropdown((prev) => !prev);
  };

  // Mark all as read
  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Mark single as read and navigate if link is attached
  const handleNotificationClickItem = async (notif) => {
    if (!notif.is_read) {
      try {
        await api.patch(`/notifications/${notif.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error('Failed to mark notification read:', err);
      }
    }
    setShowNotifications(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  // Delete notification
  const handleDeleteItem = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === id);
        if (target && !target.is_read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Clear all notifications
  const handleClearAll = async (e) => {
    e.stopPropagation();
    try {
      await api.delete('/notifications');
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  // Icon mapping helper
  const getIconForType = (type) => {
    switch (type) {
      case 'success':
        return 'bi-check-circle-fill';
      case 'warning':
        return 'bi-exclamation-triangle-fill';
      case 'error':
        return 'bi-x-circle-fill';
      case 'info':
      default:
        return 'bi-bell-fill';
    }
  };

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'RS';

  return (
    <div className="aiwavo-header">
      <div className="aiwavo-header-left">
        <div className="aiwavo-header-title-row">
          {onToggleSidebar && (
            <button
              type="button"
              className="aiwavo-mobile-toggle d-lg-none me-2"
              onClick={onToggleSidebar}
              aria-label="Toggle navigation"
            >
              <i className="bi bi-list fs-5"></i>
            </button>
          )}
          <h1 className="aiwavo-header-title">{title}</h1>
        </div>
        {subtitle && <p className="aiwavo-header-subtitle">{subtitle}</p>}
      </div>

      <div className="aiwavo-header-right">
        {/* Date Selector (optional for pages like Dashboard / Analytics) */}
        {showDateSelector && (
          <div className="aiwavo-date-dropdown">
            <i className="bi bi-calendar3 aiwavo-date-icon"></i>
            <select
              className="aiwavo-date-select"
              value={timeRange || 'Last 30 Days'}
              onChange={(e) => setTimeRange && setTimeRange(e.target.value)}
            >
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="Today">Today</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="This Month">This Month</option>
              <option value="All Time">All Time</option>
            </select>
          </div>
        )}

        {/* Notification Container & Dropdown */}
        <div ref={notifRef} className="aiwavo-notif-container">
          <button
            type="button"
            className={`aiwavo-circle-btn ${showNotifications ? 'active' : ''}`}
            title="Notifications"
            onClick={handleToggleNotifications}
            aria-label="Notifications"
            aria-expanded={showNotifications}
          >
            <i className="bi bi-bell"></i>
            {unreadCount > 0 && (
              <span className="aiwavo-notification-count-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="aiwavo-notif-dropdown">
              {/* Dropdown Header */}
              <div className="aiwavo-notif-header">
                <div className="aiwavo-notif-title-wrap">
                  <h3 className="aiwavo-notif-title">Notifications</h3>
                  {unreadCount > 0 ? (
                    <span className="aiwavo-notif-badge unread">{unreadCount} New</span>
                  ) : (
                    <span className="aiwavo-notif-badge caught-up">All Read</span>
                  )}
                </div>
                <div className="aiwavo-notif-header-actions">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="aiwavo-notif-action-btn"
                      onClick={handleMarkAllAsRead}
                      title="Mark all as read"
                    >
                      <i className="bi bi-check2-all"></i>
                      <span>Mark all read</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      className="aiwavo-notif-action-btn btn-clear"
                      onClick={handleClearAll}
                      title="Clear all notifications"
                    >
                      <i className="bi bi-trash3"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* Notification List */}
              <div className="aiwavo-notif-list">
                {loadingNotifs && notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted small">
                    <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="aiwavo-notif-empty">
                    <div className="aiwavo-notif-empty-icon">
                      <i className="bi bi-bell-slash"></i>
                    </div>
                    <div className="aiwavo-notif-empty-title">No notifications yet</div>
                    <p className="aiwavo-notif-empty-desc">
                      You are completely caught up! New campaign updates and Meta alerts will appear here.
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`aiwavo-notif-item ${!notif.is_read ? 'is-unread' : ''}`}
                      onClick={() => handleNotificationClickItem(notif)}
                    >
                      <div className={`aiwavo-notif-icon-circle ${notif.type || 'info'}`}>
                        <i className={`bi ${getIconForType(notif.type)}`}></i>
                      </div>

                      <div className="aiwavo-notif-body">
                        <div className="aiwavo-notif-item-title">
                          <span>{notif.title}</span>
                          {!notif.is_read && <span className="aiwavo-notif-dot-unread" title="Unread"></span>}
                        </div>
                        <p className="aiwavo-notif-item-msg">{notif.message}</p>
                        <div className="aiwavo-notif-meta">
                          <span className="aiwavo-notif-time">
                            <i className="bi bi-clock"></i>
                            {formatTimeAgo(notif.created_at)}
                          </span>
                          <button
                            type="button"
                            className="aiwavo-notif-delete-btn"
                            title="Remove notification"
                            onClick={(e) => handleDeleteItem(e, notif.id)}
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Dropdown Footer */}
              <div className="aiwavo-notif-footer">
                <button
                  type="button"
                  className="aiwavo-notif-footer-link btn p-0 border-0"
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/logs');
                  }}
                >
                  <i className="bi bi-journal-text"></i>
                  <span>View Activity Logs</span>
                </button>

                <button
                  type="button"
                  className="aiwavo-notif-footer-link secondary btn p-0 border-0"
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/settings');
                  }}
                >
                  <i className="bi bi-gear"></i>
                  <span>Settings</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Help Button */}
        <button
          type="button"
          className="aiwavo-circle-btn"
          title="Help & Documentation"
          onClick={() => {
            if (onHelpClick) onHelpClick();
            else navigate('/settings');
          }}
          aria-label="Help"
        >
          <i className="bi bi-question-circle"></i>
        </button>

        {/* Profile Badge */}
        <div
          ref={dropdownRef}
          className="aiwavo-profile-badge position-relative"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={handleToggleProfile}
          title="Account profile & sign out"
        >
          <div className="aiwavo-profile-avatar">{userInitials}</div>
          <div className="aiwavo-profile-info">
            <span className="aiwavo-profile-name">{user?.name || 'Rahul Sharma'}</span>
            <span className="aiwavo-profile-role text-capitalize">
              ({user?.role || 'Owner'})
            </span>
          </div>

          {showDropdown && (
            <div
              className="dropdown-menu dropdown-menu-end show shadow"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: '200px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '0.5rem',
                zIndex: 1060,
                backgroundColor: '#ffffff'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-bottom mb-1">
                <div className="fw-bold small text-dark">{user?.name || 'User'}</div>
                <div className="text-muted text-truncate" style={{ fontSize: '0.75rem' }}>{user?.email}</div>
                <div className="badge bg-success-subtle text-success mt-1 text-capitalize" style={{ fontSize: '0.7rem' }}>
                  {user?.role || 'Member'}
                </div>
              </div>
              <button
                type="button"
                className="dropdown-item text-danger d-flex align-items-center gap-2 py-2 rounded-2"
                onClick={logout}
              >
                <i className="bi bi-box-arrow-right"></i>
                <span className="fw-semibold small">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
