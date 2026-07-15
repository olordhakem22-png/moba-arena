import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get('/admin/stats').then(res => setStats(res.data));
    axios.get('/admin/users').then(res => { setUsers(res.data.users); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleBan = async (userId: string, reason: string) => {
    try {
      await axios.post('/admin/ban', { userId, reason });
      toast.success('User banned');
      setUsers(users.map(u => u.id === userId ? { ...u, isBanned: true } : u));
    } catch { toast.error('Ban failed'); }
  };

  const handleUnban = async (userId: string) => {
    try {
      await axios.post('/admin/unban', { userId });
      toast.success('User unbanned');
      setUsers(users.map(u => u.id === userId ? { ...u, isBanned: false } : u));
    } catch { toast.error('Unban failed'); }
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-game text-4xl font-bold mb-6 text-red-400">ADMIN PANEL</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users', value: stats.totalUsers, icon: '👥' },
            { label: 'Online Now', value: stats.onlineUsers, icon: '🟢' },
            { label: 'Total Matches', value: stats.totalMatches, icon: '🎮' },
            { label: 'Active Games', value: stats.activeGames, icon: '⚔' },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="font-game text-2xl font-bold">{s.value}</div>
              <div className="text-white/40 text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* User Search */}
      <div className="mb-4">
        <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="input w-80" />
      </div>

      {/* User Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/40">
              <th className="p-3">User</th>
              <th className="p-3">Rank</th>
              <th className="p-3">W/L</th>
              <th className="p-3">Status</th>
              <th className="p-3">Role</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                    {user.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{user.username}</div>
                    <div className="text-white/40 text-xs">{user.email}</div>
                  </div>
                </td>
                <td className="p-3">{user.rank} {user.rankDivision}</td>
                <td className="p-3">{user.wins}W/{user.losses}L</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${user.status === 'ONLINE' ? 'bg-green-500/20 text-green-400' : user.status === 'IN_GAME' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white/40'}`}>
                    {user.status}
                  </span>
                </td>
                <td className="p-3">{user.role}</td>
                <td className="p-3">
                  {user.isBanned ? (
                    <button onClick={() => handleUnban(user.id)} className="text-green-400 hover:underline text-xs">Unban</button>
                  ) : (
                    <button onClick={() => handleBan(user.id, 'Rule violation')} className="text-red-400 hover:underline text-xs">Ban</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
