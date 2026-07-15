/**
 * GameEngine - Core game simulation server
 * Runs at fixed 20 TPS, manages all entities, physics, combat, objectives
 */
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import type {
  GameState,
  GameEntity,
  Vector2,
  TeamSide,
  DamageEvent,
  DeathEvent,
  AbilityUse,
  Objective,
  Projectile,
  GameEvent,
  MinionWaveConfig,
  Tower,
} from '../../../../shared/src/types/game';
import { GAME_CONSTANTS, MAP_CONFIG } from '../../../../shared/src/constants/game';
import { Physics } from '../physics/Physics';
import { CombatSystem } from './CombatSystem';
import { AbilitySystem } from './AbilitySystem';
import { VisionSystem } from './VisionSystem';
import { ObjectiveManager } from './ObjectiveManager';
import { MinionManager } from './MinionManager';
import { AIGuy } from '../ai/AIGuy';
import { logger } from '../../utils/logger';

export class GameEngine extends EventEmitter {
  id: string;
  state: GameState;
  tick: number = 0;
  private running: boolean = false;
  private lastTickTime: number = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private physics: Physics;
  private combat: CombatSystem;
  private abilities: AbilitySystem;
  private vision: VisionSystem;
  private objectives: ObjectiveManager;
  private minions: MinionManager;
  private aiPlayers: Map<string, AIGuy> = new Map();
  private disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(id: string, players: { userId: string; team: TeamSide; championId: string; slot: number }[]) {
    super();
    this.id = id;
    this.state = this.createInitialState(id, players);
    this.physics = new Physics(this);
    this.combat = new CombatSystem(this);
    this.abilities = new AbilitySystem(this);
    this.vision = new VisionSystem(this);
    this.objectives = new ObjectiveManager(this);
    this.minions = new MinionManager(this);

    this.setupEventHandlers();
    logger.info(`🎮 GameEngine created: ${id} with ${players.length} players`);
  }

  // ==========================================
  // LIFECYCLE
  // ==========================================

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTickTime = Date.now();
    const msPerTick = 1000 / GAME_CONSTANTS.TICK_RATE;

    this.tickInterval = setInterval(() => {
      const now = Date.now();
      const dt = (now - this.lastTickTime) / 1000;
      this.lastTickTime = now;

      this.update(dt);
      this.tick++;
      this.state.time += dt;
      this.state.map;
    }, msPerTick);

