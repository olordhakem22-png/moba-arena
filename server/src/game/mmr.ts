/**
 * MMR (Matchmaking Rating) Calculator
 * Handles MMR calculations, rank progression, and LP gains
 * 
 * Based on Elo/Glicko rating system with modifications for team games
 */
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import type { MMRChange, Rank } from '@shared/types/matchmaking';
import type { Role } from '@shared/types/champion';
import type { TeamSide } from '@shared/types/game';

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  // Base MMR change per game
  BASE_MMR_CHANGE: 25,
  
  // MMR range for close matches
  MMR_RANGE_FOR_FULL_POINTS: 100,
  MMR_RANGE_FOR_HALF_POINTS: 200,
  
  // KDA modifier (small bonus/penalty based on performance)
  KDA_BONUS_MAX: 5,
  KDA_PENALTY_MAX: -5,
  
  // Streak multipliers
  WIN_STREAK_BONUS: 1.1,
  LOSS_STREAK_PENALTY: 1.1,
  
  // First game of the day bonus
  FIRST_GAME_BONUS: 5,
  
  // Rank thresholds (MMR values)
  RANK_THRESHOLDS: {
    UNRANKED: 0,
    BRONZE: 1000,
    SILVER: 1150,
    GOLD: 1300,
    PLATINUM: 1500,
    DIAMOND: 1700,
    MASTER: 1900,
    GRANDMASTER: 2100,
    CHALLENGER: 2300,
  } as Record<Rank, number>,
  
  // Division thresholds within rank (each division = 25 LP)
  DIVISION_SIZE: 25,
  DIVISIONS_PER_RANK: 4,
  
  // Max LP gain/loss per game
  MAX_LP_GAIN: 30,
  MIN_LP_GAIN: 10,
  
  // Minimum games before placement
  PLACEMENT_GAMES: 10,
  
  // New player MMR
  DEFAULT_NEW_PLAYER_MMR: 1000,
} as const;

// ==========================================
// MMR CALCULATOR
// ==========================================

export class MMRCalculator {
  /**
   * Calculate expected outcome based on MMR difference
   * Uses logistic function similar to Elo
   */
  calculateExpectedScore(playerMMR: number, opponentMMR: number): number {
    const K = 400; // Elo K-factor constant
    const exponent = (opponentMMR - playerMMR) / K;
    return 1 / (1 + Math.pow(10, exponent));
  }

  /**
   * Calculate MMR change for a single game
   */
  calculateMMRChange(
    playerMMR: number,
    teamAverageMMR: number,
    opponentAverageMMR: number,
    won: boolean,
    kdaModifier: number = 0,
    streakMultiplier: number = 1
  ): number {
    // Calculate expected outcome
    const expected = this.calculateExpectedScore(playerMMR, opponentAverageMMR);
    
    // Actual outcome (1 for win, 0 for loss)
    const actual = won ? 1 : 0;
    
    // Calculate base change
    let change = CONFIG.BASE_MMR_CHANGE * (actual - expected);
    
    // Apply KDA modifier (small adjustment based on performance)
    change += kdaModifier;
    
    // Apply streak multiplier
    change *= streakMultiplier;
    
    // Add first game of day bonus
    // TODO: Check if player played today
    
    // Round and return
    return Math.round(change);
  }

  /**
   * Calculate team balance multiplier
   * Teams with more balanced MMR get slightly higher gains
   */
  calculateTeamBalanceMultiplier(teamMMRSpread: number): number {
    if (teamMMRSpread <= 50) return 1.05;
    if (teamMMRSpread <= 100) return 1.0;
    if (teamMMRSpread <= 150) return 0.95;
    return 0.9;
  }

  /**
   * Calculate KDA modifier
   * Returns a value between -CONFIG.KDA_PENALTY_MAX and +CONFIG.KDA_BONUS_MAX
   */
  calculateKDAModifier(kills: number, deaths: number, assists: number): number {
    if (deaths === 0) {
      // Perfect game bonus
      return CONFIG.KDA_BONUS_MAX;
    }
    
    const kda = (kills + assists) / deaths;
    
    // Good performance (KDA > 3) = bonus
    if (kda >= 4) return CONFIG.KDA_BONUS_MAX;
    if (kda >= 3) return CONFIG.KDA_BONUS_MAX * 0.5;
    
    // Poor performance (KDA < 0.5) = penalty
    if (kda <= 0.3) return CONFIG.KDA_PENALTY_MAX;
    if (kda <= 0.5) return CONFIG.KDA_PENALTY_MAX * 0.5;
    
    return 0;
  }

