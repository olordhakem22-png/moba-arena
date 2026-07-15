"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchmakingService = exports.MatchmakingService = void 0;
/**
 * Matchmaking System
 * Handles queue management, player matching, and game creation
 */
const uuid_1 = require("uuid");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const draft_1 = require("./draft");
const mmr_1 = require("./mmr");
// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    QUEUE_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
    MMR_TOLERANCE: 500, // ±500 MMR for matching
    TEAM_SIZE: 5,
    DRAFT_TIMEOUT_MS: 30 * 1000, // 30 seconds per action
    MIN_MMR: 500,
    MAX_MMR: 3000,
};
// ==========================================
// MATCHMAKING SERVICE
// ==========================================
class MatchmakingService {
    queues = new Map([
        ['ranked', new Map()],
        ['normal', new Map()],
        ['practice', new Map()],
    ]);
    tickets = new Map();
    draftManagers = new Map();
    timeoutTimers = new Map();
    io = null;
    constructor() {
        // Initialize queues
        for (const queueType of ['ranked', 'normal', 'practice']) {
            this.queues.set(queueType, new Map());
        }
    }
    /**
     * Set Socket.IO instance for broadcasting
     */
    setIO(io) {
        this.io = io;
    }
    /**
     * Add player to matchmaking queue
     */
    async addToQueue(socket, data) {
        const userId = socket.user?.userId;
        const username = socket.user?.username;
        if (!userId) {
            return { success: false, error: 'Not authenticated' };
        }
        // Check if already in queue
        for (const [queueType, queue] of this.queues) {
            if (queue.has(userId)) {
                return { success: false, error: 'Already in queue' };
            }
        }
        // Get user MMR from database
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { mmr: true, rank: true },
        });
        if (!user) {
            return { success: false, error: 'User not found' };
        }
        // Create queue entry
        const entry = {
            userId,
            username,
            championId: data.championId,
            role: data.role,
            queueType: data.queueType,
            mmr: user.mmr,
            joinedAt: Date.now(),
            status: 'searching',
            timeoutAt: Date.now() + CONFIG.QUEUE_TIMEOUT_MS,
        };
        // Add to queue
        this.queues.get(data.queueType).set(userId, entry);
        // Set timeout timer
        const timeoutTimer = setTimeout(() => {
            this.removeFromQueue(userId, data.queueType, 'timeout');
            socket.emit('queue:cancelled', { reason: 'timeout' });
        }, CONFIG.QUEUE_TIMEOUT_MS);
        this.timeoutTimers.set(userId, timeoutTimer);
        // Create ticket
        const ticketId = (0, uuid_1.v4)();
        const ticket = {
            id: ticketId,
            queueType: data.queueType,
            players: [entry],
            teamBlue: [],
            teamRed: [],
            status: 'forming',
            createdAt: Date.now(),
        };
        this.tickets.set(ticketId, ticket);
        // Join socket room
        socket.join('matchmaking');
        socket.join(`ticket:${ticketId}`);
        socket.data.ticketId = ticketId;
        socket.data.queueType = data.queueType;
        // Notify client
        socket.emit('queue:joined', {
            ticketId,
            queueType: data.queueType,
            position: this.getQueuePosition(data.queueType),
            estimatedWait: this.estimateWaitTime(data.queueType, user.mmr),
        });
        logger_1.logger.info(`📥 Player ${username} joined ${data.queueType} queue (MMR: ${user.mmr})`);
        // Try to find match
        this.processQueue(data.queueType);
        return { success: true, ticketId };
    }
    /**
     * Remove player from queue
     */
    removeFromQueue(userId, queueType, reason = 'manual') {
        const queue = this.queues.get(queueType);
        if (!queue)
            return;
        const entry = queue.get(userId);
        if (!entry)
            return;
        queue.delete(userId);
        // Clear timeout
        const timer = this.timeoutTimers.get(userId);
        if (timer) {
            clearTimeout(timer);
            this.timeoutTimers.delete(userId);
        }
        // Clean up ticket
        for (const [ticketId, ticket] of this.tickets) {
            if (ticket.players.some(p => p.userId === userId)) {
                ticket.players = ticket.players.filter(p => p.userId !== userId);
                if (ticket.players.length === 0) {
                    this.tickets.delete(ticketId);
                }
                break;
            }
        }
        logger_1.logger.info(`📤 Player ${entry.username} left ${queueType} queue (reason: ${reason})`);
    }
    /**
     * Cancel queue for a specific socket
     */
    cancelQueue(socket) {
        const userId = socket.user?.userId;
        const queueType = socket.data.queueType;
        if (userId && queueType) {
            this.removeFromQueue(userId, queueType, 'manual');
            socket.emit('queue:cancelled', { reason: 'manual' });
            socket.leave('matchmaking');
        }
    }
    /**
     * Process queue to find matches
     */
    processQueue(queueType) {
        const queue = this.queues.get(queueType);
        if (!queue || queue.size < CONFIG.TEAM_SIZE)
            return;
        // Get all players sorted by join time
        const players = Array.from(queue.values())
            .filter(p => p.status === 'searching')
            .sort((a, b) => a.joinedAt - b.joinedAt);
        if (players.length < CONFIG.TEAM_SIZE * 2)
            return;
        // Find best match
        const match = this.findMatch(players, queueType);
        if (match) {
            this.createMatch(match, queueType);
        }
    }
    /**
     * Find optimal match based on MMR balance
     */
    findMatch(players, queueType) {
        if (players.length < CONFIG.TEAM_SIZE * 2)
            return null;
        // Group by role for better team composition
        const byRole = this.groupByRole(players);
        // Try to create balanced teams
        let bestMatch = null;
        let bestBalance = Infinity;
        // Shuffle and try multiple combinations
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        for (let attempt = 0; attempt < 10 && shuffled.length >= CONFIG.TEAM_SIZE * 2; attempt++) {
            const testMatch = this.attemptMatch(shuffled.slice(0, CONFIG.TEAM_SIZE * 2), queueType);
            if (testMatch) {
                const balance = this.calculateTeamBalance(testMatch);
                if (balance < bestBalance) {
                    bestBalance = balance;
                    bestMatch = testMatch;
                }
            }
        }
        return bestMatch;
    }
    /**
     * Attempt to create a balanced match
     */
    attemptMatch(players, queueType) {
        // Check MMR spread
        const mmrs = players.map(p => p.mmr);
        const maxMMR = Math.max(...mmrs);
        const minMMR = Math.min(...mmrs);
        if (maxMMR - minMMR > CONFIG.MMR_TOLERANCE * 2) {
            return null;
        }
        // Sort by MMR for more balanced team assignment
        const sorted = [...players].sort((a, b) => a.mmr - b.mmr);
        // Pick teams using snake draft (alternating for balance)
        const teamBlue = [];
        const teamRed = [];
        for (let i = 0; i < CONFIG.TEAM_SIZE; i++) {
            if (i % 2 === 0) {
                teamBlue.push(sorted[i]); // lowest MMR to blue
                teamRed.push(sorted[sorted.length - 1 - i]); // highest MMR to red
            }
            else {
                teamBlue.push(sorted[sorted.length - 1 - i]); // highest remaining to blue
                teamRed.push(sorted[i]); // lowest remaining to red
            }
        }
        // Verify team balance
        const blueMMR = teamBlue.reduce((sum, p) => sum + p.mmr, 0);
        const redMMR = teamRed.reduce((sum, p) => sum + p.mmr, 0);
        const balance = Math.abs(blueMMR - redMMR);
        if (balance > CONFIG.MMR_TOLERANCE * CONFIG.TEAM_SIZE) {
            return null;
        }
        return [...teamBlue, ...teamRed];
    }
    /**
     * Calculate team balance (lower is better)
     */
    calculateTeamBalance(players) {
        const teamBlue = players.slice(0, CONFIG.TEAM_SIZE);
        const teamRed = players.slice(CONFIG.TEAM_SIZE);
        const blueMMR = teamBlue.reduce((sum, p) => sum + p.mmr, 0);
        const redMMR = teamRed.reduce((sum, p) => sum + p.mmr, 0);
        return Math.abs(blueMMR - redMMR);
    }
    /**
     * Group players by role
     */
    groupByRole(players) {
        const groups = new Map();
        for (const player of players) {
            const role = player.role;
            if (!groups.has(role)) {
                groups.set(role, []);
            }
            groups.get(role).push(player);
        }
        return groups;
    }
    /**
     * Create a match from matched players
     */
    async createMatch(players, queueType) {
        const teamBlue = players.slice(0, CONFIG.TEAM_SIZE);
        const teamRed = players.slice(CONFIG.TEAM_SIZE, CONFIG.TEAM_SIZE * 2);
        // Remove players from queue
        for (const player of players) {
            this.removeFromQueue(player.userId, queueType);
        }
        // Create match in database
        const match = await database_1.prisma.match.create({
            data: {
                gameId: (0, uuid_1.v4)(),
                queueType,
                gameMode: queueType === 'ranked' ? 'ranked' : 'classic',
                status: 'DRAFTING',
            },
        });
        // Create ticket with teams
        const ticketId = (0, uuid_1.v4)();
        const ticket = {
            id: ticketId,
            queueType,
            players,
            teamBlue,
            teamRed,
            status: 'drafting',
            createdAt: Date.now(),
        };
        this.tickets.set(ticketId, ticket);
        // Create draft manager
        const draftManager = new draft_1.DraftManager(ticketId, match.id, {
            blueTeam: teamBlue,
            redTeam: teamRed,
        });
        this.draftManagers.set(ticketId, draftManager);
        // Notify all players
        for (const player of teamBlue) {
            this.notifyMatchFound(player, ticket, match.id, 'blue');
        }
        for (const player of teamRed) {
            this.notifyMatchFound(player, ticket, match.id, 'red');
        }
        logger_1.logger.info(`🎮 Match created: ${match.id} - Blue avg MMR: ${teamBlue.reduce((s, p) => s + p.mmr, 0) / 5}, Red avg MMR: ${teamRed.reduce((s, p) => s + p.mmr, 0) / 5}`);
        // Start draft
        draftManager.on('action', (data) => {
            this.broadcastDraftAction(ticketId, data);
        });
        draftManager.on('complete', async (draftState) => {
            await this.handleDraftComplete(ticketId, draftState);
        });
        draftManager.on('timeout', async (data) => {
            await this.handleDraftTimeout(ticketId, data);
        });
        draftManager.start();
    }
    /**
     * Notify player of match found
     */
    notifyMatchFound(player, ticket, gameId, teamSide) {
        if (!this.io)
            return;
        this.io.to(`user:${player.userId}`).emit('match:found', {
            ticketId: ticket.id,
            gameId,
            teamSide,
            draft: ticket.draft,
        });
        this.io.to(`user:${player.userId}`).emit('queue:matched', {
            ticketId: ticket.id,
            gameId,
            teamSide,
            draft: ticket.draft,
        });
        logger_1.logger.info(`📢 Match found for ${player.username} (${teamSide} team)`);
    }
    /**
     * Broadcast draft action to all players in match
     */
    broadcastDraftAction(ticketId, data) {
        if (!this.io)
            return;
        const ticket = this.tickets.get(ticketId);
        if (!ticket)
            return;
        // Notify all players in both teams
        for (const player of [...ticket.teamBlue, ...ticket.teamRed]) {
            this.io.to(`user:${player.userId}`).emit('draft:action', data);
        }
    }
    /**
     * Handle draft completion
     */
    async handleDraftComplete(ticketId, draftState) {
        const ticket = this.tickets.get(ticketId);
        const draftManager = this.draftManagers.get(ticketId);
        if (!ticket || !draftManager)
            return;
        // Update ticket status
        ticket.status = 'ready';
        ticket.draft = draftState;
        // Create game with final team compositions
        const gameId = draftState.gameId;
        // Notify all players that draft is complete
        for (const player of [...ticket.teamBlue, ...ticket.teamRed]) {
            if (this.io) {
                this.io.to(`user:${player.userId}`).emit('draft:complete', {
                    gameId,
                    blueTeam: draftState.blueTeam,
                    redTeam: draftState.redTeam,
                    bans: draftState.bans,
                });
                this.io.to(`user:${player.userId}`).emit('game:ready', {
                    gameId,
                });
            }
        }
        logger_1.logger.info(`✅ Draft complete for match ${gameId}`);
        // Clean up
        setTimeout(() => {
            this.draftManagers.delete(ticketId);
        }, 60000);
    }
    /**
     * Handle draft timeout - force random selection
     */
    async handleDraftTimeout(ticketId, data) {
        if (!this.io)
            return;
        const ticket = this.tickets.get(ticketId);
        if (!ticket)
            return;
        // Broadcast timeout event
        for (const player of [...ticket.teamBlue, ...ticket.teamRed]) {
            this.io.to(`user:${player.userId}`).emit('draft:timeout', data);
        }
    }
    /**
     * Handle draft action from player
     */
    handleDraftAction(ticketId, userId, action) {
        const draftManager = this.draftManagers.get(ticketId);
        if (!draftManager)
            return;
        draftManager.handleAction(userId, action);
    }
    /**
     * Get queue position
     */
    getQueuePosition(queueType) {
        const queue = this.queues.get(queueType);
        return queue?.size ?? 0;
    }
    /**
     * Estimate wait time based on queue and MMR
     */
    estimateWaitTime(queueType, mmr) {
        const queue = this.queues.get(queueType);
        if (!queue || queue.size < CONFIG.TEAM_SIZE * 2) {
            return 30; // 30 seconds if not enough players
        }
        // Check if there are players in similar MMR range
        const similarMMR = Array.from(queue.values()).filter(p => Math.abs(p.mmr - mmr) <= CONFIG.MMR_TOLERANCE);
        if (similarMMR.length >= CONFIG.TEAM_SIZE * 2) {
            return 10; // Quick match possible
        }
        return Math.max(30, (CONFIG.TEAM_SIZE * 2 - similarMMR.length) * 15);
    }
    /**
     * Get queue statistics
     */
    getQueueStats() {
        const stats = [];
        for (const [queueType, queue] of this.queues) {
            stats.push({ queueType, count: queue.size });
        }
        return stats;
    }
    /**
     * Get player's current ticket
     */
    getTicketForPlayer(userId) {
        for (const ticket of this.tickets.values()) {
            if (ticket.players.some(p => p.userId === userId)) {
                return ticket;
            }
        }
        return null;
    }
    /**
     * Cancel all queues (admin function)
     */
    cancelAllQueues() {
        for (const [userId, timer] of this.timeoutTimers) {
            clearTimeout(timer);
        }
        this.timeoutTimers.clear();
        for (const [queueType, queue] of this.queues) {
            for (const [userId, entry] of queue) {
                this.io?.to(`user:${userId}`).emit('queue:cancelled', { reason: 'manual' });
            }
            queue.clear();
        }
        this.tickets.clear();
        logger_1.logger.info('🧹 All queues cancelled');
    }
    /**
     * Process game result and update MMR
     */
    async processGameResult(gameId, winner, duration, playerStats) {
        const match = await database_1.prisma.match.findFirst({
            where: { gameId },
            include: { players: { include: { user: true } } },
        });
        if (!match || match.queueType !== 'ranked')
            return;
        // Calculate MMR changes
        const mmrChanges = await mmr_1.mmrCalculator.calculateMatchMMR(playerStats, winner, duration);
        // Update database
        for (const change of Object.values(mmrChanges)) {
            await database_1.prisma.user.update({
                where: { id: change.userId },
                data: {
                    mmr: change.newMMR,
                    rank: change.newRank,
                    rankLP: change.newRankLP,
                    rankDivision: change.newDivision,
                    wins: winner === 'blue' && match.players.find(p => p.userId === change.userId)?.team === 'blue'
                        ? { increment: 1 }
                        : winner === 'red' && match.players.find(p => p.userId === change.userId)?.team === 'red'
                            ? { increment: 1 }
                            : undefined,
                    losses: winner === 'blue' && match.players.find(p => p.userId === change.userId)?.team === 'red'
                        ? { increment: 1 }
                        : winner === 'red' && match.players.find(p => p.userId === change.userId)?.team === 'blue'
                            ? { increment: 1 }
                            : undefined,
                },
            });
        }
        // Update match with winner and duration
        await database_1.prisma.match.update({
            where: { id: match.id },
            data: {
                status: 'ENDED',
                winner,
                duration,
                endedAt: new Date(),
            },
        });
        logger_1.logger.info(`📊 MMR updated for match ${gameId}: Winner=${winner}`);
    }
}
exports.MatchmakingService = MatchmakingService;
exports.matchmakingService = new MatchmakingService();
//# sourceMappingURL=matchmaking.js.map