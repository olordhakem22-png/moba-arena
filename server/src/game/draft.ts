/**
 * Draft Pick System
 * Handles champion selection phase with bans and picks
 * 
 * Draft Order:
 * - Blue bans: 3 (BB1, RB1, BB2, RB2, BB3, RB3)
 * - Blue picks: 1, 2 (BP1, RP1, RP2, BP2, BP3, RP3, RP4, BP4, BP5, RP5)
 */
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import type {
  DraftState,
  DraftPhase,
  DraftPick,
  DraftActionLog,
  QueueEntry,
} from '@shared/types/matchmaking';
import type { Role } from '@shared/types/champion';
import type { TeamSide } from '@shared/types/game';

// ==========================================
// DRAFT ORDER DEFINITION
// ==========================================

const DRAFT_SEQUENCE: DraftPhase[] = [
  'blue_ban_1',
  'red_ban_1',
  'blue_ban_2',
  'red_ban_2',
  'blue_ban_3',
  'red_ban_3',
  'blue_pick_1',
  'red_pick_1',
  'red_pick_2',
  'blue_pick_2',
  'blue_pick_3',
  'red_pick_3',
  'red_pick_4',
  'blue_pick_4',
  'blue_pick_5',
  'red_pick_5',
];

const PHASE_TO_ACTION: Record<DraftPhase, { type: 'ban' | 'pick' | 'complete'; team: TeamSide }> = {
  ban_start: { type: 'ban', team: 'blue' },
  blue_ban_1: { type: 'ban', team: 'blue' },
  red_ban_1: { type: 'ban', team: 'red' },
  blue_ban_2: { type: 'ban', team: 'blue' },
  red_ban_2: { type: 'ban', team: 'red' },
  blue_ban_3: { type: 'ban', team: 'blue' },
  red_ban_3: { type: 'ban', team: 'red' },
  pick_start: { type: 'pick', team: 'blue' },
  blue_pick_1: { type: 'pick', team: 'blue' },
  red_pick_1: { type: 'pick', team: 'red' },
  red_pick_2: { type: 'pick', team: 'red' },
  blue_pick_2: { type: 'pick', team: 'blue' },
  blue_pick_3: { type: 'pick', team: 'blue' },
  red_pick_3: { type: 'pick', team: 'red' },
  red_pick_4: { type: 'pick', team: 'red' },
  blue_pick_4: { type: 'pick', team: 'blue' },
  blue_pick_5: { type: 'pick', team: 'blue' },
  red_pick_5: { type: 'pick', team: 'red' },
  complete: { type: 'complete', team: 'blue' },
  timeout: { type: 'complete', team: 'blue' },
};

// ==========================================
// DRAFT MANAGER
// ==========================================

export class DraftManager extends EventEmitter {
  private ticketId: string;
  private gameId: string;
  private blueTeam: QueueEntry[];
  private redTeam: QueueEntry[];
  
  private currentPhaseIndex: number = 0;
  private state: DraftState;
  private phaseTimer: NodeJS.Timeout | null = null;
  private actionTimeout: number = 30000; // 30 seconds per action
  private pendingActions: Map<string, { type: 'ban' | 'pick'; championId: string }> = new Map();
  
  // Track which champions have been banned/picked
  private unavailableChampions: Set<string> = new Set();

  // Current acting player (for picks, any player can pick)
  private currentActor: string | null = null;

  constructor(
    ticketId: string,
    gameId: string,
    teams: { blueTeam: QueueEntry[]; redTeam: QueueEntry[] }
  ) {
    super();
    
    this.ticketId = ticketId;
    this.gameId = gameId;
    this.blueTeam = teams.blueTeam;
    this.redTeam = teams.redTeam;

    // Initialize draft state
    this.state = {
      gameId,
      phase: 'ban_start',
      currentTeam: 'blue',
      currentAction: 'ban',
      bans: { blue: [], red: [] },
      picks: { blue: [], red: [] },
      timers: {
        actionStart: 0,
        actionDuration: this.actionTimeout,
      },
      completedActions: [],
    };

    logger.info(`🎯 DraftManager initialized for game ${gameId}`);
  }

  /**
   * Start the draft process
   */
  start(): void {
    logger.info(`🚀 Starting draft for game ${this.gameId}`);
    this.nextPhase();
  }

  /**
   * Advance to next phase
   */
  private nextPhase(): void {
    // Clear any existing timer
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }

    // Check if draft is complete
    if (this.currentPhaseIndex >= DRAFT_SEQUENCE.length) {
      this.completeDraft();
      return;
    }

    const phase = DRAFT_SEQUENCE[this.currentPhaseIndex];
    const action = PHASE_TO_ACTION[phase];

