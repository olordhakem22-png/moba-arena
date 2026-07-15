import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, error, isLoading } = useAuthStore();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await register(form);
      toast.success('Account created! Welcome!');
      navigate('/lobby');
    } catch {
      toast.error(error || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-game-darker flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎮</div>
          <h1 className="font-game text-4xl font-bold text-white">
            MOBA<span className="text-primary-400">ARENA</span>
          </h1>
          <p className="text-white/40 mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="input w-full"
              placeholder="YourSummonerName"
              minLength={3}
              maxLength={20}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input w-full"
              placeholder="your@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input w-full"
              placeholder="Min 8 characters"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">Confirm Password</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="input w-full"
              placeholder="Repeat password"
              required
            />
          </div>
          <button type="submit" disabled={isLoading} className="btn-primary w-full">
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-white/40 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-400 hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
