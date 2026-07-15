import { useAuthStore } from '../../stores/authStore.js';
import axios from 'axios';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/matches/history').then(res => { setMatchHistory(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const winRate = user?.wins && user?.losses ? Math.round((user.wins / (user.wins + user.losses)) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="card mb-8 flex items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-4xl font-bold">
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="font-game text-3xl font-bold">{user?.username}</h1>
          <p className="text-white/40">Level {user?.level} • {user?.rank} {user?.rankDivision}</p>
          <div className="flex gap-4 mt-2 text-sm text-white/60">
            <span>🎮 {user?.wins}W / {user?.losses}L</span>
            <span>📊 {winRate}% Win Rate</span>
            <span>🎯 MMR: {user?.mmr}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-game text-2xl font-bold text-yellow-400">🏆</div>
          <p className="text-white/40 text-sm">{user?.rank} {user?.rankDivision}</p>
          <p className="text-primary-400 font-bold">{user?.rankLP} LP</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Kills', value: '0', icon: '💀' },
          { label: 'Total Deaths', value: '0', icon: '☠️' },
          { label: 'Total Assists', value: '0', icon: '🤝' },
          { label: 'Games Played', value: ((user?.wins || 0) + (user?.losses || 0)).toString(), icon: '🎮' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="font-game text-xl font-bold">{s.value}</div>
            <div className="text-white/40 text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Match History */}
      <h2 className="font-game text-2xl font-bold mb-4">MATCH HISTORY</h2>
      {loading ? (
        <div className="text-center py-8 text-white/40">Loading...</div>
      ) : matchHistory.length > 0 ? (
        <div className="space-y-2">
          {matchHistory.map((match: any, i: number) => (
            <div key={i} className={`card flex items-center gap-4 ${match.result === 'win' ? 'border-l-4 border-l-green-500' : match.result === 'loss' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-gray-500'}`}>
              <div className="w-16 h-16 bg-white/5 rounded-lg flex items-center justify-center text-2xl">⚔</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${match.result === 'win' ? 'text-green-400' : match.result === 'loss' ? 'text-red-400' : 'text-gray-400'}`}>
                    {match.result?.toUpperCase()}
                  </span>
                  <span className="text-white/40 text-sm">{match.queueType}</span>
                </div>
                <p className="text-white/60 text-sm">{match.championId} • {match.role}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{match.kills}/{match.deaths}/{match.assists}</p>
                <p className="text-white/40 text-xs">{Math.floor(match.duration / 60)}m</p>
              </div>
              <div className={`text-2xl ${match.grade === 'S' ? 'text-yellow-400' : match.grade === 'A' ? 'text-green-400' : 'text-white/40'}`}>
                {match.grade}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-8 text-white/40">
          <div className="text-4xl mb-3">📜</div>
          <p>No matches played yet</p>
          <button onClick={() => window.location.href = '/play'} className="btn-primary mt-4">Play your first game!</button>
        </div>
      )}
    </div>
  );
}
