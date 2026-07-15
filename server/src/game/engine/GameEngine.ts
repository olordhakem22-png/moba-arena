/**
 * GameEngine - Core game simulation server
 * Runs at fixed 20 TPS, manages all entities, physics, combat, objectives
 * Handles game phases: loading, picking, playing, ended
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
  Projectile,
  GameEvent,
  Tower,
} from '@shared/types/game';
import { GAME_CONSTANTS, MAP_CONFIG } from '@shared/constants/game';
import { Physics } from '../physics/Physics';
import { CombatSystem } from './CombatSystem';
import { AbilitySystem } from './AbilitySystem';
import { VisionSystem } from './VisionSystem';
import { ObjectiveManager } from './ObjectiveManager';
import { MinionManager } from './MinionManager';
import { TowerSystem } from './TowerSystem';
import { ItemSystem } from './ItemSystem';
import { AIGuy } from '../ai/AIGuy';
import { logger } from '../../utils/logger';
import { CHAMPION_DATA, getChampionStatsAtLevel } from '@shared/data/champions';

export class GameEngine extends EventEmitter {
  // Core state
  id: string;
  state: GameState;
  tick: number = 0;
  private running: boolean = false;
  private lastTickTime: number = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  
  // Systems
  physics!: Physics;
  combat!: CombatSystem;
  abilities!: AbilitySystem;
  vision!: VisionSystem;
  objectives!: ObjectiveManager;
  minions!: MinionManager;
  towers!: TowerSystem;
  items!: ItemSystem;
  
  // AI
  private aiPlayers: Map<string, AIGuy> = new Map();
  private disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // Player tracking
  private players: Map<string, { team: TeamSide; championId: string; slot: number }> = new Map();

  // State tracking
  private surrenderVotes: Map<TeamSide, { yes: Set<string>; no: Set<string>; inProgress: boolean }> = new Map([
    ['blue', { yes: new Set(), no: new Set(), inProgress: false }],
    ['red', { yes: new Set(), no: new Set(), inProgress: false }],
  ]);

  // Snapshot settings
  private lastSnapshotTick: number = 0;
  private snapshotInterval: number = 2; // Send full state every 2 ticks

  constructor(id: string, players: { userId: string; team: TeamSide; championId: string; slot: number }[]) {
    super();
    this.id = id;
    this.state = this.createInitialState(id, players);
    
    // Store player info
    for (const player of players) {
      this.players.set(player.userId, player);
    }

    // Initialize systems
    this.physics = new Physics(this);
    this.combat = new CombatSystem(this);
    this.abilities = new AbilitySystem(this);
    this.vision = new VisionSystem(this);
    this.objectives = new ObjectiveManager(this);
    this.minions = new MinionManager(this);
    this.towers = new TowerSystem(this);
    this.items = new ItemSystem(this);

    this.setupEventHandlers();
    logger.info(`🎮 GameEngine created: ${id} with ${players.length} players`);
  }

  // ==========================================
  // LIFECYCLE
  // ==========================================

  start(): void {
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
    }, msPerTick);

    // Set initial phase
    this.state.phase = 'countdown';
    this.startCountdown();

    logger.info(`🎮 Game started: ${this.id}`);
  }

  stop(): void {
    this.running = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    logger.info(`🎮 Game stopped: ${this.id}`);
  }

  destroy(): void {
    this.stop();
    this.emit('gameDestroyed', this.id);
  }

  private startCountdown(): void {
    setTimeout(() => {
      this.transitionToPhase('playing');
      this.spawnAllEntities();
    }, GAME_CONSTANTS.GAME_START_COUNTDOWN * 1000);
  }

  private transitionToPhase(phase: GameState['phase']): void {
    const oldPhase = this.state.phase;
    this.state.phase = phase;
    this.addGameEvent('phase_change', { from: oldPhase, to: phase, time: this.state.time });
    this.emit('phaseChange', { from: oldPhase, to: phase });
    logger.info(`🎮 Game ${this.id} transitioned: ${oldPhase} -> ${phase}`);
  }

  // ==========================================
  // ENTITY SPAWNING
  // ==========================================

  private spawnAllEntities(): void {
    // Spawn champions
    for (const [userId, player] of this.players) {
      this.spawnChampion(userId, player.team, player.championId, player.slot);
      this.items.initializeEntity(userId);
      this.abilities.initializeAbilityLevels(userId);
    }

    // Spawn towers
    this.spawnAllTowers();

    // Spawn nexus
    this.spawnNexus();

    // Spawn inhibitors
    this.spawnInhibitors();

    // Add bot players if needed
    this.ensureMinimumPlayers();
  }

  spawnChampion(userId: string, team: TeamSide, championId: string, slot: number): GameEntity {
    const spawnPos = team === 'blue' ? MAP_CONFIG.BLUE_SPAWN : MAP_CONFIG.RED_SPAWN;
    const facing = team === 'blue' ? Math.PI / 4 : (5 * Math.PI) / 4;

    // Get champion base stats
    const baseStats = CHAMPION_DATA[championId]?.stats;
    const statsAtLevel = getChampionStatsAtLevel(championId, 1);

    const entity: GameEntity = {
      id: userId,
      type: 'champion',
      team,
      position: { ...spawnPos },
      facing,
      velocity: { x: 0, y: 0 },
      stats: {
        health: baseStats?.health || 500,
        healthPerLevel: baseStats?.healthPerLevel || 85,
        mana: baseStats?.mana || 400,
        manaPerLevel: baseStats?.manaPerLevel || 45,
        armor: baseStats?.armor || 18,
        armorPerLevel: baseStats?.armorPerLevel || 3.5,
        magicResist: baseStats?.magicResist || 30,
        magicResistPerLevel: baseStats?.magicResistPerLevel || 1.5,
        moveSpeed: baseStats?.moveSpeed || 330,
        attackRange: baseStats?.attackRange || 550,
        attackDamage: baseStats?.attackDamage || 50,
        attackDamagePerLevel: baseStats?.attackDamagePerLevel || 3,
        attackSpeed: baseStats?.attackSpeed || 0.625,
        attackSpeedPerLevel: baseStats?.attackSpeedPerLevel || 2.5,
        critChance: 0,
        critDamage: 1.75,
        spellBlock: 30,
        currentHealth: baseStats?.health || 500,
        currentMana: baseStats?.mana || 400,
        currentEnergy: 0,
        currentAttackSpeed: baseStats?.attackSpeed || 0.625,
        currentRange: baseStats?.attackRange || 550,
        currentMoveSpeed: baseStats?.moveSpeed || 330,
        currentArmor: baseStats?.armor || 18,
        currentMR: baseStats?.magicResist || 30,
        currentAD: baseStats?.attackDamage || 50,
        currentAP: 0,
        attackSpeedMultiplier: 1,
        critMultiplier: 1.75,
        lifesteal: 0,
        armorPenetration: 0,
        magicPenetration: 0,
        cdr: 0,
      },
      baseStats: {
        health: baseStats?.health || 500,
        healthPerLevel: baseStats?.healthPerLevel || 85,
        mana: baseStats?.mana || 400,
        manaPerLevel: baseStats?.manaPerLevel || 45,
        armor: baseStats?.armor || 18,
        armorPerLevel: baseStats?.armorPerLevel || 3.5,
        magicResist: baseStats?.magicResist || 30,
        magicResistPerLevel: baseStats?.magicResistPerLevel || 1.5,
        moveSpeed: baseStats?.moveSpeed || 330,
        attackRange: baseStats?.attackRange || 550,
        attackDamage: baseStats?.attackDamage || 50,
        attackDamagePerLevel: baseStats?.attackDamagePerLevel || 3,
        attackSpeed: baseStats?.attackSpeed || 0.625,
        attackSpeedPerLevel: baseStats?.attackSpeedPerLevel || 2.5,
        critChance: 0,
        critDamage: 1.75,
        spellBlock: 30,
      } as any,
      current: {
        health: statsAtLevel?.health || 500,
        maxHealth: statsAtLevel?.health || 500,
        mana: statsAtLevel?.mana || 400,
        maxMana: statsAtLevel?.mana || 400,
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

    // Store champion ID for ability lookup
    (entity as any).championId = championId;

    this.state.entities[entity.id] = entity;
    this.emit('championSpawned', entity);
    return entity;
  }

  private spawnAllTowers(): void {
    for (const team of ['blue', 'red'] as const) {
      for (const lane of ['top', 'mid', 'bot'] as const) {
        for (let order = 1; order <= 3; order++) {
          const tower = this.spawnTower(team, lane, order);
          this.towers.registerTower(tower.id, lane, order);
        }
      }
    }
  }

  spawnTower(team: TeamSide, lane: 'top' | 'mid' | 'bot', order: number): Tower {
    const positions = MAP_CONFIG.TOWER_POSITIONS[team][lane];
    const pos = positions[order - 1];

    const towerStats = {
      1: { health: 3800, damage: 152, attackSpeed: 0.8 },
      2: { health: 4600, damage: 189, attackSpeed: 0.8 },
      3: { health: 5400, damage: 226, attackSpeed: 0.8 },
    }[order] || { health: 3800, damage: 152, attackSpeed: 0.8 };

    const tower: GameEntity & { towerData: Tower['towerData'] } = {
      id: `${team}-${lane}-tower-${order}`,
      type: 'tower',
      team,
      position: { x: pos.x, y: pos.y },
      facing: 0,
      velocity: { x: 0, y: 0 },
      stats: {
        health: towerStats.health,
        healthPerLevel: 0,
        mana: 0,
        manaPerLevel: 0,
        armor: 50 + order * 10,
        armorPerLevel: 0,
        magicResist: 50,
        magicResistPerLevel: 0,
        moveSpeed: 0,
        attackRange: GAME_CONSTANTS.GLOBAL_TOWER_RANGE,
        attackDamage: towerStats.damage,
        attackDamagePerLevel: 0,
        attackSpeed: towerStats.attackSpeed,
        attackSpeedPerLevel: 0,
        critChance: 0,
        critDamage: 1.75,
        spellBlock: 50,
        currentHealth: towerStats.health,
        currentMana: 0,
        currentEnergy: 0,
        currentAttackSpeed: towerStats.attackSpeed,
        currentRange: GAME_CONSTANTS.GLOBAL_TOWER_RANGE,
        currentMoveSpeed: 0,
        currentArmor: 50 + order * 10,
        currentMR: 50,
        currentAD: towerStats.damage,
        currentAP: 0,
        attackSpeedMultiplier: 1,
        critMultiplier: 1.75,
        lifesteal: 0,
        armorPenetration: 0,
        magicPenetration: 0,
        cdr: 0,
      },
      baseStats: {} as any,
      current: {
        health: towerStats.health,
        maxHealth: towerStats.health,
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
        lane,
        platings: 5,
        platingsRemaining: 5,
        currentTarget: undefined,
        lastAttackTime: 0,
      },
    } as any;

    this.state.entities[tower.id] = tower;
    this.emit('towerSpawned', tower);
    return tower as unknown as Tower;
  }

  private spawnNexus(): void {
    // Blue nexus
    const blueNexus: GameEntity = {
      id: 'blue-nexus',
      type: 'nexus',
      team: 'blue',
      position: { ...MAP_CONFIG.BLUE_NEXUS },
      facing: 0,
      velocity: { x: 0, y: 0 },
      stats: {
        health: 5500, healthPerLevel: 0, mana: 0, manaPerLevel: 0,
        armor: 50, armorPerLevel: 0, magicResist: 50, magicResistPerLevel: 0,
        moveSpeed: 0, attackRange: 0, attackDamage: 0, attackDamagePerLevel: 0,
        attackSpeed: 0, attackSpeedPerLevel: 0, critChance: 0, critDamage: 1.75, spellBlock: 50,
        currentHealth: 5500, currentMana: 0, currentEnergy: 0, currentAttackSpeed: 0, currentRange: 0, currentMoveSpeed: 0,
        currentArmor: 50, currentMR: 50, currentAD: 0, currentAP: 0,
        attackSpeedMultiplier: 1, critMultiplier: 1.75, lifesteal: 0,
        armorPenetration: 0, magicPenetration: 0, cdr: 0,
      },
      baseStats: {} as any,
      current: {
        health: 5500, maxHealth: 5500, mana: 0, maxMana: 0, energy: 0, maxEnergy: 0,
        level: 1, xp: 0, xpToLevel: 0, gold: 0, killCount: 0, deathCount: 0, assistCount: 0,
      },
      states: [], buffs: [], effects: [],
      model: { skinId: 'default', scale: 2, alpha: 1, tint: '#1e3a5f', animation: 'idle', animationFrame: 0 },
      network: { lastServerUpdate: Date.now(), clientTimestamp: Date.now(), serverTimestamp: Date.now(), tickRate: GAME_CONSTANTS.TICK_RATE, latency: 0, pinging: false },
    };

    // Red nexus
    const redNexus: GameEntity = {
      id: 'red-nexus',
      type: 'nexus',
      team: 'red',
      position: { ...MAP_CONFIG.RED_NEXUS },
      facing: 0,
      velocity: { x: 0, y: 0 },
      stats: {
        health: 5500, healthPerLevel: 0, mana: 0, manaPerLevel: 0,
        armor: 50, armorPerLevel: 0, magicResist: 50, magicResistPerLevel: 0,
        moveSpeed: 0, attackRange: 0, attackDamage: 0, attackDamagePerLevel: 0,
        attackSpeed: 0, attackSpeedPerLevel: 0, critChance: 0, critDamage: 1.75, spellBlock: 50,
        currentHealth: 5500, currentMana: 0, currentEnergy: 0, currentAttackSpeed: 0, currentRange: 0, currentMoveSpeed: 0,
        currentArmor: 50, currentMR: 50, currentAD: 0, currentAP: 0,
        attackSpeedMultiplier: 1, critMultiplier: 1.75, lifesteal: 0,
        armorPenetration: 0, magicPenetration: 0, cdr: 0,
      },
      baseStats: {} as any,
      current: {
        health: 5500, maxHealth: 5500, mana: 0, maxMana: 0, energy: 0, maxEnergy: 0,
        level: 1, xp: 0, xpToLevel: 0, gold: 0, killCount: 0, deathCount: 0, assistCount: 0,
      },
      states: [], buffs: [], effects: [],
      model: { skinId: 'default', scale: 2, alpha: 1, tint: '#5f1e1e', animation: 'idle', animationFrame: 0 },
      network: { lastServerUpdate: Date.now(), clientTimestamp: Date.now(), serverTimestamp: Date.now(), tickRate: GAME_CONSTANTS.TICK_RATE, latency: 0, pinging: false },
    };

    this.state.entities['blue-nexus'] = blueNexus;
    this.state.entities['red-nexus'] = redNexus;
  }

  private spawnInhibitors(): void {
    for (const team of ['blue', 'red'] as const) {
      for (const lane of ['top', 'mid', 'bot'] as const) {
        const pos = MAP_CONFIG.INHIBITOR_POSITIONS[team][lane];
        const inhibitor: GameEntity = {
          id: `${team}-${lane}-inhibitor`,
          type: 'inhibitor',
          team,
          position: { ...pos },
          facing: 0,
          velocity: { x: 0, y: 0 },
          stats: {
            health: 3000, healthPerLevel: 0, mana: 0, manaPerLevel: 0,
            armor: 40, armorPerLevel: 0, magicResist: 40, magicResistPerLevel: 0,
            moveSpeed: 0, attackRange: 0, attackDamage: 0, attackDamagePerLevel: 0,
            attackSpeed: 0, attackSpeedPerLevel: 0, critChance: 0, critDamage: 1.75, spellBlock: 40,
            currentHealth: 5500, currentMana: 0, currentEnergy: 0, currentAttackSpeed: 0, currentRange: 0, currentMoveSpeed: 0,
            currentArmor: 40, currentMR: 40, currentAD: 0, currentAP: 0,
            attackSpeedMultiplier: 1, critMultiplier: 1.75, lifesteal: 0,
            armorPenetration: 0, magicPenetration: 0, cdr: 0,
          },
          baseStats: {} as any,
          current: {
            health: 3000, maxHealth: 3000, mana: 0, maxMana: 0, energy: 0, maxEnergy: 0,
            level: 1, xp: 0, xpToLevel: 0, gold: 0, killCount: 0, deathCount: 0, assistCount: 0,
          },
          states: [], buffs: [], effects: [],
          model: { skinId: 'default', scale: 1.2, alpha: 1, tint: team === 'blue' ? '#1e3a5f' : '#5f1e1e', animation: 'idle', animationFrame: 0 },
          network: { lastServerUpdate: Date.now(), clientTimestamp: Date.now(), serverTimestamp: Date.now(), tickRate: GAME_CONSTANTS.TICK_RATE, latency: 0, pinging: false },
        };
        this.state.entities[inhibitor.id] = inhibitor;
      }
    }
  }

  private ensureMinimumPlayers(): void {
    // Add bot players if needed for testing
    const blueCount = Array.from(this.players.values()).filter(p => p.team === 'blue').length;
    const redCount = Array.from(this.players.values()).filter(p => p.team === 'red').length;

    if (blueCount === 0) {
      this.addAIPlayer('bot-blue-1', 'blue', 'medium');
    }
    if (redCount === 0) {
      this.addAIPlayer('bot-red-1', 'red', 'medium');
    }
  }

  // ==========================================
  // MAIN UPDATE LOOP
  // ==========================================

  private update(dt: number): void {
    // Only update game systems when playing
    if (this.state.phase !== 'playing') return;

    // Update entities
    this.updateEntities(dt);

    // Update systems
    this.physics.update(dt);
    this.combat.update(dt);
    this.abilities.update(dt);
    this.minions.update(dt);
    this.towers.update(dt);
    this.objectives.update(dt);
    this.vision.update(dt);
    this.items.update(dt);
    this.updateAI(dt);

    // Check game conditions
    this.checkWinCondition();
    this.checkSurrender();
    this.updateTeamStats();

    // Broadcast state
    this.emitState();
  }

  private updateEntities(dt: number): void {
    for (const entity of Object.values(this.state.entities)) {
      // Skip dead units
      if (this.isDead(entity)) continue;

      // Update buffs
      this.updateBuffs(entity, dt);

      // Apply states
      this.applyStates(entity, dt);

      // Movement (if not CC'd)
      if (!this.hasState(entity, 'stunned') && !this.hasState(entity, 'rooted') && !this.hasState(entity, 'sleeping') && !this.hasState(entity, 'feared')) {
        this.physics.moveEntity(entity, dt);
      }

      // Passive abilities
      if (entity.type === 'champion') {
        this.abilities.processPassives(entity, dt);
      }

      // Auto-attack for champions
      if (entity.type === 'champion' && entity.model.animation === 'attack') {
        const target = this.findAutoAttackTarget(entity);
        if (target) {
          this.combat.attemptAutoAttack(entity.id, target.id);
        }
      }
    }

    // Update projectiles
    this.updateProjectiles(dt);
  }

  private findAutoAttackTarget(entity: GameEntity): GameEntity | null {
    // Find nearest enemy in range
    let closest: GameEntity | null = null;
    let closestDist = Infinity;

    for (const other of Object.values(this.state.entities)) {
      if (other.team === entity.team) continue;
      if (this.isDead(other)) continue;

      const dist = this.physics.distance(entity.position, other.position);
      if (dist <= entity.stats.currentRange && dist < closestDist) {
        closestDist = dist;
        closest = other;
      }
    }

    return closest;
  }

  // ==========================================
  // PROJECTILES
  // ==========================================

  private updateProjectiles(dt: number): void {
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
      } else {
        // Check for any enemy in hitbox
        for (const entity of Object.values(this.state.entities)) {
          if (entity.team === this.state.entities[projectile.ownerId]?.team) continue;
          if (this.isDead(entity)) continue;
          
          if (this.physics.distance(projectile.position, entity.position) < projectile.hitboxRadius + 30) {
            this.dealDamage(projectile.ownerId, entity.id, projectile.damage, projectile.damageType, projectile.source);
            projectile.isActive = false;
            toRemove.push(projectile.id);
            break;
          }
        }
      }
    }

    // Remove expired projectiles
    this.state.projectiles = this.state.projectiles.filter((p) => !toRemove.includes(p.id));
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
    // true damage bypasses resistances

    // Consume shields
    finalDamage = this.combat.consumeShield(targetId, finalDamage);

    // Apply damage
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

    this.addGameEvent('damage', event);
    this.emit('damage', event);

    // Check for tower targeting
    if (type === 'physical' && source.type === 'champion' && target.type === 'champion') {
      const towerTargeting = this.towers.getTowerTargeting(targetId);
      if (!towerTargeting) {
        // Aggro nearest tower
        // This would need to find the tower - simplified for now
      }
    }

    if (event.isKill) {
      this.handleKill(sourceId, targetId);
    }

    return event;
  }

  private handleKill(killerId: string, victimId: string): void {
    const killer = this.state.entities[killerId];
    const victim = this.state.entities[victimId];

    if (!killer || !victim) return;

    // Update kill counts
    if (killer.type === 'champion') {
      killer.current.killCount++;
    }
    if (victim.type === 'champion') {
      victim.current.deathCount++;
    }

    // Minion kill handling
    if (victim.type === 'minion') {
      this.minions.handleMinionDeath(victimId, killerId);
    }

    // Tower handling
    if (victim.type === 'tower') {
      this.towers.handleTowerKill(victimId, killerId);
    }

    // Gold reward
    const goldReward = this.calculateGoldReward(killer, victim);
    if (killer.type === 'champion') {
      killer.current.gold += goldReward;
    }

    // Find assists
    const assists = this.findAssists(victimId);
    assists.forEach((assistantId) => {
      const assistant = this.state.entities[assistantId];
      if (assistant && assistant.type === 'champion') {
        assistant.current.assistCount++;
        assistant.current.gold += 50;
      }
    });

    // Death event
    const deathEvent: DeathEvent = {
      entityId: victimId,
      killerId,
      assistIds: assists,
      goldReward,
      timestamp: Date.now(),
    };
    this.addGameEvent('champion_kill', deathEvent);
    this.emit('kill', deathEvent);

    // Respawn champions
    if (victim.type === 'champion') {
      this.scheduleRespawn(victimId);
    }
  }

  private scheduleRespawn(entityId: string): void {
    const entity = this.state.entities[entityId];
    if (!entity) return;

    const respawnTime = this.getRespawnTime(entity);
    entity.states.push({ type: 'dead', startTime: this.state.time, duration: respawnTime });

    setTimeout(() => {
      if (this.state.entities[entityId]) {
        entity.states = entity.states.filter((s) => s.type !== 'dead');
        this.respawnEntity(entityId);
      }
    }, respawnTime * 1000);
  }

  private respawnEntity(entityId: string): void {
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
    return Math.max(8, level * 2.5 + 5);
  }

  private findAssists(victimId: string): string[] {
    // Simplified - in production would track recent damage
    return [];
  }

  private calculateGoldReward(killer: GameEntity, victim: GameEntity): number {
    if (victim.type === 'minion') {
      return victim.current.gold;
    }
    if (victim.type === 'champion') {
      const bounty = GAME_CONSTANTS.KILL_GOLD_BASE + Math.floor(victim.current.gold / 100);
      return Math.min(bounty, 1000);
    }
    return 0;
  }

  // ==========================================
  // ABILITIES
  // ==========================================

  useAbility(casterId: string, ability: AbilityUse): void {
    this.abilities.useAbility(casterId, ability);
  }

  levelUpAbility(entityId: string, abilityKey: 'Q' | 'W' | 'E' | 'R'): void {
    this.abilities.levelUp(entityId, abilityKey);
  }

  // ==========================================
  // MOVEMENT & ORDERS
  // ==========================================

  moveOrder(entityId: string, target: Vector2): void {
    const entity = this.state.entities[entityId];
    if (!entity || this.isDead(entity)) return;

    const dx = target.x - entity.position.x;
    const dy = target.y - entity.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      entity.velocity = {
        x: (dx / dist) * entity.stats.currentMoveSpeed,
        y: (dy / dist) * entity.stats.currentMoveSpeed,
      };
    }

    entity.model.animation = 'move';
    this.emit('moveOrder', { entityId, target });
  }

  attackOrder(entityId: string, targetId: string): void {
    const entity = this.state.entities[entityId];
    const target = this.state.entities[targetId];
    if (!entity || !target || this.isDead(entity) || this.isDead(target)) return;

    entity.model.animation = 'attack';
    this.emit('attackOrder', { entityId, targetId });
  }

  stopOrder(entityId: string): void {
    const entity = this.state.entities[entityId];
    if (!entity) return;

    entity.velocity = { x: 0, y: 0 };
    entity.model.animation = 'idle';
    this.emit('stopOrder', { entityId });
  }

  // ==========================================
  // RECALL & TELEPORT
  // ==========================================

  startRecall(entityId: string): void {
    const entity = this.state.entities[entityId];
    if (!entity) return;

    // Cancel if in combat or low HP
    if (entity.current.health < entity.current.maxHealth * GAME_CONSTANTS.RECALL_HP_THRESHOLD) {
      return;
    }

    entity.states.push({
      type: 'recalling',
      startTime: this.state.time,
      duration: GAME_CONSTANTS.RECALL_TIME,
    });

    this.emit('recallStarted', { entityId, duration: GAME_CONSTANTS.RECALL_TIME });
  }

  cancelRecall(entityId: string): void {
    const entity = this.state.entities[entityId];
    if (!entity) return;

    entity.states = entity.states.filter((s) => s.type !== 'recalling');
    this.emit('recallCancelled', { entityId });
  }

  // ==========================================
  // PINGS
  // ==========================================

  ping(entityId: string, position: Vector2, type: 'onMyWay' | 'danger' | 'missing' | 'vision', targetId?: string): void {
    this.addGameEvent('ping', { entityId, position, type, targetId });
    this.emit('ping', { entityId, position, type, targetId });
  }

  // ==========================================
  // SURRENDER
  // ==========================================

  initiateSurrenderVote(entityId: string): void {
    if (this.state.time < GAME_CONSTANTS.MIN_GAME_DURATION) return;

    const entity = this.state.entities[entityId];
    if (!entity) return;

    const teamVotes = this.surrenderVotes.get(entity.team);
    if (!teamVotes || teamVotes.inProgress) return;

    teamVotes.inProgress = true;
    teamVotes.yes.clear();
    teamVotes.no.clear();
    teamVotes.yes.add(entityId);

    this.emit('surrenderVoteStarted', { team: entity.team, initiatorId: entityId });

    // Auto-fail after timeout
    setTimeout(() => {
      const votes = this.surrenderVotes.get(entity.team);
      if (votes && votes.inProgress) {
        this.endSurrenderVote(entity.team, false);
      }
    }, GAME_CONSTANTS.SURRENDER_VOTE_TIMEOUT * 1000);
  }

  voteSurrender(entityId: string, vote: boolean): void {
    const entity = this.state.entities[entityId];
    if (!entity) return;

    const teamVotes = this.surrenderVotes.get(entity.team);
    if (!teamVotes || !teamVotes.inProgress) return;

    if (vote) {
      teamVotes.yes.add(entityId);
    } else {
      teamVotes.no.add(entityId);
    }

    this.emit('surrenderVote', { entityId, vote });

    // Check if majority reached
    this.checkSurrenderVote(entity.team);
  }

  private checkSurrenderVote(team: TeamSide): void {
    const teamVotes = this.surrenderVotes.get(team);
    if (!teamVotes || !teamVotes.inProgress) return;

    const teamPlayerCount = Array.from(this.players.values()).filter(p => p.team === team).length;
    const requiredVotes = Math.ceil(teamPlayerCount / 2);

    if (teamVotes.yes.size >= requiredVotes) {
      this.endSurrenderVote(team, true);
    } else if (teamVotes.yes.size + teamVotes.no.size >= teamPlayerCount) {
      this.endSurrenderVote(team, false);
    }
  }

  private endSurrenderVote(team: TeamSide, passed: boolean): void {
    const teamVotes = this.surrenderVotes.get(team);
    if (!teamVotes) return;

    teamVotes.inProgress = false;
    this.emit('surrenderVoteEnded', { team, passed });

    if (passed) {
      this.endGame(team === 'blue' ? 'red' : 'blue'); // Other team wins
    }
  }

  private checkSurrender(): void {
    // Check if surrender should be enabled based on game duration
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

  private updateBuffs(entity: GameEntity, _dt: number): void {
    // Buffs are handled by CombatSystem
  }

  private applyStates(entity: GameEntity, _dt: number): void {
    // States are handled by CombatSystem
  }

  // ==========================================
  // AI
  // ==========================================

  addAIPlayer(userId: string, team: TeamSide, difficulty: 'easy' | 'medium' | 'hard'): void {
    const ai = new AIGuy(userId, this, team, difficulty);
    this.aiPlayers.set(userId, ai);
    
    // Spawn AI champion
    const championId = this.getRandomChampionId();
    this.spawnChampion(userId, team, championId, this.players.size);
    this.items.initializeEntity(userId);
    this.abilities.initializeAbilityLevels(userId);
    
    ai.start();
    logger.info(`🤖 AI player added: ${userId} (${difficulty})`);
  }

  private getRandomChampionId(): string {
    const champions = ['ahri', 'garen', 'jinx', 'lux', 'yasuo', 'nasus', 'thresh', 'leesin'];
    return champions[Math.floor(Math.random() * champions.length)];
  }

  private updateAI(_dt: number): void {
    for (const ai of this.aiPlayers.values()) {
      ai.update(_dt);
    }
  }

  // ==========================================
  // WIN CONDITION
  // ==========================================

  private checkWinCondition(): void {
    const blueNexus = this.state.entities['blue-nexus'];
    const redNexus = this.state.entities['red-nexus'];

    if (!blueNexus || !redNexus) return;

    if (this.isDead(blueNexus)) {
      this.endGame('red');
    } else if (this.isDead(redNexus)) {
      this.endGame('blue');
    }
  }

  private updateTeamStats(): void {
    // Update team gold
    for (const entity of Object.values(this.state.entities)) {
      if (entity.type === 'champion') {
        const teamIndex = entity.team === 'blue' ? 0 : 1;
        this.state.teams[teamIndex].gold += entity.current.gold;
      }
    }

    // Count towers
    let blueTowers = 0, redTowers = 0;
    for (const entity of Object.values(this.state.entities)) {
      if (entity.type === 'tower') {
        if (entity.team === 'blue') blueTowers++;
        else redTowers++;
      }
    }
    this.state.teams[0].towers = blueTowers;
    this.state.teams[1].towers = redTowers;
  }

  private endGame(winner: TeamSide): void {
    if (this.state.phase === 'end') return;

    this.state.phase = 'end';
    this.stop();

    // Update final stats
    for (const entity of Object.values(this.state.entities)) {
      if (entity.type === 'champion') {
        const teamIndex = entity.team === 'blue' ? 0 : 1;
        if (entity.team === winner) {
          this.state.teams[teamIndex].kills += entity.current.killCount;
        }
      }
    }

    this.addGameEvent('game_end', { winner, duration: this.state.time });
    this.emit('gameEnded', { winner, duration: this.state.time });

    logger.info(`🏆 Game ${this.id} ended. Winner: ${winner} after ${this.state.time.toFixed(0)}s`);
  }

  // ==========================================
  // NETWORKING
  // ==========================================

  private emitState(): void {
    // Only send snapshot periodically
    if (this.tick - this.lastSnapshotTick < this.snapshotInterval) {
      return;
    }
    this.lastSnapshotTick = this.tick;

    this.emit('stateUpdate', this.getSnapshot());
  }

  getSnapshot(): GameState {
    return { ...this.state };
  }

  getEntityState(entityId: string): Partial<GameEntity> | null {
    const entity = this.state.entities[entityId];
    return entity ? { ...entity } : null;
  }

  // ==========================================
  // PROJECTILES
  // ==========================================

  createProjectile(config: {
    ownerId: string;
    position: Vector2;
    velocity: Vector2;
    speed: number;
    damage: number;
    damageType: 'physical' | 'magic' | 'true';
    ability: AbilityUse;
    hitboxRadius: number;
    maxDistance: number;
    targetId?: string;
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
      source: config.ability,
      hitboxRadius: config.hitboxRadius,
      maxDistance: config.maxDistance,
      traveled: 0,
      pierced: [],
      startTime: this.state.time,
      isActive: true,
    };

    this.state.projectiles.push(projectile);
    return projectile;
  }

  // ==========================================
  // STAT HELPERS (for CombatSystem)
  // ==========================================

  getItemStat(entityId: string, statName: string): number {
    return this.items.getItemStat(entityId, statName);
  }

  getItemBonuses(entityId: string): any {
    return this.items.getItemBonuses(entityId);
  }

  recalculateEntityStats(entityId: string): void {
    // Delegate to combat system
  }

  // ==========================================
  // EVENTS
  // ==========================================

  public addGameEvent(type: string, data: any): void {
    this.state.events.push({
      id: uuid(),
      type: type as any,
      timestamp: this.state.time,
      data,
    });

    // Keep events bounded
    if (this.state.events.length > 1000) {
      this.state.events = this.state.events.slice(-500);
    }
  }

  private setupEventHandlers(): void {
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
        { id: 'blue', kills: 0, towers: 11, dragons: 0, barons: 0, gold: 0 },
        { id: 'red', kills: 0, towers: 11, dragons: 0, barons: 0, gold: 0 },
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
}
