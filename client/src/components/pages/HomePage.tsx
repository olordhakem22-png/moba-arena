import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-game-darker">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary-900/30 to-game-darker">
        <div className="max-w-7xl mx-auto px-4 py-24 text-center">
          <div className="text-7xl mb-6 animate-float">⚔</div>
          <h1 className="font-game text-6xl font-bold text-white mb-4">
            MOBA<span className="text-primary-400">ARENA</span>
          </h1>
          <p className="text-white/60 text-xl mb-8 max-w-2xl mx-auto">
            The next generation browser MOBA. Choose your champion, master your abilities,
            and dominate the Rift.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/register" className="btn-primary text-lg px-8">
              Start Playing Free
            </Link>
            <Link to="/login" className="btn-secondary text-lg px-8">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="font-game text-3xl font-bold text-center mb-12">Why MOBA Arena?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: '🎮', title: 'Browser-Based', desc: 'Play directly in your browser. No downloads, no installs.' },
            { icon: '⚡', title: 'Real-Time Combat', desc: '20 TPS server-side simulation. Fair, competitive gameplay.' },
            { icon: '🏆', title: 'Ranked Matches', desc: 'Climb the ladder from Bronze to Challenger.' },
            { icon: '👥', title: '5v5 Battles', desc: 'Team up with friends or solo queue into competitive matches.' },
            { icon: '🧙', title: 'Unique Champions', desc: 'Dozens of champions with distinct abilities and playstyles.' },
            { icon: '🎬', title: 'Replays & Stats', desc: 'Full match replays and detailed player statistics.' },
          ].map((feature) => (
            <div key={feature.title} className="card text-center">
              <div className="text-4xl mb-3">{feature.icon}</div>
              <h3 className="font-game text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-white/40 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
