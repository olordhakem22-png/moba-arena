import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocketStore } from '../../stores/socketStore.js';
import { useAuthStore } from '../../stores/authStore.js';

// Types
interface Item {
  id: string;
  name: string;
  cost: number;
  stats: Record<string, number>;
}

interface Champion {
  id: string;
  name: string;
  champion: string;
  hp: number;
  pos: { x: number; y: number };
  isPlayer?: boolean;
}

// Champion data
const CHAMPIONS = {
  ahri: { name: 'Ahri', icon: '🦊', abilities: ['Orb', 'Fox-Fire', 'Charm', 'Spirit Rush'] },
  garen: { name: 'Garen', icon: '⚔️', abilities: ['Strike', 'Courage', 'Judgment', 'Demacian Justice'] },
  jinx: { name: 'Jinx', icon: '💣', abilities: ['Zap', 'Flame', 'Super Mega', 'Get Excited'] },
  lux: { name: 'Lux', icon: '✨', abilities: ['Light Binding', 'Prismatic', 'Lucent Singularity', 'Final Spark'] },
  yasuo: { name: 'Yasuo', icon: '🌪️', abilities: ['Steel Tempest', 'Wind Wall', 'Sweeping Blade', 'Last Breath'] },
  nasus: { name: 'Nasus', icon: '🐕', abilities: ['Stalk', 'Wither', 'Spirit Fire', 'Fury of the Sands'] },
  thresh: { name: 'Thresh', icon: '👻', abilities: ['Death Sentence', 'Dark Passage', 'Flay', 'The Box'] },
 leesin: { name: 'Lee Sin', icon: '🥋', abilities: ['Sonic Wave', 'Safeguard', 'Tempest', 'Dragon Rage'] },
};

const ITEMS: Item[] = [
  { id: 'bf', name: 'BF Sword', cost: 1300, stats: { ad: 40 } },
  { id: 'dblade', name: 'Long Sword', cost: 350, stats: { ad: 10 } },
  { id: 'cloak', name: 'Cloth Armor', cost: 300, stats: { armor: 20 } },
  { id: 'negatron', name: 'Negatron Cloak', cost: 850, stats: { mr: 50 } },
  { id: 'amp', name: 'Amplifying Tome', cost: 435, stats: { ap: 35 } },
  { id: 'ruby', name: 'Ruby Crystal', cost: 400, stats: { hp: 150 } },
  { id: 'zeal', name: 'Zeal', cost: 1100, stats: { as: 25, ms: 5 } },
  { id: 'crystalline', name: 'Crystalline Bracer', cost: 650, stats: { hp: 250, hpRegen: 50 } },
];

