import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserRole } from '../types';

interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: any;
}

interface UserManagementProps {
  onClose: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const usersList: User[] = [];
      snapshot.forEach((doc) => {
        usersList.push({
          id: doc.id,
          ...doc.data()
        } as User);
      });
      
      setUsers(usersList);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    setUpdating(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      await loadUsers(); // Reload to reflect changes
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role. Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    return new Date(timestamp).toLocaleDateString();
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'editor':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'viewer':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'pending':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-aaa-border pb-4">
        <h3 className="text-2xl font-black text-aaa-blue tracking-tighter">User Management</h3>
        <button
          onClick={onClose}
          className="text-aaa-muted hover:text-aaa-blue transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-aaa-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-aaa-muted text-sm">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-aaa-muted">No users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-aaa-border">
                <th className="text-left py-4 px-4 text-[10px] font-black uppercase tracking-widest text-aaa-muted">Email</th>
                <th className="text-left py-4 px-4 text-[10px] font-black uppercase tracking-widest text-aaa-muted">Role</th>
                <th className="text-left py-4 px-4 text-[10px] font-black uppercase tracking-widest text-aaa-muted">Created</th>
                <th className="text-left py-4 px-4 text-[10px] font-black uppercase tracking-widest text-aaa-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-aaa-border/50 hover:bg-aaa-bg/30 transition-colors">
                  <td className="py-4 px-4">
                    <div className="font-bold text-aaa-text">{user.email}</div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getRoleColor(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-aaa-muted">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateUserRole(user.id, 'viewer')}
                        disabled={updating === user.id || user.role === 'viewer'}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          user.role === 'viewer'
                            ? 'bg-green-100 text-green-700 cursor-not-allowed'
                            : 'bg-white border border-aaa-border hover:bg-green-50 hover:border-green-300 text-green-700'
                        }`}
                      >
                        Viewer
                      </button>
                      <button
                        onClick={() => updateUserRole(user.id, 'editor')}
                        disabled={updating === user.id || user.role === 'editor'}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          user.role === 'editor'
                            ? 'bg-blue-100 text-blue-700 cursor-not-allowed'
                            : 'bg-white border border-aaa-border hover:bg-blue-50 hover:border-blue-300 text-blue-700'
                        }`}
                      >
                        Editor
                      </button>
                      <button
                        onClick={() => updateUserRole(user.id, 'admin')}
                        disabled={updating === user.id || user.role === 'admin'}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700 cursor-not-allowed'
                            : 'bg-white border border-aaa-border hover:bg-purple-50 hover:border-purple-300 text-purple-700'
                        }`}
                      >
                        Admin
                      </button>
                      <button
                        onClick={() => updateUserRole(user.id, 'pending')}
                        disabled={updating === user.id || user.role === 'pending'}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          user.role === 'pending'
                            ? 'bg-amber-100 text-amber-700 cursor-not-allowed'
                            : 'bg-white border border-aaa-border hover:bg-amber-50 hover:border-amber-300 text-amber-700'
                        }`}
                      >
                        Pending
                      </button>
                      {updating === user.id && (
                        <div className="w-4 h-4 border-2 border-aaa-blue border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
