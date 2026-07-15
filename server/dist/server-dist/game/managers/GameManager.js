"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameManager = exports.GameManager = void 0;
/**
 * GameManager - Orchestrates all active game instances
 */
const uuid_1 = require("uuid");
const GameEngine_1 = require("../engine/GameEngine");
const logger_1 = require("../../utils/logger");
class GameManager {
    games = new Map();
    playerGames = new Map(); // playerId -> gameId
    createGame(players, mode = 'classic') {
        const gameId = (0, uuid_1.v4)();
        const game = new GameEngine_1.GameEngine(gameId, players);
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
        logger_1.logger.info(`🎮 Game created: ${gameId} with ${players.length} players (${mode})`);
        return game;
    }
    getGame(gameId) {
        return this.games.get(gameId);
    }
    getGameByPlayer(playerId) {
        const gameId = this.playerGames.get(playerId);
        return gameId ? this.games.get(gameId) : undefined;
    }
    getPlayerGameId(playerId) {
        return this.playerGames.get(playerId);
    }
    removePlayer(playerId) {
        const gameId = this.playerGames.get(playerId);
        if (gameId) {
            const game = this.games.get(gameId);
            if (game) {
                game.emit('playerDisconnected', playerId);
            }
        }
        this.playerGames.delete(playerId);
    }
    async handleGameEnd(gameId, result) {
        const game = this.games.get(gameId);
        if (!game)
            return;
        // Clean up after delay
        setTimeout(() => {
            this.games.delete(gameId);
            for (const [playerId, gId] of this.playerGames) {
                if (gId === gameId) {
                    this.playerGames.delete(playerId);
                }
            }
            logger_1.logger.info(`🗑️ Game ${gameId} cleaned up`);
        }, 60000); // Keep game data for 1 minute for post-game screen
    }
    getActiveGameCount() {
        return this.games.size;
    }
    getActivePlayerCount() {
        return this.playerGames.size;
    }
    // ==========================================
    // MATCHMAKING
    // ==========================================
    queue = {
        blue: [],
        red: [],
        byRole: new Map(),
    };
    addToQueue(player) {
        this.queue.blue.push(player);
        this.queue.byRole.set(player.userId, player);
        if (this.isQueueFull()) {
            this.startMatch();
        }
    }
    removeFromQueue(userId) {
        this.queue.blue = this.queue.blue.filter(p => p.userId !== userId);
        this.queue.byRole.delete(userId);
    }
    isQueueFull() {
        return this.queue.blue.length >= 5;
    }
    startMatch() {
        const players = this.queue.blue.splice(0, 10);
        // Assign teams
        const gamePlayers = players.map((p, i) => ({
            userId: p.userId,
            team: (i < 5 ? 'blue' : 'red'),
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
    notifyPlayerGameStart(_playerId, _gameId) {
        // Emitted via Socket.IO
    }
}
exports.GameManager = GameManager;
exports.gameManager = new GameManager();
//# sourceMappingURL=GameManager.js.map