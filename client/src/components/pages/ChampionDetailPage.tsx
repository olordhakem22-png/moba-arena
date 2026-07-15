import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

interface Champion {
  id: string; name: string; title: string; lore: string; portrait: string;
  roles: string[]; difficulty: number;
  stats?: any; abilities?: any[];
}

export default function ChampionDetailPage() {
  const { id } = useParams();
  const [champion, setChampion] = useState<Champion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/champions/${id}`).then(res => { setChampion(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-3xl animate-spin">⚔</div></div>;
  if (!champion) return <div className="p-8 text-center text-white/40">Champion not found</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex gap-8">
        <img src={champion.portrait || `https://picsum.photos/seed/${champion.id}/400/500`} alt={champion.name}
          className="w-80 rounded-xl shadow-2xl" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${champion.id}/400/500`; }} />
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="font-game text-5xl font-bold">{champion.name}</h1>
            <span className="text-4xl">⚔</span>
          </div>
          <p className="text-xl text-primary-400 italic mb-4">{champion.title}</p>
          <p className="text-white/60 mb-6">{champion.lore}</p>
          <div className="flex gap-2 mb-6">
            {champion.roles?.map(role => (
              <span key={role} className="px-3 py-1 bg-white/10 rounded-full text-sm">{role}</span>
            ))}
            <span className={`px-3 py-1 rounded-full text-sm ${champion.difficulty === 1 ? 'bg-green-500/20 text-green-400' : champion.difficulty === 2 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
              Difficulty: {'⚡'.repeat(champion.difficulty)}
            </span>
          </div>
          {champion.stats && (
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Health', value: champion.stats.health, icon: '❤️' },
                { label: 'Attack', value: champion.stats.ad, icon: '⚔' },
                { label: 'Armor', value: champion.stats.armor, icon: '🛡' },
                { label: 'Speed', value: champion.stats.moveSpeed, icon: '💨' },
              ].map(s => (
                <div key={s.label} className="card text-center">
                  <div className="text-2xl">{s.icon}</div>
                  <div className="font-bold text-lg">{s.value}</div>
                  <div className="text-white/40 text-xs">{s.label}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button className="btn-primary">Buy with Blue Essence</button>
            <button className="btn-gold">Buy with RP</button>
          </div>
        </div>
      </div>

      {/* Abilities */}
      {champion.abilities && (
        <div className="mt-8">
          <h2 className="font-game text-2xl font-bold mb-4">ABILITIES</h2>
          <div className="grid grid-cols-5 gap-3">
            {champion.abilities.map((ability: any) => (
              <div key={ability.key} className="card text-center">
                <div className="w-12 h-12 bg-white/10 rounded-lg mx-auto mb-2 flex items-center justify-center font-game text-xl font-bold">
                  {ability.key}
                </div>
                <h4 className="font-bold text-sm">{ability.name}</h4>
                <p className="text-white/40 text-xs mt-1">{ability.description?.substring(0, 60)}...</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
