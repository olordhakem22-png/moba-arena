export interface Match {
  id: string;
  gameId?: string;
  gameMode: string;
  queueType: string;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  duration: number;
  map: string;
  status: MatchStatus;
  players: MatchPlayer[];
  teams: [MatchTeam, MatchTeam];
  events: MatchEvent[];
  winner: 'blue' | 'red' | 'draw';
}

export type MatchStatus = 'pending' | 'loading' | 'active' | 'ended' | 'cancelled';

export interface MatchPlayer {
  userId: string;
  username: string;
  avatar: string;
  team: 'blue' | 'red';
  championId: string;
  role: string;
  runePage: string;
  summonerSpells: [string, string];
  items: string[];
  stats: MatchPlayerStats;
  rank: string;
}

export interface MatchPlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  damageTaken: number;
  healing: number;
  cs: number;
  csPerMinute: number;
  visionScore: number;
  goldEarned: number;
  goldSpent: number;
  wardsPlaced: number;
  wardsDestroyed: number;
  kda: number;
  grade: string;
}

export interface MatchTeam {
  team: 'blue' | 'red';
  towers: number;
  inhibitors: number;
  dragons: number;
  barons: number;
  totalKills: number;
  totalGold: number;
  totalDamage: number;
}

export interface MatchEvent {
  timestamp: number;
  type: string;
  data: Record<string, unknown>;
}

export interface MatchSummary {
  id: string;
  gameMode: string;
  queueType: string;
  date: Date;
  duration: number;
  result: 'win' | 'loss' | 'draw';
  role: string;
  championId: string;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  grade: string;
}

// --- Replay ---
export interface Replay {
  id: string;
  matchId: string;
  duration: number;
  ticks: number;
  replayData: string; // compressed tick data
  startTime: Date;
  endTime: Date;
  map: string;
  players: { userId: string; username: string; championId: string; team: 'blue' | 'red' }[];
}

// --- Spectator ---
export interface SpectatorState {
  matchId: string;
  playerId?: string; // follow a specific player
  camera: { x: number; y: number; zoom: number };
  isPaused: boolean;
  pauseReason?: string;
  viewerCount: number;
}
