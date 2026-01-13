import React, { useState } from 'react';
import { signUp } from '../services/authService';

interface SignupProps {
  onSwitchToLogin: () => void;
  onSignupSuccess: () => void;
}

export const Signup: React.FC<SignupProps> = ({ onSwitchToLogin, onSignupSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      await signUp(email, password);
      // Auth state will be updated automatically via onAuthStateChanged
      onSignupSuccess();
    } catch (err: any) {
      console.error('Signup error:', err);
      let errorMessage = 'Failed to create account. Please try again.';
      
      // Provide more specific error messages
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please check your email.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/Password authentication is not enabled. Please contact administrator.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="bg-white rounded-3xl shadow-premium border border-aaa-border p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-aaa-blue rounded-xl flex items-center justify-center shadow-xl mx-auto mb-4">
            <span className="text-white font-black text-xl">AAA</span>
          </div>
          <h1 className="text-3xl font-black text-aaa-blue tracking-tighter mb-2">Contract Department</h1>
          <p className="text-aaa-muted text-sm font-bold uppercase tracking-widest">Create Account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-black text-aaa-blue uppercase tracking-widest mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-aaa-bg/30 border border-aaa-border rounded-xl focus:border-aaa-blue focus:ring-4 focus:ring-aaa-blue/5 outline-none transition-all"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-black text-aaa-blue uppercase tracking-widest mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-aaa-bg/30 border border-aaa-border rounded-xl focus:border-aaa-blue focus:ring-4 focus:ring-aaa-blue/5 outline-none transition-all"
              placeholder="••••••••"
            />
            <p className="text-xs text-aaa-muted mt-1">Minimum 6 characters</p>
          </div>

          <div>
            <label className="block text-sm font-black text-aaa-blue uppercase tracking-widest mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-aaa-bg/30 border border-aaa-border rounded-xl focus:border-aaa-blue focus:ring-4 focus:ring-aaa-blue/5 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-4 bg-aaa-blue text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-aaa-hover transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-aaa-muted text-sm">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-aaa-blue font-black hover:underline"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
