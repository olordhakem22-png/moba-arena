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
  maxHp: number;
  pos: { x: number; y: number };
  isPlayer?: boolean;
  level?: number;
}

interface DamageNumber {
  id: string;
  x: number;
  y: number;
  value: number;
  isCritical?: boolean;
  timestamp: number;
}

interface ParticleEffect {
  id: string;
  x: number;
  y: number;
  type: 'q' | 'w' | 'e' | 'r' | 'attack';
  timestamp: number;
}

interface KillAnnouncement {
  id: string;
  killer: string;
  victim: string;
  isPlayerKill: boolean;
  timestamp: number;
}

interface GoldNotification {
  id: string;
  amount: number;
  timestamp: number;
}

interface JungleCamp {
  id: string;
  pos: { x: number; y: number };
  type: 'small' | 'large' | 'epic';
  team: 'blue' | 'red' | 'neutral';
  isAlive: boolean;
}

// Champion data
const CHAMPIONS = {
  ahri: { name: 'Ahri', icon: '🦊', abilities: ['Orb', 'Fox-Fire', 'Charm', 'Spirit Rush'], color: 'from-purple-400 to-purple-600' },
  garen: { name: 'Garen', icon: '⚔️', abilities: ['Strike', 'Courage', 'Judgment', 'Demacian Justice'], color: 'from-slate-400 to-slate-600' },
  jinx: { name: 'Jinx', icon: '💣', abilities: ['Zap', 'Flame', 'Super Mega', 'Get Excited'], color: 'from-orange-400 to-red-600' },
  lux: { name: 'Lux', icon: '✨', abilities: ['Light Binding', 'Prismatic', 'Lucent Singularity', 'Final Spark'], color: 'from-yellow-300 to-yellow-500' },
  yasuo: { name: 'Yasuo', icon: '🌪️', abilities: ['Steel Tempest', 'Wind Wall', 'Sweeping Blade', 'Last Breath'], color: 'from-sky-300 to-slate-500' },
  nasus: { name: 'Nasus', icon: '🐕', abilities: ['Stalk', 'Wither', 'Spirit Fire', 'Fury of the Sands'], color: 'from-amber-600 to-amber-800' },
  thresh: { name: 'Thresh', icon: '👻', abilities: ['Death Sentence', 'Dark Passage', 'Flay', 'The Box'], color: 'from-teal-400 to-teal-600' },
  leesin: { name: 'Lee Sin', icon: '🥋', abilities: ['Sonic Wave', 'Safeguard', 'Tempest', 'Dragon Rage'], color: 'from-red-500 to-amber-600' },
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

// Helper function to get health bar color
const getHealthColor = (hp: number, maxHp: number) => {
  const percent = (hp / maxHp) * 100;
  if (percent > 60) return 'from-green-500 to-green-400';
  if (percent > 30) return 'from-yellow-500 to-yellow-400';
  return 'from-red-500 to-red-400';
};

// Helper function to get health bar background
const getHealthBgColor = (hp: number, maxHp: number) => {
  const percent = (hp / maxHp) * 100;
  if (percent > 60) return 'bg-green-600';
  if (percent > 30) return 'bg-yellow-600';
  return 'bg-red-600';
};

// Helper function to get health bar glow
const getHealthGlow = (hp: number, maxHp: number) => {
  const percent = (hp / maxHp) * 100;
  if (percent > 60) return 'shadow-green-500/50';
  if (percent > 30) return 'shadow-yellow-500/50';
  return 'shadow-red-500/50';
};

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
  const [prevPlayerPos, setPrevPlayerPos] = useState({ x: 400, y: 300 });
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
  
  // Visual effects state
  const [isAttacking, setIsAttacking] = useState(false);
  const [attackTarget, setAttackTarget] = useState<{ x: number; y: number } | null>(null);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [particles, setParticles] = useState<ParticleEffect[]>([]);
  const [killAnnouncements, setKillAnnouncements] = useState<KillAnnouncement[]>([]);
  const [goldNotifications, setGoldNotifications] = useState<GoldNotification[]>([]);
  const [isTakingDamage, setIsTakingDamage] = useState(false);
  const [selectedTower, setSelectedTower] = useState<string | null>(null);
  const [characterTrail, setCharacterTrail] = useState<{ x: number; y: number; id: string }[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [abilityWindup, setAbilityWindup] = useState<'q' | 'w' | 'e' | 'r' | null>(null);
  const [jungleCamps] = useState<JungleCamp[]>([
    { id: 'bj1', pos: { x: 250, y: 150 }, type: 'large', team: 'blue', isAlive: true },
    { id: 'bj2', pos: { x: 250, y: 450 }, type: 'small', team: 'blue', isAlive: true },
    { id: 'bj3', pos: { x: 350, y: 200 }, type: 'small', team: 'blue', isAlive: true },
    { id: 'rj1', pos: { x: 1550, y: 150 }, type: 'large', team: 'red', isAlive: true },
    { id: 'rj2', pos: { x: 1550, y: 450 }, type: 'small', team: 'red', isAlive: true },
    { id: 'rj3', pos: { x: 1450, y: 200 }, type: 'small', team: 'red', isAlive: true },
    { id: 'dragon', pos: { x: 900, y: 100 }, type: 'epic', team: 'neutral', isAlive: true },
    { id: 'baron', pos: { x: 900, y: 500 }, type: 'epic', team: 'neutral', isAlive: true },
  ]);
  
  // Team state
  const [blueTeam, setBlueTeam] = useState<Champion[]>([
    { id: 'player', name: user?.username || 'Player', champion: 'lux', hp: 100, maxHp: 100, pos: { x: 400, y: 300 }, isPlayer: true, level: 1 },
    { id: 'ally1', name: 'Bot Mid', champion: 'ahri', hp: 100, maxHp: 100, pos: { x: 400, y: 250 }, level: 2 },
    { id: 'ally2', name: 'Bot Jungle', champion: 'leesin', hp: 100, maxHp: 100, pos: { x: 350, y: 300 }, level: 2 },
    { id: 'ally3', name: 'Top', champion: 'garen', hp: 100, maxHp: 100, pos: { x: 400, y: 350 }, level: 1 },
    { id: 'ally4', name: 'ADC', champion: 'jinx', hp: 100, maxHp: 100, pos: { x: 450, y: 300 }, level: 1 },
  ]);
  
  const [redTeam, setRedTeam] = useState<Champion[]>([
    { id: 'enemy1', name: 'Enemy Top', champion: 'nasus', hp: 100, maxHp: 100, pos: { x: 1400, y: 300 }, level: 1 },
    { id: 'enemy2', name: 'Enemy Jungle', champion: 'leesin', hp: 100, maxHp: 100, pos: { x: 1350, y: 250 }, level: 2 },
    { id: 'enemy3', name: 'Enemy Mid', champion: 'ahri', hp: 100, maxHp: 100, pos: { x: 1400, y: 350 }, level: 1 },
    { id: 'enemy4', name: 'Enemy ADC', champion: 'jinx', hp: 100, maxHp: 100, pos: { x: 1450, y: 300 }, level: 1 },
    { id: 'enemy5', name: 'Enemy Support', champion: 'thresh', hp: 100, maxHp: 100, pos: { x: 1400, y: 200 }, level: 1 },
  ]);
  
  // Minions
  const [minions, setMinions] = useState<any[]>([]);
  
  // Towers
  const [towers] = useState({
    blue: [
      { id: 'bt1', pos: { x: 600, y: 300 }, hp: 100, range: 150 },
      { id: 'bt2', pos: { x: 800, y: 300 }, hp: 100, range: 150 },
      { id: 'bt3', pos: { x: 1000, y: 300 }, hp: 100, range: 150 },
    ],
    red: [
      { id: 'rt1', pos: { x: 1200, y: 300 }, hp: 100, range: 150 },
      { id: 'rt2', pos: { x: 1000, y: 300 }, hp: 100, range: 150 },
      { id: 'rt3', pos: { x: 800, y: 300 }, hp: 100, range: 150 },
    ],
  });
  
  // Game loop
  const [isPaused, setIsPaused] = useState(false);
  const gameLoopRef = useRef<number>();
  const trailIdRef = useRef(0);
  
  // Handle tower click for range indicator
  const handleTowerClick = (towerId: string) => {
    setSelectedTower(selectedTower === towerId ? null : towerId);
  };
  
  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!gameStarted || isDead) return;
    
    const speed = 6;
    let moved = false;
    let newX = playerPos.x;
    let newY = playerPos.y;
    
    switch (e.key.toLowerCase()) {
      case 'w': case 'arrowup':
        newY = Math.max(50, playerPos.y - speed);
        moved = true;
        break;
      case 's': case 'arrowdown':
        newY = Math.min(550, playerPos.y + speed);
        moved = true;
        break;
      case 'a': case 'arrowleft':
        newX = Math.max(50, playerPos.x - speed);
        moved = true;
        break;
      case 'd': case 'arrowright':
        newX = Math.min(1750, playerPos.x + speed);
        moved = true;
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
    
    if (moved) {
      setPrevPlayerPos(playerPos);
      setPlayerPos({ x: newX, y: newY });
      // Add trail
      setCharacterTrail(prev => [...prev.slice(-15), { x: playerPos.x, y: playerPos.y, id: `trail-${trailIdRef.current++}` }]);
    }
  }, [gameStarted, isDead, playerPos]);
  
  // Mouse click handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gameStarted || isDead) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPrevPlayerPos(playerPos);
    setPlayerPos({ x, y });
    // Add trail
    setCharacterTrail(prev => [...prev.slice(-15), { x: playerPos.x, y: playerPos.y, id: `trail-${trailIdRef.current++}` }]);
  };
  
  // Add damage number
  const addDamageNumber = (x: number, y: number, value: number, isCritical = false) => {
    const id = `dmg-${Date.now()}-${Math.random()}`;
    setDamageNumbers(prev => [...prev, { id, x, y, value, isCritical, timestamp: Date.now() }]);
    setTimeout(() => {
      setDamageNumbers(prev => prev.filter(d => d.id !== id));
    }, 1500);
  };
  
  // Add particle effect
  const addParticleEffect = (x: number, y: number, type: 'q' | 'w' | 'e' | 'r' | 'attack') => {
    const id = `particle-${Date.now()}-${Math.random()}`;
    setParticles(prev => [...prev, { id, x, y, type, timestamp: Date.now() }]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== id));
    }, 800);
  };
  
  // Add kill announcement
  const addKillAnnouncement = (killer: string, victim: string, isPlayerKill: boolean) => {
    const id = `kill-${Date.now()}`;
    setKillAnnouncements(prev => [...prev, { id, killer, victim, isPlayerKill, timestamp: Date.now() }]);
    setTimeout(() => {
      setKillAnnouncements(prev => prev.filter(k => k.id !== id));
    }, 3000);
  };
  
  // Add gold notification
  const addGoldNotification = (amount: number) => {
    const id = `gold-${Date.now()}`;
    setGoldNotifications(prev => [...prev, { id, amount, timestamp: Date.now() }]);
    setTimeout(() => {
      setGoldNotifications(prev => prev.filter(g => g.id !== id));
    }, 2000);
  };
  
  // Use ability
  const useAbility = (key: 'q' | 'w' | 'e' | 'r') => {
    if (cooldowns[key] > 0 || isDead) return;
    
    // Wind-up animation
    setAbilityWindup(key);
    setTimeout(() => setAbilityWindup(null), 200);
    
    // Add particle effect
    addParticleEffect(playerPos.x, playerPos.y, key);
    
    // Cast ability - damage nearest enemy
    const nearestEnemy = redTeam.reduce((nearest, enemy) => {
      if (enemy.hp <= 0) return nearest;
      const dist = Math.hypot(enemy.pos.x - playerPos.x, enemy.pos.y - playerPos.y);
      const nearestDist = nearest ? Math.hypot(nearest.pos.x - playerPos.x, nearest.pos.y - playerPos.y) : Infinity;
      return dist < nearestDist ? enemy : nearest;
    }, null as Champion | null);
    
    if (nearestEnemy) {
      const damage = key === 'r' ? 50 : key === 'q' ? 20 : 15;
      const isCrit = Math.random() < 0.1;
      const finalDamage = isCrit ? damage * 2 : damage;
      
      setRedTeam(team => team.map(e => {
        if (e.id === nearestEnemy.id) {
          const newHp = Math.max(0, e.hp - finalDamage);
          addDamageNumber(e.pos.x, e.pos.y - 30, finalDamage, isCrit);
          
          if (newHp <= 0) {
            addKillAnnouncement(user?.username || 'Player', e.name, true);
            addGoldNotification(300);
          }
          return { ...e, hp: newHp };
        }
        return e;
      }));
    }
    
    setCooldowns(cd => ({ ...cd, [key]: key === 'r' ? 10 : 5 }));
  };
  
  // Attack nearest enemy
  const attack = () => {
    if (isDead) return;
    
    const nearestEnemy = redTeam.reduce((nearest, enemy) => {
      if (enemy.hp <= 0) return nearest;
      const dist = Math.hypot(enemy.pos.x - playerPos.x, enemy.pos.y - playerPos.y);
      const nearestDist = nearest ? Math.hypot(nearest.pos.x - playerPos.x, nearest.pos.y - playerPos.y) : Infinity;
      return dist < nearestDist && dist < 200 ? enemy : nearest;
    }, null as Champion | null);
    
    if (nearestEnemy) {
      setIsAttacking(true);
      setAttackTarget({ x: nearestEnemy.pos.x, y: nearestEnemy.pos.y });
      addParticleEffect(playerPos.x, playerPos.y, 'attack');
      
      const isCrit = Math.random() < 0.15;
      const damage = isCrit ? 20 : 10;
      
      setTimeout(() => {
        setRedTeam(team => team.map(e => {
          if (e.id === nearestEnemy.id) {
            const newHp = Math.max(0, e.hp - damage);
            addDamageNumber(e.pos.x, e.pos.y - 30, damage, isCrit);
            
            if (newHp <= 0) {
              addKillAnnouncement(user?.username || 'Player', e.name, true);
              addGoldNotification(300);
            }
            return { ...e, hp: newHp };
          }
          return e;
        }));
        setIsAttacking(false);
        setAttackTarget(null);
      }, 150);
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
      if (dist && dist < 150 && !isAttacking && !isDead) {
        attack();
      }
      
      // Check if player is dead
      if (playerHp <= 0 && !isDead) {
        setIsDead(true);
      }
      
      // Check win condition
      if (redTeam.every(e => e.hp <= 0)) {
        setGamePhase('ended');
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [gameStarted, isPaused, playerPos, isAttacking, isDead, playerHp, redTeam]);
  
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
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⚔️</div>
          <h2 className="font-bold text-3xl mb-2 text-white">Game Loading...</h2>
          <p className="text-white/40">Connecting to server...</p>
          <p className="text-white/30 text-sm mt-2">Game ID: {gameId}</p>
        </div>
      </div>
    );
  }

  if (gamePhase === 'ended') {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="bg-[#1a1a2e] rounded-2xl p-8 text-center shadow-2xl border border-yellow-500/30">
          <div className="text-6xl mb-4 animate-bounce">🏆</div>
          <h2 className="text-4xl font-bold mb-4 text-yellow-400">VICTORY!</h2>
          <p className="text-white/60 mb-6">Game Duration: {formatTime(time)}</p>
          <button onClick={() => navigate('/play')} className="bg-gradient-to-r from-yellow-500 to-yellow-600 px-8 py-3 rounded-lg font-bold text-black hover:from-yellow-400 hover:to-yellow-500 transition">
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
          <div className="text-yellow-400 font-bold text-lg flex items-center gap-2">
            <span className="animate-pulse">⚔️</span> MOBA Arena
          </div>
          <div className="text-white/60 text-sm font-mono bg-black/30 px-3 py-1 rounded">{formatTime(time)}</div>
        </div>
        <div className="flex gap-4">
          <div className="text-blue-400 font-bold text-xl">
            <span className="text-white/40">Blue:</span> 0
          </div>
          <div className="text-red-400 font-bold text-xl">
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
              /* Grass base with texture */
              radial-gradient(ellipse at 20% 30%, #2d5a2d 0%, transparent 50%),
              radial-gradient(ellipse at 80% 70%, #2d5a2d 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, #1e4a1e 0%, #1a3a1a 100%),
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 2px,
                rgba(0, 100, 0, 0.03) 2px,
                rgba(0, 100, 0, 0.03) 4px
              ),
              repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 2px,
                rgba(0, 80, 0, 0.02) 2px,
                rgba(0, 80, 0, 0.02) 4px
              )
            `,
          }}
        >
          {/* Animated Grid Overlay for grass texture */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
            }}
          />
          
          {/* Top Lane */}
          <div className="absolute top-[15%] left-[10%] right-[10%] h-16 bg-[#5a4a30]/60 rounded-lg shadow-inner"
            style={{
              background: 'linear-gradient(180deg, #6a5a40 0%, #4a3a20 100%)',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5), 0 0 20px rgba(90,74,48,0.3)'
            }}
          >
            <div className="absolute inset-0 border-2 border-[#7a6a50]/40 rounded-lg" />
          </div>
          
          {/* Bottom Lane */}
          <div className="absolute bottom-[15%] left-[10%] right-[10%] h-16 bg-[#5a4a30]/60 rounded-lg shadow-inner"
            style={{
              background: 'linear-gradient(180deg, #6a5a40 0%, #4a3a20 100%)',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5), 0 0 20px rgba(90,74,48,0.3)'
            }}
          >
            <div className="absolute inset-0 border-2 border-[#7a6a50]/40 rounded-lg" />
          </div>
          
          {/* Mid Lane (diagonal) */}
          <div className="absolute top-[10%] bottom-[10%] left-[45%] w-20 bg-[#5a4a30]/50 rounded-lg transform rotate-[-30deg] origin-center"
            style={{
              background: 'linear-gradient(90deg, #6a5a40 0%, #4a3a20 100%)',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
            }}
          />
          
          {/* River with Wave Animation */}
          <div 
            className="absolute top-0 bottom-0 left-[33%] w-36"
            style={{
              background: 'linear-gradient(180deg, #1a3a5a 0%, #2a5a7a 50%, #1a3a5a 100%)',
              animation: 'riverShimmer 3s ease-in-out infinite',
            }}
          >
            {/* Wave patterns */}
            <div className="absolute inset-0 overflow-hidden">
              <div 
                className="absolute w-[200%] h-4 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                style={{
                  top: '20%',
                  animation: 'waveMove 2s linear infinite',
                }}
              />
              <div 
                className="absolute w-[200%] h-3 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                style={{
                  top: '50%',
                  animation: 'waveMove 2.5s linear infinite reverse',
                }}
              />
              <div 
                className="absolute w-[200%] h-4 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                style={{
                  top: '75%',
                  animation: 'waveMove 1.8s linear infinite',
                }}
              />
            </div>
            {/* River glow */}
            <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(42,90,122,0.5)]" />
          </div>
          
          {/* River wave keyframes */}
          <style>{`
            @keyframes riverShimmer {
              0%, 100% { filter: brightness(1); }
              50% { filter: brightness(1.1); }
            }
            @keyframes waveMove {
              0% { transform: translateX(-50%); }
              100% { transform: translateX(0%); }
            }
          `}</style>
          
          {/* Blue Base */}
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-40 h-60 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #1e3a5f 0%, #0f1f3f 100%)',
              boxShadow: '0 0 40px rgba(30, 58, 95, 0.6), inset 0 0 30px rgba(59, 130, 246, 0.2)'
            }}
          >
            <div className="absolute inset-2 border-2 border-blue-400/40 rounded-lg" />
            <div className="absolute inset-4 border border-blue-500/30 rounded" />
            {/* Nexus glow */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-blue-400/30 rounded-full blur-xl animate-pulse" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-3xl">💧</div>
          </div>
          
          {/* Red Base */}
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-40 h-60 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #5f1e1e 0%, #3f0f0f 100%)',
              boxShadow: '0 0 40px rgba(95, 30, 30, 0.6), inset 0 0 30px rgba(239, 68, 68, 0.2)'
            }}
          >
            <div className="absolute inset-2 border-2 border-red-400/40 rounded-lg" />
            <div className="absolute inset-4 border border-red-500/30 rounded" />
            {/* Nexus glow */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-red-400/30 rounded-full blur-xl animate-pulse" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-3xl">🔥</div>
          </div>

          {/* Jungle Camps */}
          {jungleCamps.map((camp) => (
            <div
              key={camp.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-opacity ${camp.isAlive ? 'opacity-100' : 'opacity-30'}`}
              style={{ left: camp.pos.x, top: camp.pos.y }}
            >
              {/* Camp marker */}
              <div 
                className={`rounded-full border-2 flex items-center justify-center ${
                  camp.type === 'epic' ? 'w-14 h-14' : 'w-10 h-10'
                } ${camp.team === 'blue' ? 'bg-blue-900/50 border-blue-400' : 
                   camp.team === 'red' ? 'bg-red-900/50 border-red-400' : 
                   'bg-purple-900/50 border-purple-400'}`}
                style={{
                  boxShadow: camp.type === 'epic' ? '0 0 20px rgba(168,85,247,0.5)' : '0 0 10px rgba(100,100,100,0.3)',
                  animation: camp.type === 'epic' ? 'epicPulse 2s ease-in-out infinite' : 'none'
                }}
              >
                <span className="text-lg">
                  {camp.type === 'epic' ? (camp.id === 'dragon' ? '🐉' : '🐍') : 
                   camp.type === 'large' ? '🐗' : '🐺'}
                </span>
              </div>
              {/* Respawn timer circle */}
              {!camp.isAlive && (
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/30" />
              )}
            </div>
          ))}
          
          <style>{`
            @keyframes epicPulse {
              0%, 100% { transform: scale(1); filter: brightness(1); }
              50% { transform: scale(1.05); filter: brightness(1.2); }
            }
          `}</style>

          {/* Towers with Range Indicators */}
          {towers.blue.map((tower, i) => (
            <div 
              key={tower.id} 
              className="absolute cursor-pointer"
              style={{ left: tower.pos.x - 24, top: tower.pos.y - 24 }}
              onClick={(e) => { e.stopPropagation(); handleTowerClick(tower.id); }}
            >
              {/* Range indicator */}
              {selectedTower === tower.id && (
                <div 
                  className="absolute rounded-full border-2 border-blue-400/40 bg-blue-400/10"
                  style={{
                    width: tower.range * 2,
                    height: tower.range * 2,
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    animation: 'rangePulse 1.5s ease-in-out infinite'
                  }}
                />
              )}
              {/* Tower */}
              <div 
                className={`w-12 h-12 rounded-lg flex items-center justify-center transition-transform ${selectedTower === tower.id ? 'scale-110' : ''}`}
                style={{
                  background: tower.hp > 50 ? 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)' : 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
                  boxShadow: tower.hp > 50 ? '0 0 20px rgba(59,130,246,0.5)' : '0 0 10px rgba(220,38,38,0.3)',
                  border: '2px solid',
                  borderColor: tower.hp > 50 ? '#60a5fa' : '#f87171'
                }}
              >
                <span className="text-xl drop-shadow-lg">🏰</span>
              </div>
              {/* Tower HP bar */}
              <div className="w-12 h-1.5 bg-gray-800 rounded-full mt-1 mx-auto overflow-hidden">
                <div 
                  className={`h-full transition-all ${tower.hp > 50 ? 'bg-blue-400' : 'bg-red-400'}`}
                  style={{ width: `${tower.hp}%` }}
                />
              </div>
            </div>
          ))}
          
          {towers.red.map((tower, i) => (
            <div 
              key={tower.id} 
              className="absolute cursor-pointer"
              style={{ left: tower.pos.x - 24, top: tower.pos.y - 24 }}
              onClick={(e) => { e.stopPropagation(); handleTowerClick(tower.id); }}
            >
              {/* Range indicator */}
              {selectedTower === tower.id && (
                <div 
                  className="absolute rounded-full border-2 border-red-400/40 bg-red-400/10"
                  style={{
                    width: tower.range * 2,
                    height: tower.range * 2,
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    animation: 'rangePulse 1.5s ease-in-out infinite'
                  }}
                />
              )}
              {/* Tower */}
              <div 
                className={`w-12 h-12 rounded-lg flex items-center justify-center transition-transform ${selectedTower === tower.id ? 'scale-110' : ''}`}
                style={{
                  background: tower.hp > 50 ? 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)' : 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
                  boxShadow: tower.hp > 50 ? '0 0 20px rgba(239,68,68,0.5)' : '0 0 10px rgba(220,38,38,0.3)',
                  border: '2px solid',
                  borderColor: tower.hp > 50 ? '#f87171' : '#fca5a5'
                }}
              >
                <span className="text-xl drop-shadow-lg">🏰</span>
              </div>
              {/* Tower HP bar */}
              <div className="w-12 h-1.5 bg-gray-800 rounded-full mt-1 mx-auto overflow-hidden">
                <div 
                  className={`h-full transition-all ${tower.hp > 50 ? 'bg-red-400' : 'bg-red-700'}`}
                  style={{ width: `${tower.hp}%` }}
                />
              </div>
            </div>
          ))}
          
          <style>{`
            @keyframes rangePulse {
              0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
              50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.02); }
            }
          `}</style>

          {/* Movement Trail */}
          {characterTrail.map((trail, i) => (
            <div
              key={trail.id}
              className="absolute w-4 h-4 rounded-full bg-blue-400/30 pointer-events-none"
              style={{
                left: trail.x - 8,
                top: trail.y - 8,
                animation: 'trailFade 0.5s ease-out forwards',
                opacity: (i / characterTrail.length) * 0.5,
                transform: `scale(${(i / characterTrail.length) * 0.8 + 0.2})`,
              }}
            />
          ))}
          
          <style>{`
            @keyframes trailFade {
              0% { opacity: 0.6; transform: scale(1); }
              100% { opacity: 0; transform: scale(0.2); }
            }
          `}</style>

          {/* Blue Team */}
          {blueTeam.map((member) => (
            member.hp > 0 && (
            <div 
              key={member.id}
              className={`absolute transition-all duration-75 ${member.isPlayer ? 'z-20' : 'z-10'}`}
              style={{ left: member.pos.x - 20, top: member.pos.y - 20 }}
            >
              {/* Character shadow */}
              <div 
                className="absolute w-8 h-3 bg-black/40 rounded-full blur-sm"
                style={{ left: '50%', top: '100%', transform: 'translateX(-50%)' }}
              />
              {/* Character body */}
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg relative ${abilityWindup ? 'animate-windup' : ''}`}
                style={{
                  background: `linear-gradient(135deg, ${member.hp > 0 ? '#60a5fa' : '#374151'}, ${member.hp > 0 ? '#3b82f6' : '#1f2937'})`,
                  boxShadow: member.hp > 0 ? '0 0 20px rgba(59,130,246,0.6), 0 4px 8px rgba(0,0,0,0.3)' : 'none',
                  border: `2px solid ${member.hp > 0 ? '#93c5fd' : '#4b5563'}`,
                  transition: 'all 0.15s ease'
                }}
              >
                {CHAMPIONS[member.champion as keyof typeof CHAMPIONS]?.icon || '⚔️'}
                {/* Attack flash */}
                {isAttacking && member.isPlayer && (
                  <div className="absolute inset-0 bg-white/60 rounded-full animate-attack-flash" />
                )}
              </div>
              {/* Level indicator */}
              {member.level && (
                <div 
                  className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-gradient-to-b from-yellow-400 to-yellow-600 text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-yellow-300 shadow"
                  style={{ lineHeight: 1 }}
                >
                  {member.level}
                </div>
              )}
              {/* HP Bar */}
              <div className="w-12 h-2 bg-gray-900 rounded-full mt-1 mx-auto overflow-hidden border border-black/50">
                <div 
                  className={`h-full rounded-full transition-all duration-200 ${getHealthBgColor(member.hp, member.maxHp)}`}
                  style={{ width: `${(member.hp / member.maxHp) * 100}%` }}
                >
                  <div className={`h-full bg-gradient-to-r ${getHealthColor(member.hp, member.maxHp)} rounded-full`} />
                </div>
              </div>
              {/* Name tag */}
              {member.isPlayer && (
                <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-[10px] text-white bg-black/70 px-1.5 py-0.5 rounded whitespace-nowrap shadow">
                  {member.name}
                </div>
              )}
            </div>
            )
          ))}

          {/* Red Team */}
          {redTeam.map((member) => (
            member.hp > 0 && (
            <div 
              key={member.id}
              className="absolute transition-all duration-75 z-10"
              style={{ left: member.pos.x - 20, top: member.pos.y - 20 }}
            >
              {/* Character shadow */}
              <div 
                className="absolute w-8 h-3 bg-black/40 rounded-full blur-sm"
                style={{ left: '50%', top: '100%', transform: 'translateX(-50%)' }}
              />
              {/* Character body */}
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                style={{
                  background: 'linear-gradient(135deg, #f87171, #ef4444)',
                  boxShadow: '0 0 20px rgba(239,68,68,0.6), 0 4px 8px rgba(0,0,0,0.3)',
                  border: '2px solid #fca5a5',
                  transition: 'all 0.15s ease'
                }}
              >
                {CHAMPIONS[member.champion as keyof typeof CHAMPIONS]?.icon || '⚔️'}
                {/* Taking damage flash */}
                {isTakingDamage && (
                  <div className="absolute inset-0 bg-red-500/60 rounded-full animate-damage-flash" />
                )}
              </div>
              {/* Level indicator */}
              {member.level && (
                <div 
                  className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-gradient-to-b from-yellow-400 to-yellow-600 text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-yellow-300 shadow"
                  style={{ lineHeight: 1 }}
                >
                  {member.level}
                </div>
              )}
              {/* HP Bar */}
              <div className="w-12 h-2 bg-gray-900 rounded-full mt-1 mx-auto overflow-hidden border border-black/50">
                <div 
                  className={`h-full rounded-full transition-all duration-200 ${getHealthBgColor(member.hp, member.maxHp)}`}
                  style={{ width: `${(member.hp / member.maxHp) * 100}%` }}
                >
                  <div className={`h-full bg-gradient-to-r ${getHealthColor(member.hp, member.maxHp)} rounded-full`} />
                </div>
              </div>
            </div>
            )
          ))}
          
          {/* Dead characters fade out */}
          {redTeam.filter(m => m.hp <= 0).map((member) => (
            <div 
              key={`dead-${member.id}`}
              className="absolute z-5 animate-death-fade"
              style={{ left: member.pos.x - 20, top: member.pos.y - 20 }}
            >
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg opacity-30 grayscale"
              >
                {CHAMPIONS[member.champion as keyof typeof CHAMPIONS]?.icon || '⚔️'}
              </div>
            </div>
          ))}
          
          <style>{`
            @keyframes trailFade {
              0% { opacity: 0.5; transform: scale(1); }
              100% { opacity: 0; transform: scale(0.3); }
            }
            @keyframes attack-flash {
              0% { opacity: 0.8; transform: scale(1.1); }
              100% { opacity: 0; transform: scale(1); }
            }
            @keyframes damage-flash {
              0% { opacity: 0.8; transform: scale(1.1); }
              100% { opacity: 0; transform: scale(1); }
            }
            @keyframes windup {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(0.9); }
            }
            @keyframes death-fade {
              0% { opacity: 1; }
              100% { opacity: 0.3; }
            }
            .animate-attack-flash { animation: attack-flash 0.15s ease-out; }
            .animate-damage-flash { animation: damage-flash 0.2s ease-out; }
            .animate-windup { animation: windup 0.2s ease-out; }
            .animate-death-fade { animation: death-fade 0.5s ease-out forwards; }
          `}</style>

          {/* Particle Effects */}
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="absolute pointer-events-none"
              style={{
                left: particle.x,
                top: particle.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Q ability - Light binding beams */}
              {particle.type === 'q' && (
                <div className="relative">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-8 bg-gradient-to-t from-yellow-300 to-transparent"
                      style={{
                        left: (i - 1) * 8,
                        animation: `beamShoot 0.5s ease-out forwards`,
                        animationDelay: `${i * 0.05}s`,
                        transform: 'translateX(-50%)',
                      }}
                    />
                  ))}
                  <div className="w-6 h-6 bg-yellow-400/60 rounded-full blur-sm animate-particle-burst" />
                </div>
              )}
              {/* W ability - Prismatic barrier */}
              {particle.type === 'w' && (
                <div className="relative">
                  <div 
                    className="w-16 h-16 rounded-full border-2 border-blue-400/60"
                    style={{
                      animation: 'prismaticRing 0.6s ease-out forwards',
                      boxShadow: '0 0 20px rgba(59, 130, 246, 0.5), inset 0 0 20px rgba(59, 130, 246, 0.3)'
                    }}
                  />
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 bg-blue-400 rounded-full"
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: `rotate(${i * 60}deg) translateX(20px)`,
                        animation: 'orbit 0.6s linear forwards',
                      }}
                    />
                  ))}
                </div>
              )}
              {/* E ability - Lucent Singularity */}
              {particle.type === 'e' && (
                <div className="relative">
                  <div 
                    className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full"
                    style={{
                      animation: 'singularityExpand 0.6s ease-out forwards',
                      boxShadow: '0 0 30px rgba(251, 146, 60, 0.8)'
                    }}
                  />
                  <div 
                    className="absolute inset-0 rounded-full border-2 border-orange-400"
                    style={{ animation: 'singularityRing 0.6s ease-out forwards' }}
                  />
                </div>
              )}
              {/* R ability - Final Spark */}
              {particle.type === 'r' && (
                <div className="relative">
                  <div 
                    className="absolute w-4 h-40 bg-gradient-to-t from-yellow-400 via-white to-transparent"
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      animation: 'finalSpark 0.8s ease-out forwards',
                      boxShadow: '0 0 40px 10px rgba(250, 204, 21, 0.8)'
                    }}
                  />
                  <div 
                    className="absolute w-8 h-8 bg-white rounded-full"
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      animation: 'finalSparkCenter 0.8s ease-out forwards',
                    }}
                  />
                </div>
              )}
              {/* Attack effect */}
              {particle.type === 'attack' && (
                <div className="relative">
                  <div 
                    className="w-6 h-6 bg-gradient-to-br from-white to-yellow-200 rounded-full"
                    style={{
                      animation: 'attackParticle 0.3s ease-out forwards',
                      boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)'
                    }}
                  />
                </div>
              )}
            </div>
          ))}
          
          {/* Attack line from player to target */}
          {isAttacking && attackTarget && (
            <svg className="absolute inset-0 pointer-events-none z-25">
              <line
                x1={playerPos.x}
                y1={playerPos.y}
                x2={attackTarget.x}
                y2={attackTarget.y}
                stroke="url(#attackGradient)"
                strokeWidth="3"
                strokeDasharray="8,4"
                style={{ animation: 'attackLine 0.15s linear' }}
              />
              <defs>
                <linearGradient id="attackGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>
              </defs>
            </svg>
          )}
          
          <style>{`
            @keyframes beamShoot {
              0% { opacity: 1; transform: translateX(-50%) translateY(0); }
              100% { opacity: 0; transform: translateX(-50%) translateY(-60px); }
            }
            @keyframes particleBurst {
              0% { transform: scale(0); opacity: 1; }
              100% { transform: scale(2); opacity: 0; }
            }
            @keyframes prismaticRing {
              0% { transform: scale(0); opacity: 1; }
              100% { transform: scale(1.5); opacity: 0; }
            }
            @keyframes orbit {
              0% { transform: rotate(0deg) translateX(20px); opacity: 1; }
              100% { transform: rotate(360deg) translateX(20px); opacity: 0; }
            }
            @keyframes singularityExpand {
              0% { transform: scale(0); opacity: 1; }
              50% { transform: scale(1.5); opacity: 0.8; }
              100% { transform: scale(2); opacity: 0; }
            }
            @keyframes singularityRing {
              0% { transform: scale(0); opacity: 1; }
              100% { transform: scale(3); opacity: 0; }
            }
            @keyframes finalSpark {
              0% { height: 0; opacity: 1; }
              30% { height: 40px; opacity: 1; }
              100% { height: 80px; opacity: 0; }
            }
            @keyframes finalSparkCenter {
              0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
            }
            @keyframes attackParticle {
              0% { transform: scale(0); opacity: 1; }
              50% { transform: scale(1.5); opacity: 0.8; }
              100% { transform: scale(0.5); opacity: 0; }
            }
            @keyframes attackLine {
              0% { opacity: 1; }
              100% { opacity: 0; }
            }
            .animate-particle-burst { animation: particleBurst 0.4s ease-out forwards; }
          `}</style>

          {/* Damage Numbers */}
          {damageNumbers.map((dmg) => (
            <div
              key={dmg.id}
              className={`absolute font-bold pointer-events-none z-40 ${dmg.isCritical ? 'text-yellow-300 text-xl' : 'text-white text-sm'}`}
              style={{
                left: dmg.x,
                top: dmg.y,
                transform: 'translate(-50%, -50%)',
                animation: 'damageFloat 1.2s ease-out forwards',
                textShadow: dmg.isCritical ? '0 0 10px #fbbf24, 2px 2px 4px rgba(0,0,0,0.5)' : '2px 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              {dmg.isCritical && '💥 '}{dmg.value}
            </div>
          ))}
          
          <style>{`
            @keyframes damageFloat {
              0% { 
                opacity: 1; 
                transform: translate(-50%, -50%) scale(1.2);
              }
              20% {
                transform: translate(-50%, -70%) scale(1);
              }
              100% { 
                opacity: 0; 
                transform: translate(-50%, -150%) scale(0.8);
              }
            }
          `}</style>

          {/* Player (Special) */}
          {!isDead && (
            <div 
              className="absolute z-30 transition-all duration-75"
              style={{ left: playerPos.x - 24, top: playerPos.y - 24 }}
            >
              {/* Player shadow */}
              <div 
                className="absolute w-10 h-4 bg-black/50 rounded-full blur-sm"
                style={{ left: '50%', top: '100%', transform: 'translateX(-50%)' }}
              />
              {/* Player body */}
              <div 
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl relative ${abilityWindup ? 'animate-windup' : ''} ${isAttacking ? 'animate-attack-pulse' : ''}`}
                style={{
                  background: 'linear-gradient(135deg, #93c5fd, #3b82f6)',
                  boxShadow: '0 0 30px rgba(59, 130, 246, 0.8), 0 6px 12px rgba(0,0,0,0.4)',
                  border: '4px solid white',
                  transition: 'all 0.1s ease',
                }}
              >
                {CHAMPIONS[selectedChampion as keyof typeof CHAMPIONS]?.icon || '✨'}
                {/* Attack flash effect */}
                {isAttacking && (
                  <div className="absolute inset-0 bg-white/50 rounded-full animate-attack-flash" />
                )}
                {/* Range indicator ring */}
                <div className="absolute -inset-2 rounded-full border-2 border-blue-400/30 animate-ping" />
              </div>
              {/* Level badge */}
              <div 
                className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gradient-to-b from-yellow-400 to-yellow-600 text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-yellow-300 shadow-lg z-10"
                style={{ lineHeight: 1 }}
              >
                {playerLevel}
              </div>
              {/* HP & MP Bars */}
              <div className="mt-1">
                <div className="w-14 h-3.5 bg-gray-900 rounded-full overflow-hidden border-2 border-black/50 shadow-inner">
                  <div 
                    className={`h-full bg-gradient-to-r ${getHealthColor(playerHp, playerMaxHp)} rounded-full transition-all duration-200 relative`}
                    style={{ width: `${(playerHp / playerMaxHp) * 100}%` }}
                  >
                    {/* HP glow */}
                    <div className={`absolute inset-0 bg-white/20 rounded-full ${getHealthGlow(playerHp, playerMaxHp)}`} />
                  </div>
                </div>
                <div className="w-14 h-2 bg-gray-900 rounded-full overflow-hidden border border-black/30 mt-0.5 shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all"
                    style={{ width: `${(playerMp / playerMaxMp) * 100}%` }}
                  />
                </div>
              </div>
              {/* Player name */}
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white bg-black/80 px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                {user?.username || 'Player'}
              </div>
            </div>
          )}
          
          {/* Dead overlay */}
          {isDead && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="text-center animate-death-respawn">
                <div className="text-6xl mb-4 grayscale opacity-50">💀</div>
                <div className="text-white text-2xl font-bold mb-2">YOU DIED</div>
                <div className="text-white/60">Respawning...</div>
              </div>
            </div>
          )}
          
          <style>{`
            @keyframes attack-pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.15); }
            }
            @keyframes death-respawn {
              0% { opacity: 0; transform: scale(0.8); }
              100% { opacity: 1; transform: scale(1); }
            }
            .animate-attack-pulse { animation: attack-pulse 0.15s ease-out; }
            .animate-death-respawn { animation: death-respawn 0.5s ease-out; }
          `}</style>

          {/* Kill Announcements */}
          {killAnnouncements.map((kill, idx) => (
            <div
              key={kill.id}
              className={`absolute top-1/4 left-1/2 transform -translate-x-1/2 z-50 ${kill.isPlayerKill ? 'animate-kill-announce' : ''}`}
            >
              <div className="bg-gradient-to-r from-black/90 via-red-900/90 to-black/90 px-6 py-3 rounded-lg border border-red-500/50 shadow-2xl">
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 font-bold">{kill.killer}</span>
                  <span className="text-white/60">slain</span>
                  <span className="text-red-400 font-bold">{kill.victim}</span>
                </div>
                <div className="text-yellow-400 text-sm text-center mt-1">+300 gold</div>
              </div>
            </div>
          ))}
          
          <style>{`
            @keyframes kill-announce {
              0% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.8); }
              15% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.1); }
              30% { transform: translateX(-50%) translateY(0) scale(1); }
              80% { opacity: 1; }
              100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            }
            .animate-kill-announce { animation: kill-announce 3s ease-out forwards; }
          `}</style>

          {/* Gold Notifications */}
          {goldNotifications.map((gold) => (
            <div
              key={gold.id}
              className="absolute z-40 animate-gold-pop"
              style={{
                left: '50%',
                top: '30%',
                transform: 'translateX(-50%)',
              }}
            >
              <div className="bg-gradient-to-r from-yellow-600/90 to-yellow-500/90 px-4 py-2 rounded-lg shadow-lg border border-yellow-400/50">
                <span className="text-yellow-100 font-bold">+{gold.amount} Gold</span>
              </div>
            </div>
          ))}
          
          <style>{`
            @keyframes gold-pop {
              0% { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.8); }
              20% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.1); }
              40% { transform: translateX(-50%) translateY(-5px) scale(1); }
              80% { opacity: 1; }
              100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            }
            .animate-gold-pop { animation: gold-pop 2s ease-out forwards; }
          `}</style>

          {/* Minimap */}
          <div className="absolute bottom-4 left-4 w-56 h-36 bg-black/80 border border-white/20 rounded-lg p-2 shadow-2xl overflow-hidden">
            <div className="w-full h-full bg-[#1a3a1a] relative rounded overflow-hidden">
              {/* Map grid */}
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: '14px 9px',
                }}
              />
              {/* Blue base */}
              <div 
                className="absolute left-1 top-1/2 transform -translate-y-1/2 w-5 h-8 bg-blue-500/80 rounded"
                style={{ boxShadow: '0 0 10px rgba(59,130,246,0.5)' }}
              />
              {/* Red base */}
              <div 
                className="absolute right-1 top-1/2 transform -translate-y-1/2 w-5 h-8 bg-red-500/80 rounded"
                style={{ boxShadow: '0 0 10px rgba(239,68,68,0.5)' }}
              />
              {/* Lanes */}
              <div className="absolute top-[50%] left-0 right-0 h-1 bg-[#5a4a30]/60 transform -translate-y-1/2" />
              {/* River */}
              <div className="absolute top-0 bottom-0 left-[33%] w-4 bg-blue-900/40" />
              {/* Jungle markers */}
              <div className="absolute left-[12%] top-[20%] w-2 h-2 bg-blue-600/60 rounded-full" />
              <div className="absolute right-[12%] top-[80%] w-2 h-2 bg-red-600/60 rounded-full" />
              {/* Epic monsters */}
              <div className="absolute left-[50%] top-[15%] w-3 h-3 bg-purple-500/70 rounded-full" style={{ boxShadow: '0 0 6px rgba(168,85,247,0.5)' }} />
              <div className="absolute left-[50%] bottom-[15%] w-3 h-3 bg-purple-500/70 rounded-full" style={{ boxShadow: '0 0 6px rgba(168,85,247,0.5)' }} />
              {/* Player dot */}
              <div 
                className="absolute w-3 h-3 bg-blue-400 rounded-full border-2 border-white shadow-lg"
                style={{ 
                  left: `${Math.min(Math.max((playerPos.x / 1800) * 100, 2), 98)}%`, 
                  top: `${Math.min(Math.max((playerPos.y / 600) * 100, 5), 95)}%`,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 8px rgba(59,130,246,0.8)'
                }}
              />
              {/* Enemy dots */}
              {redTeam.filter(e => e.hp > 0).map(e => (
                <div 
                  key={e.id}
                  className="absolute w-2.5 h-2.5 bg-red-500 rounded-full"
                  style={{ 
                    left: `${Math.min(Math.max((e.pos.x / 1800) * 100, 2), 98)}%`, 
                    top: `${Math.min(Math.max((e.pos.y / 600) * 100, 5), 95)}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              ))}
              {/* Ally dots */}
              {blueTeam.filter(e => e.hp > 0 && !e.isPlayer).map(e => (
                <div 
                  key={e.id}
                  className="absolute w-2 h-2 bg-blue-600 rounded-full"
                  style={{ 
                    left: `${Math.min(Math.max((e.pos.x / 1800) * 100, 2), 98)}%`, 
                    top: `${Math.min(Math.max((e.pos.y / 600) * 100, 5), 95)}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              ))}
            </div>
            {/* Minimap label */}
            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[8px] text-white/40 font-mono">MAP</div>
          </div>

          {/* Exit Button */}
          <button 
            onClick={() => navigate('/play')}
            className="absolute top-4 left-4 px-3 py-1.5 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm rounded-lg hover:from-red-500 hover:to-red-600 transition shadow-lg border border-red-500/50"
          >
            ← Exit
          </button>
        </div>

        {/* Right Panel - Stats & Shop */}
        <div className="w-72 bg-[#0a0a15] border-l border-white/10 flex flex-col">
          {/* Player Stats */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                style={{
                  background: `linear-gradient(135deg, #93c5fd, #3b82f6)`,
                  boxShadow: '0 0 20px rgba(59,130,246,0.5)',
                  border: '2px solid #60a5fa'
                }}
              >
                {CHAMPIONS[selectedChampion as keyof typeof CHAMPIONS]?.icon}
              </div>
              <div>
                <div className="text-white font-bold">{user?.username || 'Player'}</div>
                <div className="flex items-center gap-2">
                  <span className="text-white/50 text-sm">Level {playerLevel}</span>
                  <div className="flex gap-0.5">
                    {[...Array(Math.min(playerLevel, 5))].map((_, i) => (
                      <span key={i} className="text-yellow-400 text-xs">★</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* HP/MP */}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>HP</span>
                  <span className={playerHp < 30 ? 'text-red-400 animate-pulse' : ''}>{playerHp}/{playerMaxHp}</span>
                </div>
                <div className="h-3.5 bg-gray-800 rounded-full overflow-hidden border border-black/30 shadow-inner">
                  <div 
                    className={`h-full bg-gradient-to-r ${getHealthColor(playerHp, playerMaxHp)} rounded-full transition-all duration-200 relative`}
                    style={{ width: `${(playerHp / playerMaxHp) * 100}%` }}
                  >
                    <div className={`absolute inset-0 bg-white/20 rounded-full ${getHealthGlow(playerHp, playerMaxHp)}`} />
                  </div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>MP</span>
                  <span>{playerMp}/{playerMaxMp}</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-black/30 shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all"
                    style={{ width: `${(playerMp / playerMaxMp) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Gold & CS */}
            <div className="flex justify-between mt-3 text-sm">
              <div className="text-yellow-400 flex items-center gap-1">
                <span className="animate-pulse">💰</span> {playerGold}
              </div>
              <div className="text-white/60">CS: {playerCs}</div>
            </div>
          </div>

          {/* Abilities */}
          <div className="p-4 border-b border-white/10">
            <div className="text-white/60 text-sm mb-2 font-bold tracking-wider">ABILITIES</div>
            <div className="grid grid-cols-4 gap-2">
              {['q', 'w', 'e', 'r'].map((key, i) => (
                <div key={key} className="relative">
                  <div 
                    className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold transition-all ${
                      cooldowns[key as keyof typeof cooldowns] > 0 
                        ? 'bg-gray-700/50 text-gray-500' 
                        : 'bg-gradient-to-br from-purple-600 to-purple-800 text-white border border-purple-400/50 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/30'
                    } ${abilityWindup === key ? 'scale-90 ring-2 ring-purple-400' : ''}`}
                  >
                    {key.toUpperCase()}
                  </div>
                  {cooldowns[key as keyof typeof cooldowns] > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold bg-black/70 rounded-lg backdrop-blur-sm">
                      {Math.ceil(cooldowns[key as keyof typeof cooldowns])}
                    </div>
                  )}
                  {/* Ready indicator */}
                  {cooldowns[key as keyof typeof cooldowns] === 0 && (
                    <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-400 rounded-full shadow-lg shadow-green-400/50" />
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
            <div className="text-white/60 text-sm mb-2 font-bold tracking-wider">INVENTORY</div>
            <div className="grid grid-cols-3 gap-2">
              {inventory.map((item, i) => (
                <div 
                  key={i}
                  className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg transition-all ${
                    item 
                      ? 'bg-gradient-to-br from-gray-700 to-gray-800 border border-yellow-600/50 hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-500/20 cursor-pointer' 
                      : 'bg-gray-800/50 border border-white/10'
                  }`}
                  title={item?.name || 'Empty'}
                >
                  {item ? '⚔️' : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="text-white/60 text-sm mb-2 font-bold tracking-wider">SHOP</div>
            <div className="space-y-2">
              {ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => buyItem(item)}
                  disabled={playerGold < item.cost}
                  className={`w-full p-2.5 rounded-lg border text-left transition-all ${
                    playerGold >= item.cost
                      ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-yellow-600/30 hover:from-gray-700 hover:to-gray-800 hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/10'
                      : 'bg-gray-900/50 border-white/5 opacity-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-white text-sm font-medium">{item.name}</span>
                    <span className="text-yellow-400 text-sm font-bold">{item.cost}g</span>
                  </div>
                  <div className="text-white/40 text-xs mt-0.5">
                    {Object.entries(item.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="bg-[#0a0a15] p-2 border-t border-white/10 flex justify-center gap-6">
        <div className="text-white/40 text-sm flex items-center gap-4">
          <span><span className="text-white font-mono bg-black/30 px-2 py-0.5 rounded">WASD</span> Move</span>
          <span><span className="text-white font-mono bg-black/30 px-2 py-0.5 rounded">QWER</span> Abilities</span>
          <span><span className="text-white font-mono bg-black/30 px-2 py-0.5 rounded">Click</span> Move to location</span>
          <span><span className="text-white font-mono bg-black/30 px-2 py-0.5 rounded">Click Tower</span> Show range</span>
        </div>
      </div>
    </div>
  );
}
