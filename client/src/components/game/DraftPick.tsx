import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSocketStore } from '../../stores/socketStore.js';
import { useAuthStore } from '../../stores/authStore.js';

// Champion data
export const CHAMPIONS = {
  ahri: { name: 'Ahri', icon: '🦊', roles: ['mid'] },
  garen: { name: 'Garen', icon: '⚔️', roles: ['top'] },
  jinx: { name: 'Jinx', icon: '💣', roles: ['adc'] },
  lux: { name: 'Lux', icon: '✨', roles: ['mid', 'support'] },
  yasuo: { name: 'Yasuo', icon: '🌪️', roles: ['mid', 'top'] },
  nasus: { name: 'Nasus', icon: '🐕', roles: ['top'] },
  thresh: { name: 'Thresh', icon: '👻', roles: ['support'] },
  leesin: { name: 'Lee Sin', icon: '🥋', roles: ['jungle'] },
} as const;

export type ChampionId = keyof typeof CHAMPIONS;
export type TeamSide = 'blue' | 'red';

// Draft types
export interface DraftState {
  phase: 'idle' | 'ban' | 'pick' | 'complete';
  currentTeam: TeamSide;
  turnNumber: number;
  blueBans: ChampionId[];
  redBans: ChampionId[];
  bluePicks: ChampionId[];
  redPicks: ChampionId[];
  timeRemaining: number;
  totalBanRounds: number;
  totalPickRounds: number;
}

export interface DraftPickProps {
  gameId?: string;
  onComplete?: (draftState: DraftState) => void;
}

// Timer duration per action (seconds)
const TURN_TIME = 30;

// Initial draft state
const initialDraftState: DraftState = {
  phase: 'idle',
  currentTeam: 'blue',
  turnNumber: 0,
  blueBans: [],
  redBans: [],
  bluePicks: [],
  redPicks: [],
  timeRemaining: TURN_TIME,
  totalBanRounds: 3,
  totalPickRounds: 5,
};

