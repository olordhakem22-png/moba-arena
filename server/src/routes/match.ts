/**
 * Match Routes
 * Handles match history, MMR queries, and ranked stats
 */
import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { mmrCalculator } from '../game/mmr';
import type { AuthRequest } from '../middleware/auth';
import type { TeamSide } from '../../../shared/src/types/game';
import type { Role } from '../../../shared/src/types/champion';

export const matchRoutes = Router();

// ==========================================
// MATCH HISTORY
// ==========================================

/**
 * GET /api/matches
 * Get paginated match history
 */
matchRoutes.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { page = '1', limit = '20', queueType } = req.query;

    const where: any = {
      status: 'ENDED',
      players: { some: { userId: req.user!.userId } },
    };
    if (queueType) where.queueType = queueType;

    const matches = await prisma.match.findMany({
      where,
      include: {
        players: {
          where: { userId: req.user!.userId },
          select: {
            championId: true, 
            team: true, 
            role: true,
            kills: true, 
            deaths: true, 
            assists: true, 
            grade: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    });

    res.json({ 
      matches, 
      page: Number(page), 
      limit: Number(limit) 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/matches/history
 * Get user's match history with detailed stats
 */
matchRoutes.get('/history', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const players = await prisma.matchPlayer.findMany({
      where: { userId: req.user!.userId },
      include: {
        match: {
          select: {
            id: true, 
            gameMode: true, 
            queueType: true, 
            winner: true,
            createdAt: true, 
            duration: true, 
            status: true,
          },
        },
      },
      orderBy: { match: { createdAt: 'desc' } },
      take: 20,
    });

    const history = players.map(p => ({
      matchId: p.match.id,
      gameMode: p.match.gameMode,
      queueType: p.match.queueType,
      result: p.match.winner === p.team ? 'win' : p.match.winner === 'draw' ? 'draw' : 'loss',
      championId: p.championId,
      role: p.role,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      grade: p.grade,
      date: p.match.createdAt,
      duration: p.match.duration,
    }));

    res.json(history);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/matches/stats
 * Get aggregated match statistics
 */
matchRoutes.get('/stats', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const players = await prisma.matchPlayer.findMany({
      where: { userId: req.user!.userId },
      include: {
        match: {
          select: { winner: true, queueType: true },
        },
      },
    });

    const stats = {
      totalGames: players.length,
      wins: players.filter(p => p.match.winner === p.team).length,
      losses: players.filter(p => p.match.winner && p.match.winner !== p.team && p.match.winner !== 'draw').length,
      draws: players.filter(p => p.match.winner === 'draw').length,
      kills: players.reduce((sum, p) => sum + p.kills, 0),
      deaths: players.reduce((sum, p) => sum + p.deaths, 0),
      assists: players.reduce((sum, p) => sum + p.assists, 0),
      avgKills: 0,
      avgDeaths: 0,
      avgAssists: 0,
      winRate: 0,
      kda: 0,
      rankedGames: players.filter(p => p.match.queueType === 'ranked').length,
      normalGames: players.filter(p => p.match.queueType === 'normal').length,
    };

    if (stats.totalGames > 0) {
      stats.avgKills = Math.round((stats.kills / stats.totalGames) * 10) / 10;
      stats.avgDeaths = Math.round((stats.deaths / stats.totalGames) * 10) / 10;
      stats.avgAssists = Math.round((stats.assists / stats.totalGames) * 10) / 10;
      stats.winRate = Math.round((stats.wins / stats.totalGames) * 1000) / 10;
      
      const totalKDA = stats.kills + stats.assists;
      stats.kda = stats.deaths > 0 
        ? Math.round((totalKDA / stats.deaths) * 100) / 100
        : totalKDA > 0 ? 999 : 0;
    }

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// SINGLE MATCH
// ==========================================

/**
 * GET /api/matches/:id
 * Get detailed match information
 */
matchRoutes.get('/:id', async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true, rank: true },
            },
          },
        },
      },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/matches/:id/replay
 * Get match replay data
 */
matchRoutes.get('/:id/replay', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Verify user was in this match
    const wasPlayer = match.players.some(p => p.userId === req.user!.userId);
    if (!wasPlayer && req.user!.role === 'player') {
      return res.status(403).json({ error: 'Not authorized to view this replay' });
    }

    res.json({
      matchId: match.id,
      gameId: match.gameId,
      duration: match.duration,
      winner: match.winner,
      players: match.players.map(p => ({
        userId: p.userId,
        username: p.user.username,
        championId: p.championId,
        team: p.team,
        role: p.role,
        stats: {
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          damageDealt: p.damageDealt,
          damageTaken: p.damageTaken,
          healing: p.healing,
          cs: p.cs,
          visionScore: p.visionScore,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// RANKED / MMR
// ==========================================

/**
 * GET /api/matches/ranked
 * Get ranked match history
 */
matchRoutes.get('/ranked/history', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const players = await prisma.matchPlayer.findMany({
      where: { 
        userId: req.user!.userId,
        match: { queueType: 'ranked', status: 'ENDED' },
      },
      include: {
        match: {
          select: {
            id: true,
            winner: true,
            createdAt: true,
            duration: true,
          },
        },
      },
      orderBy: { match: { createdAt: 'desc' } },
      take: 50,
    });

    const history = players.map(p => ({
      matchId: p.match.id,
      result: p.match.winner === p.team ? 'win' : 'loss',
      championId: p.championId,
      role: p.role,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      grade: p.grade,
      date: p.match.createdAt,
      duration: p.match.duration,
    }));

    res.json(history);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/matches/ranked/stats
 * Get ranked-specific statistics
 */
matchRoutes.get('/ranked/stats', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        mmr: true,
        rank: true,
        rankLP: true,
        rankDivision: true,
        wins: true,
        losses: true,
        streakWins: true,
        streakLosses: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get ranked games
    const rankedGames = await prisma.matchPlayer.count({
      where: {
        userId: req.user!.userId,
        match: { queueType: 'ranked', status: 'ENDED' },
      },
    });

    // Get recent trend (last 10 games)
    const recentGames = await prisma.matchPlayer.findMany({
      where: {
        userId: req.user!.userId,
        match: { queueType: 'ranked', status: 'ENDED' },
      },
      include: { match: { select: { winner: true } } },
      orderBy: { match: { createdAt: 'desc' } },
      take: 10,
    });

    const recentResults = recentGames.map(p => 
      p.match.winner === p.team ? 'win' : 'loss'
    );

    // Calculate peak MMR (simplified - would need historical tracking)
    const peakMMR = user.mmr; // Would need separate tracking table

    res.json({
      current: {
        mmr: user.mmr,
        rank: user.rank,
        division: user.rankDivision || 1,
        lp: user.rankLP,
        lpProgress: (user.rankLP / 100) * 100,
      },
      stats: {
        rankedGames,
        rankedWins: user.wins,
        rankedLosses: user.losses,
        winRate: user.wins + user.losses > 0
          ? Math.round((user.wins / (user.wins + user.losses)) * 1000) / 10
          : 0,
        currentStreak: user.streakWins > 0 
          ? { type: 'win', count: user.streakWins }
          : user.streakLosses > 0 
            ? { type: 'loss', count: user.streakLosses }
            : null,
      },
      recent: {
        results: recentResults,
        trend: calculateTrend(recentResults),
      },
      peak: {
        mmr: peakMMR,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/matches/ranked/leaderboard
 * Get leaderboard for current rank
 */
matchRoutes.get('/ranked/leaderboard', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { rank, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (rank) {
      where.rank = rank;
    }

    const leaderboard = await prisma.user.findMany({
      where: {
        ...where,
        rank: { not: 'UNRANKED' },
        isBanned: false,
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        rank: true,
        rankLP: true,
        rankDivision: true,
        mmr: true,
        wins: true,
        losses: true,
      },
      orderBy: { mmr: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    });

    const ranked = leaderboard.map((user, index) => ({
      rank: (Number(page) - 1) * Number(limit) + index + 1,
      ...user,
      winRate: user.wins + user.losses > 0
        ? Math.round((user.wins / (user.wins + user.losses)) * 1000) / 10
        : 0,
    }));

    res.json({ leaderboard: ranked });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// MATCH RESULT REPORTING
// ==========================================

/**
 * POST /api/matches/:id/report
 * Report match result (called by game server)
 */
matchRoutes.post('/:id/report', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Only admins/game server can report results
    if (req.user!.role === 'player') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { winner, duration, playerStats } = req.body;

    if (!winner || !playerStats) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (match.status === 'ENDED') {
      return res.status(400).json({ error: 'Match already ended' });
    }

    // Process MMR changes for ranked matches
    if (match.queueType === 'ranked') {
      const { matchmakingService } = await import('../game/matchmaking');
      await matchmakingService.processGameResult(
        match.gameId!,
        winner as TeamSide,
        duration || 0,
        playerStats as { userId: string; kills: number; deaths: number; assists: number; championId: string; role: Role }[]
      );
    }

    // Update match record
    await prisma.match.update({
      where: { id: req.params.id },
      data: {
        status: 'ENDED',
        winner,
        duration: duration || 0,
        endedAt: new Date(),
      },
    });

    // Update player stats
    for (const stat of playerStats) {
      await prisma.matchPlayer.updateMany({
        where: {
          matchId: req.params.id,
          userId: stat.userId,
        },
        data: {
          kills: stat.kills,
          deaths: stat.deaths,
          assists: stat.assists,
          damageDealt: stat.damageDealt || 0,
          damageTaken: stat.damageTaken || 0,
          healing: stat.healing || 0,
          cs: stat.cs || 0,
          visionScore: stat.visionScore || 0,
          level: stat.level || 1,
          items: JSON.stringify(stat.items || []),
        },
      });

      // Update user totals
      await prisma.user.update({
        where: { id: stat.userId },
        data: {
          totalKills: { increment: stat.kills },
          totalDeaths: { increment: stat.deaths },
          totalAssists: { increment: stat.assists },
          lastRankedAt: match.queueType === 'ranked' ? new Date() : undefined,
        },
      });
    }

    res.json({ success: true, message: 'Match result reported' });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// CUSTOM GAMES
// ==========================================

/**
 * POST /api/matches/custom/create
 * Create a custom game lobby
 */
matchRoutes.post('/custom/create', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const match = await prisma.match.create({
      data: {
        hostId: req.user!.userId,
        gameMode: 'custom',
        queueType: 'custom',
        status: 'PENDING',
      },
    });
    res.status(201).json(match);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/matches/:id/join
 * Join a custom game
 */
matchRoutes.post('/:id/join', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const match = await prisma.match.findUnique({ where: { id: req.params.id } });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.status !== 'PENDING') return res.status(400).json({ error: 'Match already started' });

    const existing = await prisma.matchPlayer.count({ where: { matchId: req.params.id } });
    if (existing >= 10) return res.status(400).json({ error: 'Match is full' });

    const player = await prisma.matchPlayer.create({
      data: {
        matchId: req.params.id,
        userId: req.user!.userId,
        championId: req.body.championId || 'lux',
        team: existing < 5 ? 'blue' : 'red',
        role: req.body.role || 'mid',
        summonerSpells: JSON.stringify(req.body.summonerSpells || ['flash', 'ignite']),
        items: '[]',
      },
    });
    res.status(201).json(player);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/matches/:id/leave
 * Leave a custom game
 */
matchRoutes.post('/:id/leave', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.matchPlayer.deleteMany({
      where: {
        matchId: req.params.id,
        userId: req.user!.userId,
      },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/matches/custom/lobbies
 * Get available custom game lobbies
 */
matchRoutes.get('/custom/lobbies', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const lobbies = await prisma.match.findMany({
      where: { 
        queueType: 'custom',
        status: 'PENDING',
      },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json(lobbies);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function calculateTrend(results: string[]): 'improving' | 'declining' | 'stable' {
  if (results.length < 3) return 'stable';
  
  const recent = results.slice(0, 5);
  const wins = recent.filter(r => r === 'win').length;
  
  if (wins >= 4) return 'improving';
  if (wins <= 1) return 'declining';
  return 'stable';
}