  /**
   * Determine rank from MMR value
   */
  getRankFromMMR(mmr: number): Rank {
    const thresholds = CONFIG.RANK_THRESHOLDS;
    
    if (mmr >= thresholds.CHALLENGER) return 'CHALLENGER';
    if (mmr >= thresholds.GRANDMASTER) return 'GRANDMASTER';
    if (mmr >= thresholds.MASTER) return 'MASTER';
    if (mmr >= thresholds.DIAMOND) return 'DIAMOND';
    if (mmr >= thresholds.PLATINUM) return 'PLATINUM';
    if (mmr >= thresholds.GOLD) return 'GOLD';
    if (mmr >= thresholds.SILVER) return 'SILVER';
    if (mmr >= thresholds.BRONZE) return 'BRONZE';
    return 'UNRANKED';
  }

  /**
   * Calculate division from MMR within a rank
   * Returns 1-4 (1 = highest, 4 = lowest division)
   */
  getDivisionFromMMR(mmr: number, rank: Rank): number {
    if (rank === 'UNRANKED') return 4;
    
    const rankStart = CONFIG.RANK_THRESHOLDS[rank];
    const rankEnd = rank === 'CHALLENGER' 
      ? rankStart + 200 // Challenger has wider range
      : CONFIG.RANK_THRESHOLDS[getNextRank(rank)];
    
    const rankRange = rankEnd - rankStart;
    const position = mmr - rankStart;
    const divisionSize = rankRange / CONFIG.DIVISIONS_PER_RANK;
    
    const division = Math.floor(position / divisionSize) + 1;
    return Math.max(1, Math.min(CONFIG.DIVISIONS_PER_RANK, division));
  }

  /**
   * Calculate LP from MMR change
   */
  calculateLP(mmrChange: number, currentRank: Rank): number {
    // LP is roughly equivalent to MMR change
    let lp = Math.abs(mmrChange);
    
    // Cap at configured limits
    lp = Math.min(CONFIG.MAX_LP_GAIN, lp);
    lp = Math.max(CONFIG.MIN_LP_GAIN, lp);
    
    // Higher ranks get slightly more LP per MMR
    if (currentRank === 'DIAMOND' || currentRank === 'MASTER') {
      lp = Math.min(lp + 2, CONFIG.MAX_LP_GAIN);
    }
    
    return mmrChange >= 0 ? lp : -lp;
  }

