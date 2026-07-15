import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

interface Champion {
  id: string;
  name: string;
  portrait: string;
  roles: string[];
  difficulty: number;
  priceBlueEssence: number;
  priceRP: number;
  stats?: { health: number; ad: number; armor: number; moveSpeed: number };
}

export default function ChampionsPage() {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => {
    axios.get('/champions').then((res) => {
      setChampions(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const roles = ['all', 'top', 'jungle', 'mid', 'adc', 'support'];
  const filtered = champions.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole === 'all' || c.roles?.includes(filterRole);
    return matchesSearch && matchesRole;
  });

  const getDifficultyColor = (d: number) =>
    d === 1 ? 'text-green-400' : d === 2 ? 'text-yellow-400' : 'text-red-400';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-3xl animate-bounce">⚔</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-game text-4xl font-bold mb-6">
        CHAMPIONS <span className="text-primary-400">({champions.length})</span>
      </h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search champions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-[200px]"
        />
        <div className="flex gap-1">
          {roles.map((role) => (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                filterRole === role ? 'bg-primary-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Champion Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filtered.map((champion) => (
          <Link key={champion.id} to={`/champions/${champion.id}`} className="champion-card">
            <div className="relative overflow-hidden rounded-lg mb-2">
              <img
                src={champion.portrait || `/assets/champions/${champion.id}.jpg`}
                alt={champion.name}
                className="champion-portrait aspect-[3/4]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${champion.id}/300/400`;
                }}
              />
              <div className="absolute bottom-2 right-2">
                <span className={`text-xs font-bold px-2 py-1 rounded bg-black/60 ${getDifficultyColor(champion.difficulty)}`}>
                  {'⚡'.repeat(champion.difficulty)}
                </span>
              </div>
            </div>
            <h3 className="font-game text-lg font-bold text-center">{champion.name}</h3>
            <p className="text-white/40 text-xs text-center">{champion.roles?.join(' / ')}</p>
            <div className="flex items-center justify-center gap-2 mt-1 text-xs">
              <span className="text-primary-300">💎{champion.priceBlueEssence}</span>
              <span className="text-yellow-400">🔶{champion.priceRP}</span>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-white/40">
          <div className="text-4xl mb-4">🔍</div>
          <p>No champions found matching your criteria</p>
        </div>
      )}
    </div>
  );
}
