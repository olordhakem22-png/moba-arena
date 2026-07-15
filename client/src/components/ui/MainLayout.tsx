import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { useSocketStore } from '../../stores/socketStore.js';

const navItems = [
  { to: '/lobby', label: 'Home', icon: '🏠' },
  { to: '/play', label: 'Play', icon: '▶' },
  { to: '/champions', label: 'Champions', icon: '⚔' },
  { to: '/store', label: 'Store', icon: '🛒' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

export default function MainLayout() {
  const { user, logout } = useAuthStore();
  const { isConnected } = useSocketStore();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-game-darker flex flex-col">
      {/* Top Navbar */}
      <header className="bg-game-dark/90 backdrop-blur-md border-b border-white/10 z-50 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          {/* Logo */}
          <NavLink to="/lobby" className="flex items-center gap-2">
            <span className="text-2xl">🎮</span>
            <span className="font-game text-xl font-bold text-white">MOBA<span className="text-primary-400">ARENA</span></span>
          </NavLink>

          {/* Nav Links */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-600/20 text-primary-400'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <span>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            {/* Currency */}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-primary-300">💎 {user?.blueEssence?.toLocaleString()}</span>
              <span className="text-yellow-400">🔶 {user?.rp?.toLocaleString()}</span>
            </div>

            {/* Connection indicator */}
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} title={isConnected ? 'Connected' : 'Disconnected'} />

            {/* User dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold">
                  {user?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="text-white font-medium">{user?.username}</span>
                <span className="text-white/60 text-sm">Lv.{user?.level}</span>
              </button>

              <div className="absolute right-0 top-full mt-1 w-48 bg-game-dark border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <NavLink to="/profile" className="block px-4 py-2 hover:bg-white/10 text-white/80 hover:text-white">
                  My Profile
                </NavLink>
                <NavLink to="/settings" className="block px-4 py-2 hover:bg-white/10 text-white/80 hover:text-white">
                  Settings
                </NavLink>
                {user?.role === 'ADMIN' && (
                  <NavLink to="/admin" className="block px-4 py-2 hover:bg-white/10 text-red-400">
                    Admin Panel
                  </NavLink>
                )}
                <hr className="border-white/10" />
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 hover:bg-white/10 text-red-400"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