export default function FullGamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocketStore();
  const { user } = useAuthStore();
  
  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState<'loading' | 'draft' | 'playing' | 'ended'>('loading');
  const [time, setTime] = useState(0);
  
  // Player state
  const [playerPos, setPlayerPos] = useState({ x: 400, y: 300 });
  const [playerHp, setPlayerHp] = useState(100);
  const [playerMaxHp, setPlayerMaxHp] = useState(100);
  const [playerMp, setPlayerMp] = useState(100);
  const [playerMaxMp, setPlayerMaxMp] = useState(100);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerGold, setPlayerGold] = useState(500);
  const [playerCs, setPlayerCs] = useState(0);
  const [selectedChampion, setSelectedChampion] = useState('lux');
  const [inventory, setInventory] = useState<(Item | null)[]>([null, null, null, null, null, null]);
  const [cooldowns, setCooldowns] = useState({ q: 0, w: 0, e: 0, r: 0 });
  
  // Team state
  const [blueTeam, setBlueTeam] = useState<Champion[]>([
    { id: 'player', name: user?.username || 'Player', champion: 'lux', hp: 100, pos: { x: 400, y: 300 }, isPlayer: true },
    { id: 'ally1', name: 'Bot Mid', champion: 'ahri', hp: 100, pos: { x: 400, y: 250 } },
    { id: 'ally2', name: 'Bot Jungle', champion: 'leesin', hp: 100, pos: { x: 350, y: 300 } },
    { id: 'ally3', name: 'Top', champion: 'garen', hp: 100, pos: { x: 400, y: 350 } },
    { id: 'ally4', name: 'ADC', champion: 'jinx', hp: 100, pos: { x: 450, y: 300 } },
  ]);
  
  const [redTeam, setRedTeam] = useState<Champion[]>([
    { id: 'enemy1', name: 'Enemy Top', champion: 'nasus', hp: 100, pos: { x: 1400, y: 300 } },
    { id: 'enemy2', name: 'Enemy Jungle', champion: 'leesin', hp: 100, pos: { x: 1350, y: 250 } },
    { id: 'enemy3', name: 'Enemy Mid', champion: 'ahri', hp: 100, pos: { x: 1400, y: 350 } },
    { id: 'enemy4', name: 'Enemy ADC', champion: 'jinx', hp: 100, pos: { x: 1450, y: 300 } },
    { id: 'enemy5', name: 'Enemy Support', champion: 'thresh', hp: 100, pos: { x: 1400, y: 200 } },
  ]);
  
  // Minions
  const [minions, setMinions] = useState<any[]>([]);
  
  // Towers
  const [towers] = useState({
    blue: [
      { id: 'bt1', pos: { x: 600, y: 300 }, hp: 100 },
      { id: 'bt2', pos: { x: 800, y: 300 }, hp: 100 },
      { id: 'bt3', pos: { x: 1000, y: 300 }, hp: 100 },
    ],
    red: [
      { id: 'rt1', pos: { x: 1200, y: 300 }, hp: 100 },
      { id: 'rt2', pos: { x: 1000, y: 300 }, hp: 100 },
      { id: 'rt3', pos: { x: 800, y: 300 }, hp: 100 },
    ],
  });
  
  // Game loop
  const [isPaused, setIsPaused] = useState(false);
  const gameLoopRef = useRef<number>();
  
  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!gameStarted) return;
    
    const speed = 8;
    switch (e.key.toLowerCase()) {
      case 'w': case 'arrowup':
        setPlayerPos(p => ({ ...p, y: Math.max(50, p.y - speed) }));
        break;
      case 's': case 'arrowdown':
        setPlayerPos(p => ({ ...p, y: Math.min(550, p.y + speed) }));
        break;
      case 'a': case 'arrowleft':
        setPlayerPos(p => ({ ...p, x: Math.max(50, p.x - speed) }));
        break;
      case 'd': case 'arrowright':
        setPlayerPos(p => ({ ...p, x: Math.min(1750, p.x + speed) }));
        break;
      case 'q':
        useAbility('q');
        break;
      case 'e':
        useAbility('e');
        break;
      case 'r':
        useAbility('r');
        break;
    }
  }, [gameStarted]);
  
  // Mouse click handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gameStarted) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPlayerPos({ x, y });
  };
  
  // Use ability
  const useAbility = (key: 'q' | 'w' | 'e' | 'r') => {
    if (cooldowns[key] > 0) return;
    
    // Cast ability - damage nearest enemy
    const nearestEnemy = redTeam.reduce((nearest, enemy) => {
      const dist = Math.hypot(enemy.pos.x - playerPos.x, enemy.pos.y - playerPos.y);
      const nearestDist = nearest ? Math.hypot(nearest.pos.x - playerPos.x, nearest.pos.y - playerPos.y) : Infinity;
      return dist < nearestDist ? enemy : nearest;
    }, null as any);
    
    if (nearestEnemy) {
      const damage = key === 'r' ? 50 : key === 'q' ? 20 : 15;
      setRedTeam(team => team.map(e => 
        e.id === nearestEnemy.id ? { ...e, hp: Math.max(0, e.hp - damage) } : e
      ));
    }
    
    setCooldowns(cd => ({ ...cd, [key]: key === 'r' ? 10 : 5 }));
  };
  
  // Attack nearest enemy
  const attack = () => {
    const nearestEnemy = redTeam.reduce((nearest, enemy) => {
      const dist = Math.hypot(enemy.pos.x - playerPos.x, enemy.pos.y - playerPos.y);
      const nearestDist = nearest ? Math.hypot(nearest.pos.x - playerPos.x, nearest.pos.y - playerPos.y) : Infinity;
      return dist < nearestDist && dist < 200 ? enemy : nearest;
    }, null as any);
    
    if (nearestEnemy) {
      setRedTeam(team => team.map(e => 
        e.id === nearestEnemy.id ? { ...e, hp: Math.max(0, e.hp - 10) } : e
      ));
    }
  };
  
  // Game loop
  useEffect(() => {
    if (!gameStarted || isPaused) return;
    
    const interval = setInterval(() => {
      // Update time
      setTime(t => t + 1);
      
      // Update cooldowns
      setCooldowns(cd => ({
        q: Math.max(0, cd.q - 0.1),
        w: Math.max(0, cd.w - 0.1),
        e: Math.max(0, cd.e - 0.1),
        r: Math.max(0, cd.r - 0.1),
      }));
      
      // Move minions
      setMinions(ms => ms.map(m => ({
        ...m,
        x: m.x + (m.team === 'blue' ? 2 : -2),
      })));
      
      // Auto attack if enemy in range
      const dist = Math.hypot(redTeam[0]?.pos.x - playerPos.x, redTeam[0]?.pos.y - playerPos.y);
      if (dist && dist < 150) {
        attack();
      }
      
      // Check win condition
      if (redTeam.every(e => e.hp <= 0)) {
        setGamePhase('ended');
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [gameStarted, isPaused, playerPos]);
  
  // Keyboard events
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  // Socket connection
  useEffect(() => {
    if (!gameId || !socket) return;
    
    socket.emit('game:join', { gameId });
    socket.on('game:joined', () => {
      setGameStarted(true);
      setGamePhase('playing');
    });
    
    return () => {
      socket.off('game:joined');
    };
  }, [gameId, socket]);
  
  // Buy item
  const buyItem = (item: typeof ITEMS[0]) => {
    if (playerGold < item.cost) return;
    setPlayerGold(g => g - item.cost);
    setInventory(inv => {
      const newInv = [...inv];
      const emptySlot = newInv.findIndex(i => i === null);
      if (emptySlot >= 0) {
        newInv[emptySlot] = item;
      }
      return newInv;
    });
  };
  
  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 10);
    const secs = seconds % 10;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (gamePhase === 'loading') {
    return (
      <div className="min-h-screen bg-game-darker flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⚔️</div>
          <h2 className="font-game text-3xl font-bold mb-2">Game Loading...</h2>
          <p className="text-white/40">Connecting to server...</p>
          <p className="text-white/30 text-sm mt-2">Game ID: {gameId}</p>
        </div>
      </div>
    );
  }

  if (gamePhase === 'ended') {
    return (
      <div className="min-h-screen bg-game-darker flex items-center justify-center">
        <div className="card text-center p-8">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="font-game text-4xl font-bold mb-4 text-yellow-400">VICTORY!</h2>
          <p className="text-white/60 mb-6">Game Duration: {formatTime(time)}</p>
          <button onClick={() => navigate('/play')} className="btn-primary px-8 py-3">
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top HUD */}
      <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0a0a15] p-2 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="text-yellow-400 font-game text-lg">⚔️ MOBA Arena</div>
          <div className="text-white/60 text-sm">{formatTime(time)}</div>
        </div>
        <div className="flex gap-4">
          <div className="text-blue-400 font-game text-xl">
            <span className="text-white/40">Blue:</span> 0
          </div>
          <div className="text-red-400 font-game text-xl">
            <span className="text-white/40">Red:</span> 0
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex">
        {/* Game Canvas */}
        <div 
          className="flex-1 relative overflow-hidden cursor-crosshair"
          onClick={handleCanvasClick}
          style={{
            background: `
              linear-gradient(135deg, #1a3a1a 0%, #1a4a1a 50%, #1a3a1a 100%),
              repeating-linear-gradient(0deg, transparent, transparent 49px, #2a4a2a 50px),
              repeating-linear-gradient(90deg, transparent, transparent 49px, #2a4a2a 50px)
            `
          }}
        >
          {/* Lane */}
          <div className="absolute top-1/2 left-0 right-0 h-20 bg-[#3a3020]/40 transform -translate-y-1/2"></div>
          
          {/* River */}
          <div className="absolute top-0 bottom-0 left-1/3 w-32 bg-[#2a4a6a]/30 transform -skew-x-12"></div>
          
          {/* Blue Base */}
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-40 h-60 bg-[#1e3a5f]/30 border-2 border-blue-500/50 rounded-lg">
            <div className="absolute inset-2 border border-blue-400/30 rounded"></div>
          </div>
          
          {/* Red Base */}
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-40 h-60 bg-[#5f1e1e]/30 border-2 border-red-500/50 rounded-lg">
            <div className="absolute inset-2 border border-red-400/30 rounded"></div>
          </div>

          {/* Towers */}
          {towers.blue.map((tower, i) => (
            <div key={tower.id} className="absolute">
              <div className="w-16 h-16 bg-blue-600/50 border-2 border-blue-400 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🏰</span>
              </div>
            </div>
          ))}
          {towers.red.map((tower, i) => (
            <div key={tower.id} className="absolute">
              <div className="w-16 h-16 bg-red-600/50 border-2 border-red-400 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🏰</span>
              </div>
            </div>
          ))}

          {/* Blue Team */}
          {blueTeam.map((member) => (
            <div 
              key={member.id}
              className={`absolute transition-all duration-100 ${member.isPlayer ? 'z-20' : 'z-10'}`}
              style={{ left: member.pos.x - 20, top: member.pos.y - 20 }}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-2 border-blue-300 shadow-lg shadow-blue-500/50 flex items-center justify-center text-lg">
                {CHAMPIONS[member.champion as keyof typeof CHAMPIONS]?.icon || '⚔️'}
              </div>
              {/* HP Bar */}
              <div className="w-12 h-2 bg-red-600 rounded-full mt-1 mx-auto">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${member.hp}%` }}></div>
              </div>
              {member.isPlayer && (
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white bg-black/50 px-1 rounded">
                  {member.name}
                </div>
              )}
            </div>
          ))}

          {/* Red Team */}
          {redTeam.map((member) => (
            <div 
              key={member.id}
              className="absolute transition-all duration-100 z-10"
              style={{ left: member.pos.x - 20, top: member.pos.y - 20 }}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-red-600 rounded-full border-2 border-red-300 shadow-lg shadow-red-500/50 flex items-center justify-center text-lg">
                {CHAMPIONS[member.champion as keyof typeof CHAMPIONS]?.icon || '⚔️'}
              </div>
              {/* HP Bar */}
              <div className="w-12 h-2 bg-red-600 rounded-full mt-1 mx-auto">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${member.hp}%` }}></div>
              </div>
            </div>
          ))}

          {/* Player (Special) */}
          <div 
            className="absolute z-30 transition-all duration-75"
            style={{ left: playerPos.x - 24, top: playerPos.y - 24 }}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-300 to-blue-500 rounded-full border-4 border-white shadow-xl shadow-blue-500/80 flex items-center justify-center text-2xl animate-pulse">
              {CHAMPIONS[selectedChampion as keyof typeof CHAMPIONS]?.icon || '✨'}
            </div>
            {/* HP & MP Bars */}
            <div className="mt-1">
              <div className="w-14 h-3 bg-gray-800 rounded-full overflow-hidden border border-white/30">
                <div className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all" style={{ width: `${playerHp}%` }}></div>
              </div>
              <div className="w-14 h-2 bg-gray-800 rounded-full overflow-hidden border border-white/20 mt-0.5">
                <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full" style={{ width: `${playerMp}%` }}></div>
              </div>
            </div>
          </div>

          {/* Minimap */}
          <div className="absolute bottom-4 left-4 w-48 h-32 bg-black/70 border border-white/20 rounded-lg p-2">
            <div className="w-full h-full bg-[#1a3a1a] relative rounded">
              {/* Blue base */}
              <div className="absolute left-1 top-1/2 transform -translate-y-1/2 w-4 h-6 bg-blue-500/70 rounded"></div>
              {/* Red base */}
              <div className="absolute right-1 top-1/2 transform -translate-y-1/2 w-4 h-6 bg-red-500/70 rounded"></div>
              {/* Lane */}
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#3a3020]/50 transform -translate-y-1/2"></div>
              {/* Player dot */}
              <div 
                className="absolute w-2 h-2 bg-blue-400 rounded-full border border-white"
                style={{ 
                  left: `${(playerPos.x / 1800) * 100}%`, 
                  top: `${(playerPos.y / 600) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              ></div>
              {/* Enemy dots */}
              {redTeam.map(e => (
                <div 
                  key={e.id}
                  className="absolute w-1.5 h-1.5 bg-red-500 rounded-full"
                  style={{ 
                    left: `${(e.pos.x / 1800) * 100}%`, 
                    top: `${(e.pos.y / 600) * 100}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                ></div>
              ))}
            </div>
          </div>

          {/* Exit Button */}
          <button 
            onClick={() => navigate('/play')}
            className="absolute top-4 left-4 px-3 py-1 bg-red-600/80 text-white text-sm rounded hover:bg-red-700"
          >
            ← Exit
          </button>
        </div>

        {/* Right Panel - Stats & Shop */}
        <div className="w-72 bg-[#0a0a15] border-l border-white/10 flex flex-col">
          {/* Player Stats */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-2 border-blue-300 flex items-center justify-center text-2xl">
                {CHAMPIONS[selectedChampion as keyof typeof CHAMPIONS]?.icon}
              </div>
              <div>
                <div className="text-white font-game">{user?.username || 'Player'}</div>
                <div className="text-white/50 text-sm">Level {playerLevel}</div>
              </div>
            </div>
            
            {/* HP/MP */}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>HP</span>
                  <span>{playerHp}/{playerMaxHp}</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all" style={{ width: `${(playerHp/playerMaxHp)*100}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>MP</span>
                  <span>{playerMp}/{playerMaxMp}</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all" style={{ width: `${(playerMp/playerMaxMp)*100}%` }}></div>
                </div>
              </div>
            </div>
            
            {/* Gold & CS */}
            <div className="flex justify-between mt-3 text-sm">
              <div className="text-yellow-400">💰 {playerGold}</div>
              <div className="text-white/60">CS: {playerCs}</div>
            </div>
          </div>

          {/* Abilities */}
          <div className="p-4 border-b border-white/10">
            <div className="text-white/60 text-sm mb-2 font-game">ABILITIES</div>
            <div className="grid grid-cols-4 gap-2">
              {['q', 'w', 'e', 'r'].map((key, i) => (
                <div key={key} className="relative">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-game ${
                    cooldowns[key as keyof typeof cooldowns] > 0 
                      ? 'bg-gray-700 text-gray-500' 
                      : 'bg-gradient-to-br from-purple-600 to-purple-800 text-white border border-purple-400'
                  }`}>
                    {key.toUpperCase()}
                  </div>
                  {cooldowns[key as keyof typeof cooldowns] > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold bg-black/60 rounded-lg">
                      {Math.ceil(cooldowns[key as keyof typeof cooldowns])}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-white/50 text-center">
              {CHAMPIONS[selectedChampion as keyof typeof CHAMPIONS]?.abilities[3]}
            </div>
          </div>

          {/* Items */}
          <div className="p-4 border-b border-white/10">
            <div className="text-white/60 text-sm mb-2 font-game">INVENTORY</div>
            <div className="grid grid-cols-3 gap-2">
              {inventory.map((item, i) => (
                <div 
                  key={i}
                  className="w-12 h-12 bg-gray-800 rounded border border-white/20 flex items-center justify-center text-lg"
                  title={item?.name || 'Empty'}
                >
                  {item ? '⚔️' : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="text-white/60 text-sm mb-2 font-game">SHOP</div>
            <div className="space-y-2">
              {ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => buyItem(item)}
                  disabled={playerGold < item.cost}
                  className={`w-full p-2 rounded border text-left transition ${
                    playerGold >= item.cost
                      ? 'bg-gray-800 border-white/20 hover:bg-gray-700'
                      : 'bg-gray-900 border-white/10 opacity-50'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="text-white text-sm">{item.name}</span>
                    <span className="text-yellow-400 text-sm">{item.cost}g</span>
                  </div>
                  <div className="text-white/40 text-xs">
                    {Object.entries(item.stats).map(([k, v]) => `${k}: +${v}`).join(', ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="bg-[#0a0a15] p-2 border-t border-white/10 flex justify-center gap-4">
        <div className="text-white/40 text-sm">
          <span className="text-white font-mono">WASD</span> Move | 
          <span className="text-white font-mono"> QWER</span> Abilities | 
          <span className="text-white font-mono"> Click</span> Move to location
        </div>
      </div>
    </div>
  );
}