  /**
   * Check if user can queue for ranked
   */
  async canPlayRanked(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        wins: true, 
        losses: true, 
        mmr: true, 
        isBanned: true,
        lastRankedAt: true,
      },
    });

    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    if (user.isBanned) {
      return { allowed: false, reason: 'Account is banned' };
    }

    // Must have completed placements or be above minimum MMR
    const totalGames = user.wins + user.losses;
    if (user.mmr < CONFIG.DEFAULT_NEW_PLAYER_MMR && totalGames < CONFIG.PLACEMENT_GAMES) {
      return { allowed: false, reason: 'Must complete placement games' };
    }

    // Check for ranked queue cooldown (if played recently)
    if (user.lastRankedAt) {
      const timeSinceLastGame = Date.now() - user.lastRankedAt.getTime();
      const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
      
      if (timeSinceLastGame < COOLDOWN_MS) {
        const remainingMinutes = Math.ceil((COOLDOWN_MS - timeSinceLastGame) / 60000);
        return { 
          allowed: false, 
          reason: `Ranked queue available in ${remainingMinutes} minutes` 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Get user's current ranking info
   */
  async getRankingInfo(userId: string): Promise<{
    rank: Rank;
    division: number;
    lp: number;
    mmr: number;
    tier: string;
    position: number;
  } | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { rank: true, rankDivision: true, rankLP: true, mmr: true },
    });

    if (!user) return null;

    const rank = user.rank as Rank;
    const division = user.rankDivision || this.getDivisionFromMMR(user.mmr, rank);
    const tier = getTierFromRank(rank);
    const position = this.calculatePositionInTier(user.mmr, rank);

    return {
      rank,
      division,
      lp: user.rankLP,
      mmr: user.mmr,
      tier,
      position,
    };
  }

  /**
   * Calculate position within tier (1 = top of tier, higher = lower position)
   */
  private calculatePositionInTier(mmr: number, rank: Rank): number {
    if (rank === 'UNRANKED') return 1000;
    
    const rankStart = CONFIG.RANK_THRESHOLDS[rank];
    const rankEnd = rank === 'CHALLENGER' 
      ? rankStart + 200 
      : CONFIG.RANK_THRESHOLDS[getNextRank(rank)];
    
    const percentage = (mmr - rankStart) / (rankEnd - rankStart);
    return Math.round(percentage * 1000);
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getNextRank(rank: Rank): Rank {
  const ranks: Rank[] = [
    'UNRANKED', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 
    'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'
  ];
  
  const currentIndex = ranks.indexOf(rank);
  if (currentIndex === -1 || currentIndex >= ranks.length - 1) {
    return 'CHALLENGER';
  }
  
  return ranks[currentIndex + 1];
}

function getTierFromRank(rank: Rank): string {
  const tiers: Record<Rank, string> = {
    UNRANKED: 'unranked',
    BRONZE: 'bronze',
    SILVER: 'silver',
    GOLD: 'gold',
    PLATINUM: 'platinum',
    DIAMOND: 'diamond',
    MASTER: 'master',
    GRANDMASTER: 'grandmaster',
    CHALLENGER: 'challenger',
  };
  
  return tiers[rank];
}

// ==========================================
// MMR CALCULATOR WRAPPER (for exported instance)
// ==========================================

export class MMRCaclulatorWrapper {
  private calculator: MMRCalculator;

  constructor() {
    this.calculator = new MMRCalculator();
  }

  /**
   * Calculate MMR changes for an entire match
   */
  async calculateMatchMMR(
    playerStats: { 
      userId: string; 
      kills: number; 
      deaths: number; 
      assists: number; 
      championId: string; 
      role: Role 
    }[],
    winner: TeamSide,
    duration: number
  ): Promise<Record<string, MMRChange>> {
    const changes: Record<string, MMRChange> = {};
    
    // Get all player MMRs
    const userIds = playerStats.map(p => p.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, mmr: true, wins: true, losses: true, rank: true, rankLP: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    // Calculate team averages
    const bluePlayers = playerStats.slice(0, 5);
    const redPlayers = playerStats.slice(5, 10);

    const blueAverageMMR = this.getAverageMMR(bluePlayers, userMap);
    const redAverageMMR = this.getAverageMMR(redPlayers, userMap);

    // Calculate changes for each player
    for (const player of playerStats) {
      const user = userMap.get(player.userId);
      if (!user) continue;

      const playerMMR = user.mmr;
      const isBlue = bluePlayers.some(p => p.userId === player.userId);
      const teamAverage = isBlue ? blueAverageMMR : redAverageMMR;
      const opponentAverage = isBlue ? redAverageMMR : blueAverageMMR;
      const won = (winner === 'blue' && isBlue) || (winner === 'red' && !isBlue);

      // Calculate KDA modifier
      const kdaModifier = this.calculator.calculateKDAModifier(
        player.kills,
        player.deaths,
        player.assists
      );

      // Get streak multiplier
      const streakMultiplier = await this.getStreakMultiplier(player.userId, won);

      // Calculate MMR change
      const mmrChange = this.calculator.calculateMMRChange(
        playerMMR,
        teamAverage,
        opponentAverage,
        won,
        kdaModifier,
        streakMultiplier
      );

      // Calculate new MMR
      const newMMR = Math.max(
        CONFIG.DEFAULT_NEW_PLAYER_MMR / 2,
        Math.min(CONFIG.RANK_THRESHOLDS.CHALLENGER + 200, playerMMR + mmrChange)
      );

      // Calculate rank changes
      const currentRank = user.rank as Rank;
      const newRank = this.calculator.getRankFromMMR(newMMR);
      const newDivision = this.calculator.getDivisionFromMMR(newMMR, newRank);
      const lpChange = this.calculator.calculateLP(mmrChange, currentRank);
      const newRankLP = Math.max(0, user.rankLP + lpChange);

      changes[player.userId] = {
        userId: player.userId,
        previousMMR: playerMMR,
        newMMR,
        change: mmrChange,
        lpChange,
        newRankLP,
        newRank,
        newDivision,
        rankChanged: currentRank !== newRank,
      };
    }

    logger.info(
      `📊 MMR calculated for ${playerStats.length} players - Winner: ${winner}`
    );

    return changes;
  }

  /**
   * Get average MMR for a team
   */
  private getAverageMMR(
    players: { userId: string }[],
    userMap: Map<string, any>
  ): number {
    let total = 0;
    let count = 0;

    for (const player of players) {
      const user = userMap.get(player.userId);
      if (user) {
        total += user.mmr;
        count++;
      }
    }

    return count > 0 ? total / count : CONFIG.DEFAULT_NEW_PLAYER_MMR;
  }

  /**
   * Get streak multiplier for win/loss bonus
   */
  private async getStreakMultiplier(userId: string, won: boolean): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { streakWins: true, streakLosses: true },
    });

    if (!user) return 1;

    if (won && user.streakWins >= 3) {
      return CONFIG.WIN_STREAK_BONUS;
    }
    if (!won && user.streakLosses >= 3) {
      return CONFIG.LOSS_STREAK_PENALTY;
    }

    return 1;
  }

  /**
   * Update streak after game
   */
  async updateStreak(userId: string, won: boolean): Promise<void> {
    if (won) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          streakWins: { increment: 1 },
          streakLosses: 0,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: {
          streakLosses: { increment: 1 },
          streakWins: 0,
        },
      });
    }
  }
}

export const mmrCalculator = new MMRCaclulatorWrapper();
