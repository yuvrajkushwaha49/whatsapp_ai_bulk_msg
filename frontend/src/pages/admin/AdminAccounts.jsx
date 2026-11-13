import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import AiwavoHeader from '../../components/AiwavoHeader';

export default function AdminAccounts() {
  const { onToggleSidebar } = useOutletContext() || {};

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/whatsapp-accounts');
      if (res.data?.success) {
        setAccounts(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load accounts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return (
    <div>
      <AiwavoHeader
        title="Raw WhatsApp Accounts Database"
        subtitle="Platform-wide low-level WhatsApp accounts, WABA IDs & Meta Tokens"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="p-4">
        <div className="cf-card mb-4">
          <div className="cf-card-header d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0 fw-bold">Platform WhatsApp Accounts ({accounts.length})</h5>
              <small className="text-muted">Master database records across all client tenants</small>
            </div>
            <button
              onClick={fetchAccounts}
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
            >
              <i className="bi bi-arrow-clockwise"></i>
              <span>Refresh</span>
            </button>
          </div>

          <div className="table-responsive">
            <table className="table cf-table align-middle">
              <thead>
                <tr>
                  <th>Account / Display Name</th>
                  <th>Assigned Business</th>
                  <th>Phone Number</th>
                  <th>WABA ID</th>
                  <th>Phone Number ID</th>
                  <th>Connection Status</th>
                  <th>Admin Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <div className="spinner-border text-primary" role="status"></div>
                    </td>
                  </tr>
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      No accounts found in database.
                    </td>
                  </tr>
                ) : (
                  accounts.map(acc => (
                    <tr key={acc.id}>
                      <td>
                        <div className="fw-bold">{acc.account_name || acc.display_phone_number}</div>
                        <div className="small text-muted">{acc.verified_name || 'N/A'}</div>
                      </td>
                      <td>
                        <span className="badge bg-light text-primary border">
                          {acc.business_name || 'Pool (Unassigned)'}
                        </span>
                      </td>
                      <td>
                        <code>{acc.display_phone_number || acc.phone_number}</code>
                      </td>
                      <td>
                        <code className="small text-muted">{acc.waba_id}</code>
                      </td>
                      <td>
                        <code className="small text-muted">{acc.phone_number_id}</code>
                      </td>
                      <td>
                        <span className="badge bg-success-subtle text-success">
                          {acc.connection_status || 'CONNECTED'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${acc.admin_status === 'DEACTIVE' ? 'bg-danger' : 'bg-success'}`}>
                          {acc.admin_status || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
