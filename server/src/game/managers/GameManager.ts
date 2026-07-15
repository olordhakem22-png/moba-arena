/**
 * GameManager - Orchestrates all active game instances
 */
import { v4 as uuid } from 'uuid';
import { GameEngine } from '../engine/GameEngine';
import { logger } from '../../utils/logger';
import type { TeamSide } from '../../../shared/src/types/game';

export class GameManager {
  private games: Map<string, GameEngine> = new Map();
  private playerGames: Map<string, string> = new Map(); // playerId -> gameId

  createGame(
    players: { userId: string; team: TeamSide; championId: string; slot: number }[],
    mode: 'classic' | 'ranked' | 'custom' = 'classic'
  ): GameEngine {
    const gameId = uuid();
    const game = new GameEngine(gameId, players);

    // Register players
    for (const player of players) {
      this.playerGames.set(player.userId, gameId);
    }

    this.games.set(gameId, game);

    game.on('stateUpdate', (state) => {
      // Broadcast to all players in game
    });

    game.on('gameEnded', async (result) => {
      await this.handleGameEnd(gameId, result);
    });

    logger.info(`🎮 Game created: ${gameId} with ${players.length} players (${mode})`);
    return game;
  }

  getGame(gameId: string): GameEngine | undefined {
    return this.games.get(gameId);
  }

  getGameByPlayer(playerId: string): GameEngine | undefined {
    const gameId = this.playerGames.get(playerId);
    return gameId ? this.games.get(gameId) : undefined;
  }

  getPlayerGameId(playerId: string): string | undefined {
    return this.playerGames.get(playerId);
  }

  removePlayer(playerId: string): void {
    const gameId = this.playerGames.get(playerId);
    if (gameId) {
      const game = this.games.get(gameId);
      if (game) {
        game.emit('playerDisconnected', playerId);
      }
    }
    this.playerGames.delete(playerId);
  }

  private async handleGameEnd(gameId: string, result: { winner: TeamSide; duration: number }): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    // Clean up after delay
    setTimeout(() => {
      this.games.delete(gameId);
      for (const [playerId, gId] of this.playerGames) {
        if (gId === gameId) {
          this.playerGames.delete(playerId);
        }
      }
      logger.info(`🗑️ Game ${gameId} cleaned up`);
    }, 60000); // Keep game data for 1 minute for post-game screen
  }

  getActiveGameCount(): number {
    return this.games.size;
  }

  getActivePlayerCount(): number {
    return this.playerGames.size;
  }

  // ==========================================
  // MATCHMAKING
  // ==========================================

  private queue: MatchmakingQueue = {
    blue: [],
    red: [],
    byRole: new Map(),
  };

  addToQueue(player: QueuePlayer): void {
    this.queue.blue.push(player);
    this.queue.byRole.set(player.userId, player);

    if (this.isQueueFull()) {
      this.startMatch();
    }
  }

  removeFromQueue(userId: string): void {
    this.queue.blue = this.queue.blue.filter(p => p.userId !== userId);
    this.queue.byRole.delete(userId);
  }

  private isQueueFull(): boolean {
    return this.queue.blue.length >= 5;
  }

  private startMatch(): void {
    const players = this.queue.blue.splice(0, 10);

    // Assign teams
    const gamePlayers = players.map((p, i) => ({
      userId: p.userId,
      team: (i < 5 ? 'blue' : 'red') as TeamSide,
      championId: p.championId || 'lux',
      slot: i % 5,
    }));

    const game = this.createGame(gamePlayers, 'ranked');
    game.start();

    // Notify players
    for (const player of gamePlayers) {
      this.notifyPlayerGameStart(player.userId, game.id);
    }
  }

  private notifyPlayerGameStart(_playerId: string, _gameId: string): void {
    // Emitted via Socket.IO
  }
}

interface QueuePlayer {
  userId: string;
  championId: string;
  role: string;
  mmr: number;
}

interface MatchmakingQueue {
  blue: QueuePlayer[];
  red: QueuePlayer[];
  byRole: Map<string, QueuePlayer>;
}

export const gameManager = new GameManager();