    // Update state
    this.state.phase = phase;
    this.state.currentTeam = action.team;
    this.state.currentAction = action.type;
    this.state.timers.actionStart = Date.now();
    this.state.timers.actionDuration = this.actionTimeout;

    // Determine current actor (first player in team)
    if (action.type === 'ban') {
      const team = action.team === 'blue' ? this.blueTeam : this.redTeam;
      this.currentActor = team[0]?.userId || null;
    } else {
      this.currentActor = null; // Any player can pick
    }

    // Emit phase event
    this.emit('action', {
      phase,
      team: action.team,
      action: action.type,
      timeRemaining: this.actionTimeout,
      bans: this.state.bans,
      picks: this.state.picks,
      availableChampions: this.getAvailableChampions(),
    });

    // Set timeout for this phase
    this.phaseTimer = setTimeout(() => {
      this.handlePhaseTimeout();
    }, this.actionTimeout);
  }

  /**
   * Handle action from player
   */
  handleAction(
    userId: string,
    action: { type: 'ban' | 'pick'; championId: string }
  ): { success: boolean; error?: string } {
    const currentPhase = DRAFT_SEQUENCE[this.currentPhaseIndex];
    const phaseInfo = PHASE_TO_ACTION[currentPhase];

    // Validate action type matches phase
    if (phaseInfo.type !== action.type) {
      return { success: false, error: 'Invalid action type for current phase' };
    }

    // For bans, only the acting player can ban
    if (action.type === 'ban' && userId !== this.currentActor) {
      return { success: false, error: 'Not your turn to ban' };
    }

    // Validate champion is available
    if (this.unavailableChampions.has(action.championId)) {
      return { success: false, error: 'Champion not available' };
    }

    // Validate user is on the correct team
    const isOnCurrentTeam = this.isPlayerOnTeam(userId, phaseInfo.team);
    if (!isOnCurrentTeam) {
      return { success: false, error: 'Not your turn' };
    }

    // Process the action
    this.processAction(action.championId, phaseInfo.team, action.type, userId);

    // Move to next phase
    this.currentPhaseIndex++;
    this.nextPhase();

    return { success: true };
  }

  /**
   * Process a ban or pick action
   */
  private processAction(
    championId: string,
    team: TeamSide,
    type: 'ban' | 'pick',
    playerId: string,
    forced: boolean = false
  ): void {
    // Mark champion as unavailable
    this.unavailableChampions.add(championId);

    const logEntry: DraftActionLog = {
      phase: this.state.phase,
      team,
      action: type,
      championId,
      playerId,
      timestamp: Date.now(),
      forced,
    };

    this.state.completedActions.push(logEntry);

    if (type === 'ban') {
      this.state.bans[team].push(championId);
    } else {
      // Determine role for the pick
      const role = this.getRoleForPick(team, this.state.picks[team].length);
      
      const pick: DraftPick = {
        playerId,
        championId,
        role,
        pickedAt: Date.now(),
      };

      this.state.picks[team].push(pick);
    }

    logger.info(
      `🎯 ${team.toUpperCase()} ${type}s ${championId} (forced: ${forced})`
    );
  }

  /**
   * Handle phase timeout - force random selection
   */
  private handlePhaseTimeout(): void {
    const currentPhase = DRAFT_SEQUENCE[this.currentPhaseIndex];
    const phaseInfo = PHASE_TO_ACTION[currentPhase];

    logger.warn(`⏱️ Draft phase ${currentPhase} timed out`);

    // Get random available champion
    const available = this.getAvailableChampions();
    if (available.length === 0) {
      logger.error('No available champions for random selection!');
      this.currentPhaseIndex++;
      this.nextPhase();
      return;
    }

    const randomChampion = available[Math.floor(Math.random() * available.length)];

    // Process forced action
    if (phaseInfo.type !== 'complete') {
      this.processAction(randomChampion, phaseInfo.team, phaseInfo.type, this.currentActor!, true);
    }

    // Emit timeout event
    this.emit('timeout', {
      phase: currentPhase,
      championId: randomChampion,
      team: phaseInfo.team,
      forced: true,
    });

    // Move to next phase
    this.currentPhaseIndex++;
    this.nextPhase();
  }

  /**
   * Complete the draft
   */
  private async completeDraft(): Promise<void> {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }

    this.state.phase = 'complete';

    // Create match players in database
    await this.createMatchPlayers();

    logger.info(`✅ Draft complete for game ${this.gameId}`);

    // Emit completion event with final state
    this.emit('complete', {
      gameId: this.gameId,
      blueTeam: this.state.picks.blue.map((pick, index) => ({
        playerId: pick.playerId || this.blueTeam[index]?.userId,
        championId: pick.championId,
        role: pick.role,
      })),
      redTeam: this.state.picks.red.map((pick, index) => ({
        playerId: pick.playerId || this.redTeam[index]?.userId,
        championId: pick.championId,
        role: pick.role,
      })),
      bans: this.state.bans,
    });
  }

  /**
   * Create match player records in database
   */
  private async createMatchPlayers(): Promise<void> {
    const match = await prisma.match.findFirst({
      where: { gameId: this.gameId },
    });

    if (!match) {
      logger.error(`Match not found: ${this.gameId}`);
      return;
    }

    // Create blue team players
    for (let i = 0; i < this.state.picks.blue.length; i++) {
      const pick = this.state.picks.blue[i];
      const queueEntry = this.blueTeam[i];
      
      if (queueEntry) {
        await prisma.matchPlayer.create({
          data: {
            matchId: match.id,
            userId: queueEntry.userId,
            championId: pick.championId,
            team: 'blue',
            role: pick.role,
            summonerSpells: JSON.stringify(['flash', 'ignite']),
            items: '[]',
          },
        });
      }
    }

    // Create red team players
    for (let i = 0; i < this.state.picks.red.length; i++) {
      const pick = this.state.picks.red[i];
      const queueEntry = this.redTeam[i];
      
      if (queueEntry) {
        await prisma.matchPlayer.create({
          data: {
            matchId: match.id,
            userId: queueEntry.userId,
            championId: pick.championId,
            team: 'red',
            role: pick.role,
            summonerSpells: JSON.stringify(['flash', 'ignite']),
            items: '[]',
          },
        });
      }
    }

    // Update match status to ready for game
    await prisma.match.update({
      where: { id: match.id },
      data: { status: 'READY' },
    });
  }

  /**
   * Get list of available champions
   */
  private getAvailableChampions(): string[] {
    // In a real implementation, this would fetch from a champion pool
    // For now, we'll return common champions that would be filtered by banned
    const allChampions = [
      'ahri', 'akali', 'alistar', 'amumu', 'aphelios', 'ashe', 'aurelion-sol',
      'azir', 'bard', 'blitzcrank', 'brand', 'braum', 'caitlyn', 'camille',
      'cassiopeia', 'darius', 'diana', 'draven', 'ekko', 'elise', 'ezreal',
      'fiora', 'fizz', 'galio', 'garen', 'gnar', 'gragas', 'graves', 'irelia',
      'janna', 'jarvan-iv', 'jax', 'jayce', 'jhin', 'jinx', 'kaisa', 'karma',
      'kassadin', 'kayn', 'kennen', 'khazix', 'kindred', 'kog-maw', 'leblanc',
      'leesin', 'leona', 'lissandra', 'lucian', 'lulu', 'lux', 'malphite',
      'malzahar', 'maokai', 'miss-fortune', 'mordekaiser', 'morgana', 'nami',
      'nasus', 'nautilus', 'nidalee', 'nocturne', 'orianna', 'pantheon',
      'poppy', 'pyke', 'qiyana', 'rakan', 'reksai', 'renekton', 'rengar',
      'riven', 'rumble', 'sejuani', 'senna', 'seraphine', 'sion', 'sivir',
      'sona', 'soraka', 'swain', 'sylas', 'syndra', 'tahm-kench', 'taliyah',
      'talon', 'thresh', 'tristana', 'trundle', 'twisted-fate', 'varus',
      'vayne', 'veigar', 'velkoz', 'vi', 'viego', 'viktor', 'vladimir',
      'volibear', 'xayah', 'xerath', 'xinzhao', 'yasuo', 'yone', 'yummi',
      'zac', 'zed', 'ziggs', 'zilean', 'zoe', 'zyra'
    ];

    return allChampions.filter(c => !this.unavailableChampions.has(c));
  }

  /**
   * Check if player is on specified team
   */
  private isPlayerOnTeam(userId: string, team: TeamSide): boolean {
    if (team === 'blue') {
      return this.blueTeam.some(p => p.userId === userId);
    } else {
      return this.redTeam.some(p => p.userId === userId);
    }
  }

  /**
   * Get role for a pick based on order
   */
  private getRoleForPick(team: TeamSide, pickIndex: number): Role {
    // Standard role assignment for picks
    const roleOrder: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];
    return roleOrder[pickIndex] || 'fill';
  }

  /**
   * Get current state
   */
  getState(): DraftState {
    return { ...this.state };
  }

  /**
   * Get time remaining for current phase
   */
  getTimeRemaining(): number {
    const elapsed = Date.now() - this.state.timers.actionStart;
    return Math.max(0, this.state.timers.actionDuration - elapsed);
  }

  /**
   * Cancel draft
   */
  cancel(reason: string): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }

    logger.info(`❌ Draft cancelled for game ${this.gameId}: ${reason}`);
    
    this.emit('cancelled', { reason });
  }
}