export default function DraftPick({ gameId, onComplete }: DraftPickProps) {
  const { socket, isConnected } = useSocketStore();
  const { user } = useAuthStore();
  
  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);
  const [isLocalMode, setIsLocalMode] = useState(!gameId);
  const [hoveredChampion, setHoveredChampion] = useState<ChampionId | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine available champions (not banned)
  const getAvailableChampions = useCallback((): ChampionId[] => {
    const banned = [...draftState.blueBans, ...draftState.redBans];
    return (Object.keys(CHAMPIONS) as ChampionId[]).filter(
      (id) => !banned.includes(id) && !draftState.bluePicks.includes(id) && !draftState.redPicks.includes(id)
    );
  }, [draftState.blueBans, draftState.redBans, draftState.bluePicks, draftState.redPicks]);

  // Get current action label
  const getActionLabel = () => {
    if (draftState.phase === 'ban') {
      return `${draftState.currentTeam === 'blue' ? 'Blue' : 'Red'} Team is Banning`;
    }
    if (draftState.phase === 'pick') {
      return `${draftState.currentTeam === 'blue' ? 'Blue' : 'Red'} Team is Picking`;
    }
    if (draftState.phase === 'complete') {
      return 'Draft Complete!';
    }
    return 'Waiting...';
  };

  // Handle ban action
  const handleBan = useCallback((championId: ChampionId) => {
    if (draftState.phase !== 'ban') return;
    
    setDraftState((prev) => {
      const newState = { ...prev };
      if (prev.currentTeam === 'blue') {
        newState.blueBans = [...prev.blueBans, championId];
      } else {
        newState.redBans = [...prev.redBans, championId];
      }
      
      // Check if ban phase is complete (3 rounds of 3 bans each = 6 total)
      const totalBans = newState.blueBans.length + newState.redBans.length;
      if (totalBans >= 6) {
        // Transition to pick phase
        newState.phase = 'pick';
        newState.currentTeam = 'blue';
        newState.turnNumber = 0;
        newState.timeRemaining = TURN_TIME;
      } else {
        // Next ban turn
        newState.currentTeam = prev.currentTeam === 'blue' ? 'red' : 'blue';
        newState.turnNumber = prev.turnNumber + 1;
        newState.timeRemaining = TURN_TIME;
      }
      
      return newState;
    });

    // Emit to server
    if (socket && isConnected) {
      socket.emit('draft:ban', { gameId, championId });
    }
  }, [draftState.phase, draftState.currentTeam, socket, isConnected, gameId]);

  // Handle pick action
  const handlePick = useCallback((championId: ChampionId) => {
    if (draftState.phase !== 'pick') return;
    
    setDraftState((prev) => {
      const newState = { ...prev };
      if (prev.currentTeam === 'blue') {
        newState.bluePicks = [...prev.bluePicks, championId];
      } else {
        newState.redPicks = [...prev.redPicks, championId];
      }
      
      // Check if pick phase is complete (5 rounds of 2 picks each = 10 total)
      const totalPicks = newState.bluePicks.length + newState.redPicks.length;
      if (totalPicks >= 10) {
        // Draft complete
        newState.phase = 'complete';
        newState.timeRemaining = 0;
        onComplete?.(newState);
      } else {
        // Next pick turn
        newState.currentTeam = prev.currentTeam === 'blue' ? 'red' : 'blue';
        newState.turnNumber = prev.turnNumber + 1;
        newState.timeRemaining = TURN_TIME;
      }
      
      return newState;
    });

    // Emit to server
    if (socket && isConnected) {
      socket.emit('draft:pick', { gameId, championId });
    }
  }, [draftState.phase, draftState.currentTeam, socket, isConnected, gameId, onComplete]);

  // Handle champion click
  const handleChampionClick = (championId: ChampionId) => {
    if (draftState.phase === 'ban') {
      handleBan(championId);
    } else if (draftState.phase === 'pick') {
      handlePick(championId);
    }
  };

  // Auto-select random on timeout
  const handleTimeout = useCallback(() => {
    const available = getAvailableChampions();
    if (available.length === 0) return;
    
    const randomChampion = available[Math.floor(Math.random() * available.length)];
    
    if (draftState.phase === 'ban') {
      handleBan(randomChampion);
    } else if (draftState.phase === 'pick') {
      handlePick(randomChampion);
    }
  }, [draftState.phase, getAvailableChampions, handleBan, handlePick]);

  // Timer effect
  useEffect(() => {
    if (draftState.phase === 'idle' || draftState.phase === 'complete') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setDraftState((prev) => {
        if (prev.timeRemaining <= 1) {
          return prev;
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [draftState.phase]);

  // Check for timeout
  useEffect(() => {
    if (draftState.timeRemaining === 0 && (draftState.phase === 'ban' || draftState.phase === 'pick')) {
      handleTimeout();
    }
  }, [draftState.timeRemaining, draftState.phase, handleTimeout]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('draft:start', (data: DraftState) => {
      setDraftState({ ...data, timeRemaining: TURN_TIME });
    });

    socket.on('draft:update', (data: DraftState) => {
      setDraftState({ ...data, timeRemaining: TURN_TIME });
    });

    socket.on('draft:complete', (data: DraftState) => {
      setDraftState({ ...data, phase: 'complete', timeRemaining: 0 });
      onComplete?.(data);
    });

    return () => {
      socket.off('draft:start');
      socket.off('draft:update');
      socket.off('draft:complete');
    };
  }, [socket, onComplete]);

  // Start local draft (for testing without server)
  const startLocalDraft = () => {
    setDraftState({
      ...initialDraftState,
      phase: 'ban',
      timeRemaining: TURN_TIME,
    });
  };

  // Check if champion is available
  const isChampionAvailable = (championId: ChampionId): boolean => {
    if (draftState.blueBans.includes(championId) || draftState.redBans.includes(championId)) {
      return false;
    }
    if (draftState.bluePicks.includes(championId) || draftState.redPicks.includes(championId)) {
      return false;
    }
    return true;
  };

  // Check if champion is banned
  const isChampionBanned = (championId: ChampionId): boolean => {
    return draftState.blueBans.includes(championId) || draftState.redBans.includes(championId);
  };

  // Check if champion is picked
  const getChampionStatus = (championId: ChampionId): 'available' | 'banned-blue' | 'banned-red' | 'picked-blue' | 'picked-red' => {
    if (draftState.blueBans.includes(championId)) return 'banned-blue';
    if (draftState.redBans.includes(championId)) return 'banned-red';
    if (draftState.bluePicks.includes(championId)) return 'picked-blue';
    if (draftState.redPicks.includes(championId)) return 'picked-red';
    return 'available';
  };

  // Get timer color based on time remaining
  const getTimerColor = () => {
    if (draftState.timeRemaining > 15) return 'text-white';
    if (draftState.timeRemaining > 5) return 'text-yellow-400';
    return 'text-red-500 animate-pulse';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e17] to-[#060a0f] flex flex-col">
      {/* Header */}
      <div className="bg-[#0d1117] border-b border-white/10 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="font-game text-2xl font-bold text-white">
            CHAMPION <span className="text-primary-400">SELECT</span>
          </h1>
          <div className="flex items-center gap-6">
            {/* Timer */}
            <div className={`text-4xl font-game font-bold ${getTimerColor()}`}>
              {Math.floor(draftState.timeRemaining / 60)}:{String(draftState.timeRemaining % 60).padStart(2, '0')}
            </div>
            {/* Phase indicator */}
            <div className="text-white/60 font-game">
              {draftState.phase === 'ban' && 'BAN PHASE'}
              {draftState.phase === 'pick' && 'PICK PHASE'}
              {draftState.phase === 'complete' && 'DRAFT COMPLETE'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col gap-6">
        {/* Action Banner */}
        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-white/10 text-center">
          <h2 className={`font-game text-2xl font-bold ${
            draftState.currentTeam === 'blue' ? 'text-blue-400' : 'text-red-400'
          }`}>
            {getActionLabel()}
          </h2>
          {draftState.phase === 'ban' && (
            <p className="text-white/50 mt-1">
              Click a champion to ban • {6 - draftState.blueBans.length - draftState.redBans.length} bans remaining
            </p>
          )}
          {draftState.phase === 'pick' && (
            <p className="text-white/50 mt-1">
              Click a champion to select • {10 - draftState.bluePicks.length - draftState.redPicks.length} picks remaining
            </p>
          )}
        </div>

        {/* Selected Teams */}
        <div className="grid grid-cols-2 gap-6">
          {/* Blue Team */}
          <div className={`rounded-xl p-4 border-2 ${draftState.currentTeam === 'blue' ? 'border-blue-500 bg-blue-500/10' : 'border-blue-500/30 bg-[#1e3a5f]/20'}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <h3 className="font-game text-xl text-blue-400 font-bold">BLUE TEAM</h3>
            </div>
            
            {/* Bans */}
            <div className="mb-4">
              <div className="text-white/40 text-xs mb-2 font-game">BANS</div>
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-14 h-14 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center"
                  >
                    {draftState.blueBans[i] ? (
                      <div className="text-2xl relative">
                        {CHAMPIONS[draftState.blueBans[i]].icon}
                        <div className="absolute -inset-1 border-2 border-red-500/50 rounded-lg"></div>
                      </div>
                    ) : (
                      <div className="text-white/20 text-xl">✕</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Picks */}
            <div>
              <div className="text-white/40 text-xs mb-2 font-game">PICKS</div>
              <div className="flex gap-2 flex-wrap">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-14 h-14 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center"
                  >
                    {draftState.bluePicks[i] ? (
                      <div className="text-2xl relative">
                        {CHAMPIONS[draftState.bluePicks[i]].icon}
                        <div className="absolute -inset-1 border-2 border-blue-500/50 rounded-lg"></div>
                      </div>
                    ) : (
                      <div className="text-white/20 text-xl">?</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Red Team */}
          <div className={`rounded-xl p-4 border-2 ${draftState.currentTeam === 'red' ? 'border-red-500 bg-red-500/10' : 'border-red-500/30 bg-[#5f1e1e]/20'}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <h3 className="font-game text-xl text-red-400 font-bold">RED TEAM</h3>
            </div>
            
            {/* Bans */}
            <div className="mb-4">
              <div className="text-white/40 text-xs mb-2 font-game">BANS</div>
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-14 h-14 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center"
                  >
                    {draftState.redBans[i] ? (
                      <div className="text-2xl relative">
                        {CHAMPIONS[draftState.redBans[i]].icon}
                        <div className="absolute -inset-1 border-2 border-red-500/50 rounded-lg"></div>
                      </div>
                    ) : (
                      <div className="text-white/20 text-xl">✕</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Picks */}
            <div>
              <div className="text-white/40 text-xs mb-2 font-game">PICKS</div>
              <div className="flex gap-2 flex-wrap">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-14 h-14 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center"
                  >
                    {draftState.redPicks[i] ? (
                      <div className="text-2xl relative">
                        {CHAMPIONS[draftState.redPicks[i]].icon}
                        <div className="absolute -inset-1 border-2 border-red-500/50 rounded-lg"></div>
                      </div>
                    ) : (
                      <div className="text-white/20 text-xl">?</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Champion Grid */}
        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-game text-xl text-white font-bold">CHAMPIONS</h3>
            <div className="text-white/40 text-sm">
              {getAvailableChampions().length} available
            </div>
          </div>
          
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {(Object.keys(CHAMPIONS) as ChampionId[]).map((championId) => {
              const champion = CHAMPIONS[championId];
              const status = getChampionStatus(championId);
              const isAvailable = status === 'available';
              const isHovered = hoveredChampion === championId;
              const canInteract = isAvailable && (draftState.phase === 'ban' || draftState.phase === 'pick');
              
              return (
                <div
                  key={championId}
                  className={`
                    relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200
                    ${isAvailable && canInteract ? 'hover:scale-105 hover:shadow-xl' : ''}
                    ${!isAvailable ? 'opacity-50' : ''}
                    ${draftState.phase === 'ban' && isAvailable ? 'ring-2 ring-red-500/0 hover:ring-red-500/50' : ''}
                    ${draftState.phase === 'pick' && isAvailable ? 'ring-2 ring-blue-500/0 hover:ring-blue-500/50' : ''}
                  `}
                  onClick={() => canInteract && handleChampionClick(championId)}
                  onMouseEnter={() => setHoveredChampion(championId)}
                  onMouseLeave={() => setHoveredChampion(null)}
                >
                  {/* Champion Portrait */}
                  <div className={`
                    aspect-[3/4] flex items-center justify-center text-4xl
                    bg-gradient-to-br from-[#2a2a3e] to-[#1a1a2e]
                    ${status === 'banned-blue' || status === 'banned-red' ? 'bg-gradient-to-br from-red-900/50 to-red-950/50' : ''}
                    ${status === 'picked-blue' ? 'bg-gradient-to-br from-blue-900/50 to-blue-950/50' : ''}
                    ${status === 'picked-red' ? 'bg-gradient-to-br from-red-900/50 to-red-950/50' : ''}
                  `}>
                    {champion.icon}
                    
                    {/* Status Overlay */}
                    {status === 'banned-blue' && (
                      <div className="absolute inset-0 bg-red-600/70 flex items-center justify-center">
                        <div className="text-2xl font-game font-bold text-white">BANNED</div>
                      </div>
                    )}
                    {status === 'banned-red' && (
                      <div className="absolute inset-0 bg-red-600/70 flex items-center justify-center">
                        <div className="text-2xl font-game font-bold text-white">BANNED</div>
                      </div>
                    )}
                    {status === 'picked-blue' && (
                      <div className="absolute inset-0 bg-blue-600/70 flex items-center justify-center">
                        <div className="text-2xl font-game font-bold text-white">BLUE</div>
                      </div>
                    )}
                    {status === 'picked-red' && (
                      <div className="absolute inset-0 bg-red-600/70 flex items-center justify-center">
                        <div className="text-2xl font-game font-bold text-white">RED</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Champion Name */}
                  <div className="bg-black/80 px-2 py-1 text-center">
                    <div className="text-white text-xs font-game truncate">{champion.name}</div>
                    <div className="text-white/40 text-[10px] truncate">
                      {champion.roles.join(', ')}
                    </div>
                  </div>
                  
                  {/* Hover Info */}
                  {isHovered && isAvailable && canInteract && (
                    <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/95 border border-white/20 rounded-lg whitespace-nowrap">
                      <div className="text-white font-game font-bold">{champion.name}</div>
                      <div className="text-white/60 text-xs">{champion.roles.join(', ')}</div>
                      <div className="text-primary-400 text-xs mt-1">
                        {draftState.phase === 'ban' ? 'Click to ban' : 'Click to pick'}
                      </div>
                      {/* Arrow */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-black/95"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Start Draft Button (for local mode) */}
        {isLocalMode && draftState.phase === 'idle' && (
          <div className="flex justify-center">
            <button
              onClick={startLocalDraft}
              className="btn-primary px-8 py-3 text-lg"
            >
              Start Draft
            </button>
          </div>
        )}

        {/* Complete Button */}
        {draftState.phase === 'complete' && (
          <div className="flex justify-center">
            <button
              onClick={() => onComplete?.(draftState)}
              className="btn-gold px-8 py-3 text-lg animate-pulse"
            >
              Start Game!
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-[#0d1117] border-t border-white/10 p-3">
        <div className="max-w-7xl mx-auto flex justify-between text-white/40 text-sm">
          <div>
            <span className="text-blue-400">Blue</span> bans on left, 
            <span className="text-red-400"> Red</span> bans on right
          </div>
          <div>
            {isConnected ? (
              <span className="text-green-400">● Connected</span>
            ) : (
              <span className="text-yellow-400">● Local Mode</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