    logger.info(`🎮 Game started: ${this.id}`);
  }

  stop() {
    this.running = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    logger.info(`🎮 Game stopped: ${this.id}`);
  }

  destroy() {
    this.stop();
    this.emit('gameDestroyed', this.id);
  }

  // ==========================================
  // MAIN UPDATE LOOP
  // ==========================================

  private update(dt: number) {
    if (this.state.phase !== 'playing') return;

    this.updateEntities(dt);
    this.physics.update(dt);
    this.combat.update(dt);
    this.abilities.update(dt);
    this.minions.update(dt);
    this.objectives.update(dt);
    this.vision.update(dt);
    this.updateAI(dt);
    this.checkWinCondition();
    this.emitState();
  }

  private updateEntities(dt: number) {
    for (const entity of Object.values(this.state.entities)) {
      // Skip dead units
      if (this.isDead(entity)) continue;

      // Update buffs
      this.updateBuffs(entity, dt);

      // Apply state effects
      this.applyStates(entity, dt);

      // Movement
      if (!this.hasState(entity, 'stunned') && !this.hasState(entity, 'rooted') && !this.hasState(entity, 'sleeping')) {
        this.physics.moveEntity(entity, dt);
      }

      // Passive abilities
      if (entity.type === 'champion') {
        this.abilities.processPassives(entity, dt);
      }
    }

    // Update projectiles
    this.updateProjectiles(dt);
  }

  // ==========================================
  // SPAWNING
  // ==========================================

  spawnChampion(userId: string, team: TeamSide, championId: string, slot: number): GameEntity {
    const spawnPos = team === 'blue' ? MAP_CONFIG.BLUE_SPAWN : MAP_CONFIG.RED_SPAWN;
    const facing = team === 'blue' ? Math.PI / 4 : (5 * Math.PI) / 4;

    const entity: GameEntity = {
      id: userId,
      type: 'champion',
      team,
      position: { ...spawnPos },
      facing,
      velocity: { x: 0, y: 0 },
      stats: this.getDefaultStats(),
      baseStats: this.getDefaultStats(),
      current: {
        health: 600,
        maxHealth: 600,
        mana: 400,
        maxMana: 400,
        energy: 0,
        maxEnergy: 0,
        level: 1,
        xp: 0,
        xpToLevel: 280,
        gold: GAME_CONSTANTS.STARTING_GOLD,
        killCount: 0,
        deathCount: 0,
        assistCount: 0,
      },
      states: [],
      buffs: [],
      effects: [],
      model: {
        skinId: 'default',
        scale: 1,
        alpha: 1,
        tint: team === 'blue' ? '#1e3a5f' : '#5f1e1e',
        animation: 'idle',
        animationFrame: 0,
      },
      network: {
        lastServerUpdate: Date.now(),
        clientTimestamp: Date.now(),
        serverTimestamp: Date.now(),
        tickRate: GAME_CONSTANTS.TICK_RATE,
        latency: 0,
        pinging: false,
      },
    };

    this.state.entities[entity.id] = entity;
    this.emit('championSpawned', entity);
    return entity;
  }

  spawnTower(team: TeamSide, lane: 'top' | 'mid' | 'bot', order: number): Tower {
    const positions = MAP_CONFIG.TOWER_POSITIONS[team][lane];
    const pos = positions[order - 1];
    const laneName = lane;

    const tower: GameEntity & { towerData: Tower['towerData'] } = {
      id: `${team}-${laneName}-tower-${order}`,
      type: 'tower',
      team,
      position: { x: pos.x, y: pos.y },
      facing: 0,
      velocity: { x: 0, y: 0 },
      stats: this.getDefaultStats(),
      baseStats: this.getDefaultStats(),
      current: {
        health: 3800 + order * 800,
        maxHealth: 3800 + order * 800,
        mana: 0,
        maxMana: 0,
        energy: 0,
        maxEnergy: 0,
        level: 1,
        xp: 0,
        xpToLevel: 0,
        gold: 0,
        killCount: 0,
        deathCount: 0,
        assistCount: 0,
      },
      states: [],
      buffs: [],
      effects: [],
      model: {
        skinId: 'default',
        scale: 1.5,
        alpha: 1,
        tint: team === 'blue' ? '#1e3a5f' : '#5f1e1e',
        animation: 'idle',
        animationFrame: 0,
      },
      network: {
        lastServerUpdate: Date.now(),
        clientTimestamp: Date.now(),
        serverTimestamp: Date.now(),
        tickRate: GAME_CONSTANTS.TICK_RATE,
        latency: 0,
        pinging: false,
      },
      towerData: {
        order,
        lane: laneName,
        platings: 5,
        platingsRemaining: 5,
        currentTarget: undefined,
        lastAttackTime: 0,
      },
    } as GameEntity & { towerData: Tower['towerData'] };

    this.state.entities[tower.id] = tower;
    this.emit('towerSpawned', tower);
    return tower as unknown as Tower;
  }

  // ==========================================
  // COMBAT
  // ==========================================

  dealDamage(sourceId: string, targetId: string, amount: number, type: 'physical' | 'magic' | 'true', ability?: AbilityUse): DamageEvent {
    const source = this.state.entities[sourceId];
    const target = this.state.entities[targetId];

    if (!source || !target || this.isDead(target)) {
      return { sourceId, targetId, amount: 0, type, isCrit: false, isKill: false, overkill: 0, timestamp: Date.now() };
    }

    // Apply resistances
    let finalDamage = amount;
    if (type === 'physical') {
      finalDamage = this.combat.calculatePhysicalDamage(amount, target);
    } else if (type === 'magic') {
      finalDamage = this.combat.calculateMagicDamage(amount, target);
    }
    // true damage goes through

    target.current.health = Math.max(0, target.current.health - finalDamage);

    const event: DamageEvent = {
      sourceId,
      targetId,
      amount: finalDamage,
      type,
      ability,
      isCrit: false,
      isKill: target.current.health <= 0,
      overkill: target.current.health < 0 ? Math.abs(target.current.health) : 0,
      timestamp: Date.now(),
    };

    this.addGameEvent('champion_kill', event);
    this.emit('damage', event);

    if (event.isKill) {
      this.handleKill(sourceId, targetId);
    }

    return event;
  }

  private handleKill(killerId: string, victimId: string) {
    const killer = this.state.entities[killerId];
    const victim = this.state.entities[victimId];

    if (!killer || !victim) return;

    killer.current.killCount++;
    victim.current.deathCount++;

    // Gold reward
    const goldReward = this.calculateGoldReward(killer, victim);
    killer.current.gold += goldReward;

    // Find assists
    const assists = this.findAssists(victim.id);
    assists.forEach((assistantId) => {
      const assistant = this.state.entities[assistantId];
      if (assistant) {
        assistant.current.assistCount++;
        assistant.current.gold += 50; // Assist gold
      }
    });

    // Add death event
    const deathEvent: DeathEvent = {
      entityId: victimId,
      killerId,
      assistIds: assists,
      goldReward,
      timestamp: Date.now(),
    };
    this.addGameEvent('champion_kill', deathEvent);
    this.emit('kill', deathEvent);

    // Respawn if champion
    if (victim.type === 'champion') {
      this.scheduleRespawn(victimId);
    }
  }

  private scheduleRespawn(entityId: string) {
    const entity = this.state.entities[entityId];
    if (!entity) return;

    const respawnTime = this.getRespawnTime(entity);
    const state = { type: 'dead' as const, startTime: this.state.time, duration: respawnTime };
    entity.states.push(state);

    setTimeout(() => {
      if (this.state.entities[entityId]) {
        entity.states = entity.states.filter((s) => s.type !== 'dead');
        this.respawnEntity(entityId);
      }
    }, respawnTime * 1000);
  }

  private respawnEntity(entityId: string) {
    const entity = this.state.entities[entityId];
    if (!entity) return;

    const spawnPos = entity.team === 'blue' ? MAP_CONFIG.BLUE_SPAWN : MAP_CONFIG.RED_SPAWN;
    entity.position = { ...spawnPos };
    entity.current.health = entity.current.maxHealth;
    entity.current.mana = entity.current.maxMana;

    this.emit('entityRespawned', entity);
  }

  private getRespawnTime(entity: GameEntity): number {
    const level = entity.current.level;
    return Math.max(8, level * 2.5 + 5); // seconds
  }

  private findAssists(victimId: string): string[] {
    return []; // Simplified - real implementation tracks recent damage dealers
  }

  private calculateGoldReward(killer: GameEntity, victim: GameEntity): number {
    const baseKillGold = GAME_CONSTANTS.KILL_GOLD_BASE;
    const bounty = GAME_CONSTANTS.KILL_GOLD_BASE + Math.floor(victim.current.gold / 100);
    return Math.min(baseKillGold + bounty, 1000);
  }

  // ==========================================
  // PROJECTILES
  // ==========================================

  createProjectile(config: {
    ownerId: string;
    targetId?: string;
    position: Vector2;
    velocity: Vector2;
    speed: number;
    damage: number;
    damageType: 'physical' | 'magic' | 'true';
    ability?: AbilityUse;
    hitboxRadius: number;
    maxDistance: number;
  }): Projectile {
    const projectile: Projectile = {
      id: uuid(),
      type: 'skill',
      ownerId: config.ownerId,
      targetId: config.targetId,
      position: { ...config.position },
      velocity: { ...config.velocity },
      speed: config.speed,
      damage: config.damage,
      damageType: config.damageType,
      source: config.ability || {
        casterId: config.ownerId,
        abilityKey: 'Q',
        level: 1,
      },
      hitboxRadius: config.hitboxRadius,
      maxDistance: config.maxDistance,
      traveled: 0,
      pierced: [],
      startTime: Date.now(),
      isActive: true,
    };

    this.state.projectiles.push(projectile);
    return projectile;
  }

  private updateProjectiles(dt: number) {
    const toRemove: string[] = [];

    for (const projectile of this.state.projectiles) {
      if (!projectile.isActive) continue;

      // Move projectile
      const moveX = projectile.velocity.x * projectile.speed * dt;
      const moveY = projectile.velocity.y * projectile.speed * dt;
      projectile.position.x += moveX;
      projectile.position.y += moveY;
      projectile.traveled += Math.sqrt(moveX * moveX + moveY * moveY);

      // Check max distance
      if (projectile.traveled >= projectile.maxDistance) {
        projectile.isActive = false;
        toRemove.push(projectile.id);
        continue;
      }

      // Check terrain collision
      if (this.physics.checkTerrainCollision(projectile.position)) {
        projectile.isActive = false;
        toRemove.push(projectile.id);
        continue;
      }

      // Check entity hits
      const target = projectile.targetId ? this.state.entities[projectile.targetId] : null;
      if (target && this.physics.distance(projectile.position, target.position) < projectile.hitboxRadius + 30) {
        this.dealDamage(projectile.ownerId, target.id, projectile.damage, projectile.damageType, projectile.source);
        projectile.isActive = false;
        toRemove.push(projectile.id);
      }
    }

    // Remove expired projectiles
    this.state.projectiles = this.state.projectiles.filter((p) => !toRemove.includes(p.id));
  }

  // ==========================================
  // ABILITIES
  // ==========================================

  useAbility(casterId: string, ability: AbilityUse) {
    this.abilities.useAbility(casterId, ability);
  }

  levelUpAbility(entityId: string, abilityKey: 'Q' | 'W' | 'E' | 'R') {
    this.abilities.levelUp(entityId, abilityKey);
  }

  // ==========================================
  // VISION
  // ==========================================

  isVisible(entityId: string, forTeam: TeamSide): boolean {
    return this.vision.isVisible(entityId, forTeam);
  }

  getVisibleEntities(forTeam: TeamSide): string[] {
    return this.vision.getVisibleEntities(forTeam);
  }

  // ==========================================
  // ITEMS & SHOP
  // ==========================================

  purchaseItem(entityId: string, itemId: string): boolean {
    const entity = this.state.entities[entityId];
    if (!entity || entity.type !== 'champion') return false;

    // TODO: integrate with shop system
    return true;
  }

  sellItem(entityId: string, slot: number): boolean {
    const entity = this.state.entities[entityId];
    if (!entity || entity.type !== 'champion') return false;
    return true;
  }

  // ==========================================
  // RECALL & TELEPORT
  // ==========================================

  startRecall(entityId: string) {
    const entity = this.state.entities[entityId];
    if (!entity) return;

    entity.states.push({
      type: 'recalling',
      startTime: this.state.time,
      duration: GAME_CONSTANTS.RECALL_TIME,
    });

    this.emit('recallStarted', { entityId, duration: GAME_CONSTANTS.RECALL_TIME });
  }

  cancelRecall(entityId: string) {
    const entity = this.state.entities[entityId];
    if (!entity) return;

    entity.states = entity.states.filter((s) => s.type !== 'recalling');
    this.emit('recallCancelled', { entityId });
  }

  // ==========================================
  // MOVEMENT & ORDERS
  // ==========================================

  moveOrder(entityId: string, target: Vector2) {
    const entity = this.state.entities[entityId];
    if (!entity || this.isDead(entity)) return;

    const dx = target.x - entity.position.x;
    const dy = target.y - entity.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    entity.velocity = {
      x: dist > 0 ? (dx / dist) * entity.stats.currentMoveSpeed : 0,
      y: dist > 0 ? (dy / dist) * entity.stats.currentMoveSpeed : 0,
    };

    entity.model.animation = 'move';
    this.emit('moveOrder', { entityId, target });
  }

  attackOrder(entityId: string, targetId: string) {
    const entity = this.state.entities[entityId];
    const target = this.state.entities[targetId];
    if (!entity || !target || this.isDead(entity) || this.isDead(target)) return;

    entity.model.animation = 'attack';
    this.emit('attackOrder', { entityId, targetId });
  }

  stopOrder(entityId: string) {
    const entity = this.state.entities[entityId];
    if (!entity) return;

    entity.velocity = { x: 0, y: 0 };
    entity.model.animation = 'idle';
    this.emit('stopOrder', { entityId });
  }

  // ==========================================
  // PINGS
  // ==========================================

  ping(entityId: string, position: Vector2, type: 'onMyWay' | 'danger' | 'missing' | 'vision', targetId?: string) {
    this.emit('ping', { entityId, position, type, targetId });
    this.addGameEvent('ping', { entityId, position, type, targetId });
  }

  // ==========================================
  // SURRENDER
  // ==========================================

  initiateSurrenderVote(entityId: string) {
    const entity = this.state.entities[entityId];
    if (!entity || this.state.time < GAME_CONSTANTS.MIN_GAME_DURATION) return;

    this.emit('surrenderVoteStarted', { team: entity.team, initiatorId: entityId });
  }

  voteSurrender(entityId: string, vote: boolean) {
    this.emit('surrenderVote', { entityId, vote });
  }

  // ==========================================
  // STATE HELPERS
  // ==========================================

  isDead(entity: GameEntity): boolean {
    return entity.current.health <= 0 || this.hasState(entity, 'dead');
  }

  hasState(entity: GameEntity, stateType: string): boolean {
    return entity.states.some((s) => s.type === stateType && this.state.time < s.startTime + s.duration);
  }

  getEntity(id: string): GameEntity | undefined {
    return this.state.entities[id];
  }

  getTeam(team: TeamSide): GameEntity[] {
    return Object.values(this.state.entities).filter((e) => e.team === team && !this.isDead(e));
  }

  getLivingEntities(): GameEntity[] {
    return Object.values(this.state.entities).filter((e) => !this.isDead(e));
  }

  private updateBuffs(entity: GameEntity, dt: number) {
    entity.buffs = entity.buffs.filter((buff) => {
      const elapsed = this.state.time - buff.startTime;
      return elapsed < buff.duration;
    });
  }

  private applyStates(entity: GameEntity, dt: number) {
    for (const state of entity.states) {
      const elapsed = this.state.time - state.startTime;
      if (elapsed >= state.duration) {
        entity.states = entity.states.filter((s) => s !== state);
        continue;
      }

      // Apply state effects
      if (state.type === 'stunned' || state.type === 'rooted' || state.type === 'sleeping') {
        entity.velocity = { x: 0, y: 0 };
      }
    }
  }

  // ==========================================
  // AI
  // ==========================================

  addAIPlayer(userId: string, team: TeamSide, difficulty: 'easy' | 'medium' | 'hard') {
    const ai = new AIGuy(userId, this, team, difficulty);
    this.aiPlayers.set(userId, ai);
    ai.start();
    logger.info(`🤖 AI player added: ${userId} (${difficulty})`);
  }

  private updateAI(dt: number) {
    for (const ai of this.aiPlayers.values()) {
      ai.update(dt);
    }
  }

  // ==========================================
  // WIN CONDITION
  // ==========================================

  private checkWinCondition() {
    const blueNexus = this.getNexus('blue');
    const redNexus = this.getNexus('red');

    if (!blueNexus || !redNexus) return;

    if (this.isDead(blueNexus)) {
      this.endGame('red');
    } else if (this.isDead(redNexus)) {
      this.endGame('blue');
    }
  }

  private getNexus(team: TeamSide): GameEntity | undefined {
    return Object.values(this.state.entities).find((e) => e.type === 'nexus' && e.team === team);
  }

  private endGame(winner: TeamSide) {
    this.state.phase = 'end';
    this.stop();

    this.addGameEvent('game_end', { winner, duration: this.state.time });
    this.emit('gameEnded', { winner, duration: this.state.time });

    logger.info(`🏆 Game ${this.id} ended. Winner: ${winner}`);
  }

  // ==========================================
  // NETWORKING HELPERS
  // ==========================================

  private emitState() {
    if (this.tick % Math.round(GAME_CONSTANTS.TICK_RATE / 10) !== 0) return; // emit ~10 times/sec
    this.emit('stateUpdate', this.getSnapshot());
  }

  getSnapshot(): GameState {
    // Return a delta or full snapshot
    return { ...this.state };
  }

  getEntityState(entityId: string): Partial<GameEntity> | null {
    const entity = this.state.entities[entityId];
    if (!entity) return null;
    return { ...entity };
  }

  // ==========================================
  // EVENT HELPERS
  // ==========================================

  public addGameEvent(type: string, data: any) {
    this.state.events.push({
      id: uuid(),
      type: type as any,
      timestamp: this.state.time,
      data,
    });

    // Keep events list bounded
    if (this.state.events.length > 1000) {
      this.state.events = this.state.events.slice(-500);
    }
  }

  private setupEventHandlers() {
    this.on('championSpawned', (entity) => logger.debug(`Champion spawned: ${entity.id}`));
    this.on('kill', (event) => {
      const killer = this.state.entities[event.killerId];
      const victim = this.state.entities[event.entityId];
      if (killer && victim) {
        logger.info(`💀 ${killer.id} killed ${event.entityId}`);
      }
    });
    this.on('gameEnded', (data) => logger.info(`🏆 Game ended: ${data.winner} wins`));
  }

  // ==========================================
  // FACTORY
  // ==========================================

  private createInitialState(id: string, players: { userId: string; team: TeamSide; championId: string; slot: number }[]): GameState {
    return {
      id,
      phase: 'pre-game',
      time: 0,
      map: {
        id: 'summoners_rift',
        name: "Summoner's Rift",
        width: MAP_CONFIG.MAP_WIDTH,
        height: MAP_CONFIG.MAP_HEIGHT,
        gridSize: MAP_CONFIG.GRID_SIZE,
        terrain: [],
        zones: [],
        lanes: [],
        spawnPoints: {
          blue: MAP_CONFIG.BLUE_SPAWN,
          red: MAP_CONFIG.RED_SPAWN,
        },
      },
      teams: [
        { id: 'blue', kills: 0, towers: 0, dragons: 0, barons: 0, gold: 0 },
        { id: 'red', kills: 0, towers: 0, dragons: 0, barons: 0, gold: 0 },
      ],
      entities: {},
      projectiles: [],
      effects: [],
      events: [],
      settings: {
        map: {
          id: 'summoners_rift',
          name: "Summoner's Rift",
          width: MAP_CONFIG.MAP_WIDTH,
          height: MAP_CONFIG.MAP_HEIGHT,
          gridSize: MAP_CONFIG.GRID_SIZE,
        },
        gameMode: 'classic',
        matchLength: 0,
        surrenderEnabled: true,
        minimapSharing: true,
      },
    };
  }

  private getDefaultStats(): import('../../../../shared/src/types/game').ComputedStats {
    return {
      health: 600, healthPerLevel: 85,
      mana: 400, manaPerLevel: 45,
      armor: 30, armorPerLevel: 3.5,
      magicResist: 30, magicResistPerLevel: 1.5,
      moveSpeed: 345, attackRange: 150,
      attackDamage: 60, attackDamagePerLevel: 3,
      attackSpeed: 0.625, attackSpeedPerLevel: 2.5,
      critChance: 0, critDamage: 1.75,
      spellBlock: 30,
      currentAttackSpeed: 0.625,
      currentRange: 150,
      currentMoveSpeed: 345,
      currentArmor: 30,
      currentMR: 30,
      currentAD: 60,
      currentAP: 0,
      attackSpeedMultiplier: 1,
      critMultiplier: 1.75,
      lifesteal: 0,
      armorPenetration: 0,
      magicPenetration: 0,
      cdr: 0,
    };
  }
}

interface TeamState {
  id: string;
  kills: number;
  towers: number;
  dragons: number;
  barons: number;
  gold: number;
}
