// ============================================
// MATCHMAKING TYPES
// ============================================

import type { Role } from './champion.js';
import type { TeamSide } from './game.js';

// --- Queue ---
export interface QueueEntry {
  userId: string;
  username: string;
  championId: string;
  role: Role | 'fill';
  queueType: QueueType;
  mmr: number;
  joinedAt: number;
  status: 'searching' | 'drafting' | 'ready';
  timeoutAt?: number;
}

export type QueueType = 'ranked' | 'normal' | 'practice';

// --- Matchmaking ---
export interface MatchmakingTicket {
  id: string;
  queueType: QueueType;
  players: QueueEntry[];
  teamBlue: QueueEntry[];
  teamRed: QueueEntry[];
  status: 'forming' | 'drafting' | 'ready' | 'cancelled';
  createdAt: number;
  draft?: DraftState;
}

export interface DraftState {
  gameId: string;
  phase: DraftPhase;
  currentTeam: TeamSide;
  currentAction: DraftAction;
  bans: {
    blue: string[];
    red: string[];
  };
  picks: {
    blue: DraftPick[];
    red: DraftPick[];
  };
  timers: {
    actionStart: number;
    actionDuration: number;
  };
  completedActions: DraftActionLog[];
}

export type DraftPhase =
  | 'ban_start'
  | 'blue_ban_1'
  | 'red_ban_1'
  | 'blue_ban_2'
  | 'red_ban_2'
  | 'blue_ban_3'
  | 'red_ban_3'
  | 'pick_start'
  | 'blue_pick_1'
  | 'red_pick_1'
  | 'red_pick_2'
  | 'blue_pick_2'
  | 'blue_pick_3'
  | 'red_pick_3'
  | 'red_pick_4'
  | 'blue_pick_4'
  | 'blue_pick_5'
  | 'red_pick_5'
  | 'complete'
  | 'timeout';

export type DraftAction = 'ban' | 'pick' | 'complete';

export interface DraftPick {
  playerId: string;
  championId: string;
  role: Role | 'fill';
  pickedAt: number;
}

export interface DraftActionLog {
  phase: DraftPhase;
  team: TeamSide;
  action: 'ban' | 'pick';
  championId: string;
  playerId?: string;
  timestamp: number;
  forced?: boolean; // true if timeout caused random selection
}

// --- Match Result ---
export interface MatchResult {
  matchId: string;
  gameId: string;
  winner: TeamSide;
  duration: number;
  teams: {
    blue: TeamResult;
    red: TeamResult;
  };
  mmrChanges: Record<string, MMRChange>;
}

export interface TeamResult {
  players: PlayerResult[];
  totalMMR: number;
}

export interface PlayerResult {
  userId: string;
  championId: string;
  role: Role;
  kills: number;
  deaths: number;
  assists: number;
  grade: string;
}

// --- MMR ---
export interface MMRChange {
  userId: string;
  previousMMR: number;
  newMMR: number;
  change: number;
  lpChange: number;
  newRankLP: number;
  newRank: Rank;
  newDivision: number;
  rankChanged: boolean;
}

export type Rank =
  | 'UNRANKED'
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'DIAMOND'
  | 'MASTER'
  | 'GRANDMASTER'
  | 'CHALLENGER';

export const RANK_THRESHOLDS: Record<Rank, number> = {
  UNRANKED: 0,
  BRONZE: 1000,
  SILVER: 1150,
  GOLD: 1300,
  PLATINUM: 1500,
  DIAMOND: 1700,
  MASTER: 1900,
  GRANDMASTER: 2100,
  CHALLENGER: 2300,
};

// --- Events (Socket.IO) ---
export interface QueueJoinEvent {
  queueType: QueueType;
  championId: string;
  role: Role | 'fill';
}

export interface QueueJoinedEvent {
  ticketId: string;
  queueType: QueueType;
  position?: number;
  estimatedWait?: number;
}

export interface QueueMatchFoundEvent {
  ticketId: string;
  gameId: string;
  teamSide: TeamSide;
  draft: DraftState;
}

export interface QueueCancelledEvent {
  reason: 'manual' | 'timeout' | 'error';
}

export interface QueueUpdateEvent {
  position: number;
  totalInQueue: number;
  estimatedWait: number;
}

export interface DraftActionEvent {
  phase: DraftPhase;
  team: TeamSide;
  action: DraftAction;
  championId?: string;
  playerId?: string;
  timeRemaining: number;
}

export interface DraftCompleteEvent {
  gameId: string;
  blueTeam: { playerId: string; championId: string; role: Role }[];
  redTeam: { playerId: string; championId: string; role: Role }[];
  bans: { blue: string[]; red: string[] };
}

export interface DraftActionRequest {
  type: 'ban' | 'pick';
  championId: string;
}
