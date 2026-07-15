import type { MatchSummary } from './match.js';
import type { Role } from './champion.js';
export interface User {
    id: string;
    username: string;
    email: string;
    avatar: string;
    level: number;
    xp: number;
    rank: Rank;
    rankLP: number;
    wins: number;
    losses: number;
    createdAt: Date;
    lastSeen: Date;
    status: UserStatus;
    preferences: UserPreferences;
}
export type UserStatus = 'online' | 'in-game' | 'in-queue' | 'offline';
export interface UserPreferences {
    soundEnabled: boolean;
    musicEnabled: boolean;
    musicVolume: number;
    sfxVolume: number;
    showFPS: boolean;
    colorBlindMode: boolean;
    chatEnabled: boolean;
}
export interface UserProfile {
    user: User;
    championsOwned: string[];
    skinsOwned: string[];
    matchHistory: MatchSummary[];
    rankHistory: RankHistoryEntry[];
    stats: PlayerStats;
    friends: Friend[];
    recentActivity: ActivityEntry[];
}
export interface PlayerStats {
    totalGames: number;
    totalWins: number;
    totalLosses: number;
    winRate: number;
    kda: number;
    avgKills: number;
    avgDeaths: number;
    avgAssists: number;
    totalDamage: number;
    totalHealing: number;
    totalGold: number;
    mostPlayed: string[];
    bestRole: Role;
    mmr: number;
}
export interface RankHistoryEntry {
    date: Date;
    rank: Rank;
    lp: number;
    division: number;
}
export type Rank = 'Unranked' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master' | 'Grandmaster' | 'Challenger';
export interface Friend {
    id: string;
    username: string;
    avatar: string;
    status: UserStatus;
    rank: Rank;
    mutualGames: number;
    since: Date;
}
export interface ActivityEntry {
    type: 'match' | 'rank_up' | 'achievement' | 'purchase';
    date: Date;
    description: string;
    metadata?: Record<string, unknown>;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
}
export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
}
export interface TokenPayload {
    userId: string;
    username: string;
    role: UserRole;
    iat: number;
    exp: number;
}
export type UserRole = 'player' | 'moderator' | 'admin' | 'superadmin';
//# sourceMappingURL=user.d.ts.map