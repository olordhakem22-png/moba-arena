import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocketStore } from '../../stores/socketStore.js';

export default function GamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocketStore();
  const [gameStarted, setGameStarted] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 200 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    
    if (!isConnected || !socket) {
      setError('Not connected to server');
      return;
    }

    // Listen for game events
    socket.on('game:joined', () => {
      console.log('[GamePage] Game joined!');
      setGameStarted(true);
    });

    socket.on('game:error', (data: { message: string }) => {
      setError(data.message);
    });

    // Join game
    socket.emit('game:join', { gameId });

    return () => {
      socket.off('game:joined');
      socket.off('game:error');
    };
  }, [gameId, isConnected, socket]);

  // Movement
  useEffect(() => {
    if (!gameStarted) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      setPosition(prev => {
        switch (e.key) {
          case 'ArrowUp': return { ...prev, y: prev.y - 10 };
          case 'ArrowDown': return { ...prev, y: prev.y + 10 };
          case 'ArrowLeft': return { ...prev, x: prev.x - 10 };
          case 'ArrowRight': return { ...prev, x: prev.x + 10 };
          default: return prev;
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted]);

  if (error) {
    return (
      <div className="min-h-screen bg-game-darker flex items-center justify-center p-4">
        <div className="card text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="font-game text-2xl font-bold mb-2 text-red-400">Error</h2>
          <p className="text-white/60 mb-4">{error}</p>
          <button onClick={() => navigate('/play')} className="btn-primary">
            Return to Play
          </button>
        </div>
      </div>
    );
  }

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-game-darker flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⚔️</div>
          <h2 className="font-game text-3xl font-bold mb-2">Game Loading...</h2>
          <p className="text-white/40">Game ID: {gameId}</p>
          <p className="text-white/30 text-sm mt-2">Connected: {isConnected ? 'Yes' : 'No'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a2a1a] relative overflow-hidden">
      {/* Game Canvas */}
      <div className="absolute inset-0">
        {/* Map Background */}
        <div className="absolute inset-0 bg-[#1a3a1a]" 
             style={{
               backgroundImage: 'linear-gradient(#2a4a2a 1px, transparent 1px), linear-gradient(90deg, #2a4a2a 1px, transparent 1px)',
               backgroundSize: '50px 50px'
             }}>
        </div>
        
        {/* Lane */}
        <div className="absolute top-1/2 left-0 right-0 h-16 bg-[#3a3a2a]/50 transform -translate-y-1/2"></div>
        
        {/* Blue Base */}
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-32 h-48 bg-[#1e3a5f]/30 border-2 border-blue-500/50 rounded-lg"></div>
        
        {/* Red Base */}
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-32 h-48 bg-[#5f1e1e]/30 border-2 border-red-500/50 rounded-lg"></div>
        
        {/* River */}
        <div className="absolute top-0 bottom-0 left-1/3 right-1/3 bg-[#2a4a6a]/30 transform -skew-x-12"></div>
        
        {/* Player */}
        <div 
          className="absolute w-12 h-12 bg-blue-500 rounded-full border-4 border-blue-300 shadow-lg shadow-blue-500/50 transition-all duration-100"
          style={{ 
            left: position.x, 
            top: position.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-16 h-2 bg-green-500 rounded-full">
            <div className="h-full w-3/4 bg-green-300 rounded-full"></div>
          </div>
        </div>
        
        {/* Enemy */}
        <div 
          className="absolute w-12 h-12 bg-red-500 rounded-full border-4 border-red-300 shadow-lg shadow-red-500/50"
          style={{ 
            left: 600, 
            top: 200,
            transform: 'translate(-50%, -50%)'
          }}
        >
        </div>
      </div>

      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start">
        {/* My Stats */}
        <div className="card bg-black/50">
          <div className="text-yellow-400 font-game text-lg">🔵 MOBA Arena</div>
          <div className="text-white/60 text-sm mt-1">Game: {gameId?.slice(0, 8)}...</div>
        </div>
        
        {/* Score */}
        <div className="card bg-black/50 text-center">
          <div className="font-game text-2xl">
            <span className="text-blue-400">0</span>
            <span className="text-white/40 mx-2">-</span>
            <span className="text-red-400">0</span>
          </div>
          <div className="text-white/40 text-sm">Score</div>
        </div>
        
        {/* Time */}
        <div className="card bg-black/50">
          <div className="font-game text-2xl text-white">15:00</div>
          <div className="text-white/40 text-sm">Game Time</div>
        </div>
      </div>

      {/* Controls Guide */}
      <div className="absolute bottom-4 left-4 card bg-black/50">
        <div className="text-white/60 text-sm font-game mb-2">🎮 Controls</div>
        <div className="text-white/40 text-xs space-y-1">
          <div>↑ ↓ ← → Move</div>
          <div>A Attack</div>
          <div>Q W E R Abilities</div>
          <div>B Recall</div>
        </div>
      </div>

      {/* Minimap */}
      <div className="absolute bottom-4 right-4 w-32 h-24 card bg-black/70 p-2">
        <div className="w-full h-full bg-[#1a3a1a] border border-white/20 relative">
          {/* Blue base */}
          <div className="absolute left-1 top-1/2 transform -translate-y-1/2 w-4 h-6 bg-blue-500/50"></div>
          {/* Red base */}
          <div className="absolute right-1 top-1/2 transform -translate-y-1/2 w-4 h-6 bg-red-500/50"></div>
          {/* Player dot */}
          <div 
            className="absolute w-2 h-2 bg-blue-400 rounded-full"
            style={{ 
              left: `${(position.x / 800) * 100}%`, 
              top: `${(position.y / 600) * 100}%`,
              transform: 'translate(-50%, -50%)'
            }}
          ></div>
        </div>
      </div>

      {/* Return Button */}
      <button 
        onClick={() => navigate('/play')}
        className="absolute top-16 left-4 px-3 py-1 bg-red-500/80 text-white text-sm rounded hover:bg-red-600"
      >
        ← Exit Game
      </button>
    </div>
  );
}
