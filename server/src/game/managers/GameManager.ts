/**
 * GameManager - Orchestrates all active game instances
 */
import { v4 as uuid } from 'uuid';
import { GameEngine } from '../engine/GameEngine';
import { logger } from '../../utils/logger';
import type { TeamSide } from '@shared/types/game';

export class GameManager {
  private games: Map<string, GameEngine> = new Map();
  private playerGames: Map<string, string> = new Map(); // playerId -> gameId
  private disconnectedPlayers: Set<string> = new Set();

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

    // Clean up when game ends
    game.on('gameDestroyed', (id: string) => {
      this.games.delete(id);
      logger.info(`🗑️ Game ${id} destroyed`);
    });

    // Set up state broadcasting
    game.on('stateUpdate', (state) => {
      // Broadcast to all players in game
      // This is handled by the socket layer
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
        this.disconnectedPlayers.add(playerId);
      }
    }
    this.playerGames.delete(playerId);
  }

  markPlayerDisconnected(playerId: string): void {
    this.disconnectedPlayers.add(playerId);
    const gameId = this.playerGames.get(playerId);
    if (gameId) {
      const game = this.games.get(gameId);
      if (game) {
        game.emit('playerDisconnected', playerId);
        
        // In a full implementation, AI would take over for this player
        // For now, just mark as disconnected
        logger.info(`Player ${playerId} marked as disconnected`);
      }
    }
  }

  reconnectPlayer(playerId: string, socketId: string): boolean {
    if (!this.disconnectedPlayers.has(playerId)) {
      return false;
    }

    const gameId = this.playerGames.get(playerId);
    if (!gameId) {
      return false;
    }

    const game = this.games.get(gameId);
    if (!game) {
      return false;
    }

    this.disconnectedPlayers.delete(playerId);
    game.emit('playerReconnected', { playerId, socketId });
    logger.info(`Player ${playerId} reconnected`);
    return true;
  }

  private async handleGameEnd(gameId: string, result: { winner: TeamSide; duration: number }): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    // Store game result for post-game screen
    const gameResult = {
      id: gameId,
      winner: result.winner,
      duration: result.duration,
      state: game.getSnapshot(),
    };

    logger.info(`Game ${gameId} ended: ${result.winner} wins in ${result.duration.toFixed(0)}s`);

    // Clean up after delay for post-game screen
    setTimeout(() => {
      this.cleanupGame(gameId);
    }, 60000);
  }

  private cleanupGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    // Remove all players from mapping
    for (const [playerId, gId] of this.playerGames) {
      if (gId === gameId) {
        this.playerGames.delete(playerId);
        this.disconnectedPlayers.delete(playerId);
      }
    }

    // Destroy game
    game.destroy();
    this.games.delete(gameId);

    logger.info(`🗑️ Game ${gameId} cleaned up`);
  }

  getActiveGameCount(): number {
    return this.games.size;
  }

  getActivePlayerCount(): number {
    return this.playerGames.size;
  }

  getGameList(): { id: string; playerCount: number; phase: string; time: number }[] {
    const list: { id: string; playerCount: number; phase: string; time: number }[] = [];
    
    for (const [id, game] of this.games) {
      list.push({
        id,
        playerCount: Object.keys(game.state.entities).filter(
          e => game.state.entities[e]?.type === 'champion'
        ).length,
        phase: game.state.phase,
        time: game.state.time,
      });
    }
    
    return list;
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
    return this.queue.blue.length >= 2;
  }

  private startMatch(): void {
    const players = this.queue.blue.splice(0, 2);

    // Assign teams
    const gamePlayers = players.map((p, i) => ({
      userId: p.userId,
      team: (i < 1 ? 'blue' : 'red') as TeamSide,
      championId: p.championId || 'lux',
      slot: i,
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
