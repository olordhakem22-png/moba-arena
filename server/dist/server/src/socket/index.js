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
        const userId = socket.user.userId;
        logger_1.logger.info(`🔌 Player connected: ${socket.user.username} (${userId})`);
        // Join user's personal room
        socket.join(`user:${userId}`);
        // --- LOBBY ---
        socket.on('lobby:join', () => {
            socket.join('lobby');
            socket.emit('lobby:joined', { message: 'Welcome to lobby' });
            logger_1.logger.debug(`Player ${userId} joined lobby`);
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
                // Find players in queue or create with bots
                const players = [
                    {
                        userId,
                        team: 'blue',
                        championId: data.championId,
                        slot: 1,
                    }
                ];
                // Add bot opponents
                const botChampions = ['garen', 'lux', 'jinx', 'ahri', 'yasuo'];
                for (let i = 0; i < 4; i++) {
                    players.push({
                        userId: `bot-red-${i + 1}`,
                        team: 'red',
                        championId: botChampions[i],
                        slot: i + 2,
                    });
                }
                const game = GameManager_1.gameManager.createGame(players, data.queueType);
                const gameId = game.id;
                // Set up game event forwarding
                setupGameEventForwarding(io, game, gameId);
                io.to('matchmaking').emit('queue:matched', { gameId });
                logger_1.logger.info(`🎮 Match created: ${gameId}`);
            }, 2000);
        });
        socket.on('queue:cancel', () => {
            GameManager_1.gameManager.removeFromQueue(userId);
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
            socket.join(`game:${data.gameId}:${userId}`);
            // Set up game state forwarding for this socket
            game.on('stateUpdate', (state) => {
                socket.emit('game:state', state);
            });
            game.on('phaseChange', (data) => {
                socket.emit('game:phaseChange', data);
            });
            game.on('kill', (data) => {
                io.to(`game:${data.gameId}`).emit('game:kill', data);
            });
            game.on('abilityUsed', (data) => {
                socket.to(`game:${data.gameId}`).emit('game:ability', data);
            });
            game.on('damage', (data) => {
                socket.to(`game:${data.gameId}`).emit('game:damage', data);
            });
            game.on('levelUp', (data) => {
                io.to(`game:${data.gameId}`).emit('game:levelUp', data);
            });
            game.on('towerDestroyed', (data) => {
                io.to(`game:${data.gameId}`).emit('game:towerDestroyed', data);
            });
            game.on('gameEnded', (data) => {
                io.to(`game:${data.gameId}`).emit('game:ended', data);
            });
            game.on('ping', (data) => {
                socket.to(`game:${data.gameId}`).emit('game:ping', data);
            });
            socket.emit('game:joined', {
                gameId: data.gameId,
                phase: game.state.phase,
                time: game.state.time,
                entities: Object.keys(game.state.entities),
            });
            logger_1.logger.info(`Player ${userId} joined game ${data.gameId}`);
        });
        socket.on('game:ready', () => {
            const game = GameManager_1.gameManager.getGameByPlayer(userId);
            if (game) {
                game.emit('playerReady', userId);
            }
        });
        // Player input handling
        socket.on('game:input', (data) => {
            const game = GameManager_1.gameManager.getGameByPlayer(userId);
            if (!game)
                return;
            // Validate and process input
            handlePlayerInput(game, userId, data);
        });
        // Shop
        socket.on('game:buyItem', (data) => {
            const game = GameManager_1.gameManager.getGameByPlayer(userId);
            if (!game)
                return;
            const success = game.items.purchaseItem(userId, data.itemId);
            socket.emit('game:itemResult', { success, itemId: data.itemId, slot: data.slot });
        });
        socket.on('game:sellItem', (data) => {
            const game = GameManager_1.gameManager.getGameByPlayer(userId);
            if (!game)
                return;
            const success = game.items.sellItem(userId, data.slot);
            socket.emit('game:itemResult', { success, action: 'sell', slot: data.slot });
        });
        // Ability leveling
        socket.on('game:levelAbility', (data) => {
            const game = GameManager_1.gameManager.getGameByPlayer(userId);
            if (!game)
                return;
            game.levelUpAbility(userId, data.ability);
        });
        // Chat
        socket.on('game:chat', (data) => {
            const gameId = GameManager_1.gameManager.getPlayerGameId(userId);
            if (!gameId)
                return;
            // Sanitize message
            const sanitizedMessage = data.message.slice(0, 200);
            io.to(`game:${gameId}`).emit('game:chat', {
                senderId: userId,
                senderName: socket.user.username,
                message: sanitizedMessage,
                timestamp: Date.now(),
            });
        });
        // Pings
        socket.on('game:ping', (data) => {
            const gameId = GameManager_1.gameManager.getPlayerGameId(userId);
            if (!gameId)
                return;
            socket.to(`game:${gameId}`).emit('game:ping', {
                entityId: userId,
                x: data.x,
                y: data.y,
                type: data.type,
                targetId: data.targetId,
            });
        });
        // Emotes
        socket.on('game:emote', (data) => {
            const gameId = GameManager_1.gameManager.getPlayerGameId(userId);
            if (!gameId)
                return;
            io.to(`game:${gameId}`).emit('game:emote', {
                entityId: userId,
                emoteId: data.emoteId,
            });
        });
        // Surrender
        socket.on('game:surrender', () => {
            const game = GameManager_1.gameManager.getGameByPlayer(userId);
            if (!game)
                return;
            game.initiateSurrenderVote(userId);
        });
        socket.on('game:surrenderVote', (data) => {
            const game = GameManager_1.gameManager.getGameByPlayer(userId);
            if (!game)
                return;
            game.voteSurrender(userId, data.vote);
        });
        // Spectator
        socket.on('spectate:join', (data) => {
            socket.join(`spectate:${data.matchId}`);
            socket.emit('spectate:joined', { matchId: data.matchId });
            const game = GameManager_1.gameManager.getGame(data.matchId);
            if (game) {
                game.on('stateUpdate', (state) => {
                    socket.emit('game:state', state);
                });
            }
        });
        // --- DISCONNECT ---
        socket.on('disconnect', () => {
            logger_1.logger.info(`🔌 Player disconnected: ${socket.user.username}`);
            // Mark player as disconnected (AI takes over in real implementation)
            GameManager_1.gameManager.markPlayerDisconnected(userId);
        });
        // --- FRIENDS ---
        socket.on('friends:status', (data) => {
            socket.broadcast.emit('friends:statusChange', {
                userId,
                status: data.status,
            });
        });
    });
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
            game.ping(playerId, { x: input.data.x, y: input.data.y }, input.data.pingType || 'onMyWay', input.data.targetId);
            break;
        case 'levelAbility':
            game.levelUpAbility(playerId, input.data.ability);
            break;
    }
}
// ==========================================
// GAME EVENT FORWARDING
// ==========================================
function setupGameEventForwarding(io, game, gameId) {
    // Forward key game events to all players in the game room
    const forwardEvents = [
        'championSpawned',
        'minionWaveSpawned',
        'towerSpawned',
        'towerAttack',
        'towerDestroyed',
        'towerPlatingDestroyed',
        'objectiveKilled',
        'objectiveSpawned',
        'itemPurchased',
        'recallStarted',
        'recallCancelled',
        'entityRespawned',
        'heal',
        'shieldApplied',
        'ccApplied',
        'autoAttack',
        'minionAttack',
        'moveOrder',
        'attackOrder',
        'stopOrder',
        'surrenderVoteStarted',
        'surrenderVote',
        'surrenderVoteEnded',
        'abilityLevelUp',
        'abilityFailed',
        'playerReady',
        'playerDisconnected',
    ];
    for (const eventName of forwardEvents) {
        game.on(eventName, (data) => {
            io.to(`game:${gameId}`).emit(`game:${eventName}`, data);
        });
    }
    // Special handling for game events
    game.on('gameEvent', (event) => {
        io.to(`game:${gameId}`).emit('game:event', event);
    });
}
//# sourceMappingURL=index.js.map