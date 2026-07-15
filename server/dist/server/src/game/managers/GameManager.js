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
    disconnectedPlayers = new Set();
    createGame(players, mode = 'classic') {
        const gameId = (0, uuid_1.v4)();
        const game = new GameEngine_1.GameEngine(gameId, players);
        // Register players
        for (const player of players) {
            this.playerGames.set(player.userId, gameId);
        }
        this.games.set(gameId, game);
        // Clean up when game ends
        game.on('gameDestroyed', (id) => {
            this.games.delete(id);
            logger_1.logger.info(`🗑️ Game ${id} destroyed`);
        });
        // Set up state broadcasting
        game.on('stateUpdate', (state) => {
            // Broadcast to all players in game
            // This is handled by the socket layer
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
                this.disconnectedPlayers.add(playerId);
            }
        }
        this.playerGames.delete(playerId);
    }
    markPlayerDisconnected(playerId) {
        this.disconnectedPlayers.add(playerId);
        const gameId = this.playerGames.get(playerId);
        if (gameId) {
            const game = this.games.get(gameId);
            if (game) {
                game.emit('playerDisconnected', playerId);
                // In a full implementation, AI would take over for this player
                // For now, just mark as disconnected
                logger_1.logger.info(`Player ${playerId} marked as disconnected`);
            }
        }
    }
    reconnectPlayer(playerId, socketId) {
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
        logger_1.logger.info(`Player ${playerId} reconnected`);
        return true;
    }
    async handleGameEnd(gameId, result) {
        const game = this.games.get(gameId);
        if (!game)
            return;
        // Store game result for post-game screen
        const gameResult = {
            id: gameId,
            winner: result.winner,
            duration: result.duration,
            state: game.getSnapshot(),
        };
        logger_1.logger.info(`Game ${gameId} ended: ${result.winner} wins in ${result.duration.toFixed(0)}s`);
        // Clean up after delay for post-game screen
        setTimeout(() => {
            this.cleanupGame(gameId);
        }, 60000);
    }
    cleanupGame(gameId) {
        const game = this.games.get(gameId);
        if (!game)
            return;
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
        logger_1.logger.info(`🗑️ Game ${gameId} cleaned up`);
    }
    getActiveGameCount() {
        return this.games.size;
    }
    getActivePlayerCount() {
        return this.playerGames.size;
    }
    getGameList() {
        const list = [];
        for (const [id, game] of this.games) {
            list.push({
                id,
                playerCount: Object.keys(game.state.entities).filter(e => game.state.entities[e]?.type === 'champion').length,
                phase: game.state.phase,
                time: game.state.time,
            });
        }
        return list;
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
        return this.queue.blue.length >= 2;
    }
    startMatch() {
        const players = this.queue.blue.splice(0, 2);
        // Assign teams
        const gamePlayers = players.map((p, i) => ({
            userId: p.userId,
            team: (i < 1 ? 'blue' : 'red'),
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
    notifyPlayerGameStart(_playerId, _gameId) {
        // Emitted via Socket.IO
    }
}
exports.GameManager = GameManager;
exports.gameManager = new GameManager();
//# sourceMappingURL=GameManager.js.map