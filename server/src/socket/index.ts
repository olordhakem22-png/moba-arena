/**
 * Socket.IO - Real-time game communication
 */
import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index';
import { gameManager } from '../game/managers/GameManager';
import { logger } from '../utils/logger';
import type { TokenPayload } from '../../../shared/src/types/user';
import type { PlayerInput, Vector2 } from '../../../shared/src/types/game';

export function setupSocketIO(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: config.cors,
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
      const payload = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // --- Connection ---
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`🔌 Player connected: ${socket.user.username} (${socket.id})`);

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
    socket.on('queue:join', (data: { queueType: string; role: string; championId: string }) => {
      gameManager.removeFromQueue(socket.user.userId);
      socket.join('matchmaking');
      socket.emit('queue:joined', { status: 'searching' });
    });

    socket.on('queue:cancel', () => {
      gameManager.removeFromQueue(socket.user.userId);
      socket.leave('matchmaking');
      socket.emit('queue:cancelled');
    });

    // --- GAME ---
    socket.on('game:join', (data: { gameId: string }) => {
      const game = gameManager.getGame(data.gameId);
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
    socket.on('game:input', (data: InputPacket) => {
      const game = gameManager.getGameByPlayer(socket.user.userId);
      if (!game) return;

      game.emit('playerInput', {
        playerId: socket.user.userId,
        input: data,
        timestamp: Date.now(),
      });

      handlePlayerInput(game, socket.user.userId, data);
    });

    // Chat
    socket.on('game:chat', (data: { message: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.user.userId);
      if (!gameId) return;

      io.to(`game:${gameId}`).emit('game:chat', {
        senderId: socket.user.userId,
        senderName: socket.user.username,
        message: data.message,
        timestamp: Date.now(),
      });
    });

    socket.on('game:ping', (data: { targetId: string; position: Vector2; type: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.user.userId);
      if (!gameId) return;

      socket.to(`game:${gameId}`).emit('game:ping', {
        entityId: socket.user.userId,
        ...data,
      });
    });

    socket.on('game:emote', (data: { emoteId: string }) => {
      const gameId = gameManager.getPlayerGameId(socket.user.userId);
      if (!gameId) return;

      io.to(`game:${gameId}`).emit('game:emote', {
        entityId: socket.user.userId,
        emoteId: data.emoteId,
      });
    });

    // Surrender
    socket.on('game:surrender', () => {
      const game = gameManager.getGameByPlayer(socket.user.userId);
      if (!game) return;
      game.initiateSurrenderVote(socket.user.userId);
    });

    socket.on('game:surrenderVote', (data: { vote: boolean }) => {
      const game = gameManager.getGameByPlayer(socket.user.userId);
      if (!game) return;
      game.voteSurrender(socket.user.userId, data.vote);
    });

    // --- SPECTATOR ---
    socket.on('spectate:join', (data: { matchId: string }) => {
      socket.join(`spectate:${data.matchId}`);
      socket.emit('spectate:joined', { matchId: data.matchId });
    });

    socket.on('spectate:camera', (data: { x: number; y: number; zoom: number }) => {
      const gameId = gameManager.getPlayerGameId(socket.user.userId);
      if (!gameId) return;
      socket.to(`spectate:${gameId}`).emit('spectate:camera', {
        viewerId: socket.user.userId,
        ...data,
      });
    });

    // --- FRIENDS ---
    socket.on('friends:status', (data: { status: string }) => {
      socket.broadcast.emit('friends:statusChange', {
        userId: socket.user.userId,
        status: data.status,
      });
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
      logger.info(`🔌 Player disconnected: ${socket.user.username}`);
      gameManager.removePlayer(socket.user.userId);
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

function handlePlayerInput(
  game: import('../game/engine/GameEngine').GameEngine,
  playerId: string,
  input: InputPacket
): void {
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
      game.ping(
        playerId,
        { x: input.data.x, y: input.data.y },
        input.data.pingType,
        input.data.targetId
      );
      break;
  }
}

function setupGameBroadcasting(io: Server) {
  // This would integrate with the game manager's event system
  // to broadcast state updates to all players in a game
}

// ==========================================
// TYPES
// ==========================================

interface AuthenticatedSocket extends Socket {
  user: TokenPayload;
}

interface InputPacket {
  type: 'move' | 'attack' | 'ability' | 'recall' | 'stop' | 'ping' | 'emote';
  data: Record<string, any>;
  timestamp: number;
}
