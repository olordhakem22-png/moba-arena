import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';

export default function LobbyPage() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-900/50 via-primary-800/30 to-game-dark border border-primary-500/20 p-8 mb-8">
        <div className="relative z-10">
          <h1 className="font-game text-4xl font-bold mb-2">
            Welcome back, <span className="text-primary-400">{user?.username}</span>!
          </h1>
          <p className="text-white/60 text-lg">Ready to climb the ranked ladder?</p>

          <div className="flex gap-4 mt-6">
            <NavLink to="/play" className="btn-primary text-lg">
              ▶ Play Now
            </NavLink>
            <NavLink to="/champions" className="btn-secondary text-lg">
              ⚔ Champions
            </NavLink>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute right-0 top-0 opacity-10 text-[200px]">⚔</div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Rank', value: `${user?.rank} ${user?.rankDivision || ''}`, icon: '🏆', color: 'text-yellow-400' },
          { label: 'Win Rate', value: user?.wins && user?.losses
            ? `${Math.round((user.wins / (user.wins + user.losses)) * 100)}%`
            : '--', icon: '📊', color: 'text-primary-400' },
          { label: 'Level', value: `Lv.${user?.level}`, icon: '⭐', color: 'text-purple-400' },
          { label: 'MMR', value: user?.mmr?.toString() || '--', icon: '🎯', color: 'text-green-400' },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <div className={`text-3xl mb-2 ${stat.color}`}>{stat.icon}</div>
            <div className="text-2xl font-bold font-game">{stat.value}</div>
            <div className="text-white/40 text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <NavLink to="/play" className="card group">
          <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎮</div>
          <h3 className="font-game text-xl font-bold mb-1">Quick Play</h3>
          <p className="text-white/40 text-sm">Jump into a match with other players</p>
        </NavLink>

        <NavLink to="/champions" className="card group">
          <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">⚔</div>
          <h3 className="font-game text-xl font-bold mb-1">Champions</h3>
          <p className="text-white/40 text-sm">Browse all available champions</p>
        </NavLink>

        <NavLink to="/store" className="card group">
          <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🛒</div>
          <h3 className="font-game text-xl font-bold mb-1">Store</h3>
          <p className="text-white/40 text-sm">Get new champions and skins</p>
        </NavLink>
      </div>
    </div>
  );
}
