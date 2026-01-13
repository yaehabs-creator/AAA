import React from 'react';
import { logout, getCurrentUser } from '../services/authService';

interface PendingApprovalProps {
  onLogout: () => void;
}

export const PendingApproval: React.FC<PendingApprovalProps> = ({ onLogout }) => {
  const user = getCurrentUser();

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="bg-white rounded-3xl shadow-premium border border-aaa-border p-10 w-full max-w-md text-center">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-3xl font-black text-aaa-blue tracking-tighter mb-4">
          Waiting for Approval
        </h1>

        <p className="text-aaa-muted mb-2">
          Your account is pending admin approval.
        </p>

        {user?.email && (
          <p className="text-sm text-aaa-muted mb-8">
            Account: <span className="font-bold">{user.email}</span>
          </p>
        )}

        <p className="text-sm text-aaa-muted mb-8 leading-relaxed">
          An administrator will review your account and grant you access. You'll be able to access the contract dashboard once approved.
        </p>

        <button
          onClick={handleLogout}
          className="px-6 py-3 bg-aaa-blue text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-aaa-hover transition-all shadow-lg"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};
