"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketIO = setupSocketIO;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../config/index");
const GameManager_1 = require("../game/managers/GameManager");
const logger_1 = require("../utils/logger");
function setupSocketIO(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        cors: index_1.config.cors,
        pingTimeout: 10000,
        pingInterval: 5000,
        transports: ['websocket', 'polling'],
    });
    // --- Authentication ---
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, index_1.config.jwt.accessSecret);
            socket.user = payload;
            next();
        }
        catch {
            next(new Error('Invalid token'));
        }
    });
    // --- Connection ---
    io.on('connection', (socket) => {
        logger_1.logger.info(`🔌 Player connected: ${socket.user.username} (${socket.id})`);
        // Join user's personal room
        socket.join(`user:${socket.user.userId}`);
        // --- LOBBY ---
        socket.on('lobby:join', () => {
            socket.join('lobby');
            socket.emit('lobby:joined', { message: 'Welcome to lobby' });
        });
        socket.on('lobby:leave', () => {
            socket.leave('lobby');
        });
        // --- MATCHMAKING ---
        socket.on('queue:join', (data) => {
            socket.join('matchmaking');
            socket.emit('queue:joined', { status: 'searching' });
            // DEBUG: Auto-create game for testing (in production, implement real matchmaking)
            setTimeout(() => {
                const players = [{
                        userId: socket.user.userId,
                        team: 'blue',
                        championId: data.championId,
                        slot: 1,
                    }];
                const game = GameManager_1.gameManager.createGame(players, data.queueType);
                const gameId = game.id;
                // Add bot opponent for non-ranked
                if (data.queueType !== 'ranked') {
                    // TODO: Add bot player
                }
                io.to('matchmaking').emit('queue:matched', { gameId });
            }, 3000); // Start game after 3 seconds
        });
        socket.on('queue:cancel', () => {
            GameManager_1.gameManager.removeFromQueue(socket.user.userId);
            socket.leave('matchmaking');
            socket.emit('queue:cancelled');
        });
        // --- GAME ---
        socket.on('game:join', (data) => {
            const game = GameManager_1.gameManager.getGame(data.gameId);
            if (!game) {
                socket.emit('game:error', { message: 'Game not found' });
                return;
            }
            socket.join(`game:${data.gameId}`);
            socket.join(`game:${data.gameId}:${socket.user.userId}`);
            socket.emit('game:joined', {
                gameId: data.gameId,
                phase: game.state.phase,
                entities: Object.keys(game.state.entities),
            });
        });
        socket.on('game:ready', () => {
            socket.emit('game:loading');
        });
        // Player input
        socket.on('game:input', (data) => {
            const game = GameManager_1.gameManager.getGameByPlayer(socket.user.userId);
            if (!game)
                return;
            game.emit('playerInput', {
                playerId: socket.user.userId,
                input: data,
                timestamp: Date.now(),
            });
            handlePlayerInput(game, socket.user.userId, data);
        });
        // Chat
        socket.on('game:chat', (data) => {
            const gameId = GameManager_1.gameManager.getPlayerGameId(socket.user.userId);
            if (!gameId)
                return;
            io.to(`game:${gameId}`).emit('game:chat', {
                senderId: socket.user.userId,
                senderName: socket.user.username,
                message: data.message,
                timestamp: Date.now(),
            });
        });
        socket.on('game:ping', (data) => {
            const gameId = GameManager_1.gameManager.getPlayerGameId(socket.user.userId);
            if (!gameId)
                return;
            socket.to(`game:${gameId}`).emit('game:ping', {
                entityId: socket.user.userId,
                ...data,
            });
        });
        socket.on('game:emote', (data) => {
            const gameId = GameManager_1.gameManager.getPlayerGameId(socket.user.userId);
            if (!gameId)
                return;
            io.to(`game:${gameId}`).emit('game:emote', {
                entityId: socket.user.userId,
                emoteId: data.emoteId,
            });
        });
        // Surrender
        socket.on('game:surrender', () => {
            const game = GameManager_1.gameManager.getGameByPlayer(socket.user.userId);
            if (!game)
                return;
            game.initiateSurrenderVote(socket.user.userId);
        });
        socket.on('game:surrenderVote', (data) => {
            const game = GameManager_1.gameManager.getGameByPlayer(socket.user.userId);
            if (!game)
                return;
            game.voteSurrender(socket.user.userId, data.vote);
        });
        // --- SPECTATOR ---
        socket.on('spectate:join', (data) => {
            socket.join(`spectate:${data.matchId}`);
            socket.emit('spectate:joined', { matchId: data.matchId });
        });
        socket.on('spectate:camera', (data) => {
            const gameId = GameManager_1.gameManager.getPlayerGameId(socket.user.userId);
            if (!gameId)
                return;
            socket.to(`spectate:${gameId}`).emit('spectate:camera', {
                viewerId: socket.user.userId,
                ...data,
            });
        });
        // --- FRIENDS ---
        socket.on('friends:status', (data) => {
            socket.broadcast.emit('friends:statusChange', {
                userId: socket.user.userId,
                status: data.status,
            });
        });
        // --- DISCONNECT ---
        socket.on('disconnect', () => {
            logger_1.logger.info(`🔌 Player disconnected: ${socket.user.username}`);
            GameManager_1.gameManager.removePlayer(socket.user.userId);
        });
    });
    // --- GAME STATE BROADCASTING ---
    // Game engines emit state updates, we broadcast to relevant rooms
    setupGameBroadcasting(io);
    return io;
}
// ==========================================
// INPUT HANDLING
// ==========================================
function handlePlayerInput(game, playerId, input) {
    switch (input.type) {
        case 'move':
            game.moveOrder(playerId, { x: input.data.targetX, y: input.data.targetY });
            break;
        case 'attack':
            if (input.data.targetId) {
                game.attackOrder(playerId, input.data.targetId);
            }
            break;
        case 'ability':
            game.useAbility(playerId, {
                casterId: playerId,
                abilityKey: input.data.ability,
                level: input.data.level || 1,
                targetId: input.data.targetId,
                targetPosition: input.data.targetX
                    ? { x: input.data.targetX, y: input.data.targetY }
                    : undefined,
            });
            break;
        case 'recall':
            game.startRecall(playerId);
            break;
        case 'stop':
            game.stopOrder(playerId);
            break;
        case 'ping':
            game.ping(playerId, { x: input.data.x, y: input.data.y }, input.data.pingType, input.data.targetId);
            break;
    }
}
function setupGameBroadcasting(io) {
    // This would integrate with the game manager's event system
    // to broadcast state updates to all players in a game
}
//# sourceMappingURL=index.js.map