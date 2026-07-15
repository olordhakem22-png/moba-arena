/**
 * MinionManager - Spawning, pathing, combat AI for minions
 * Handles minion waves every 30 seconds with proper lane routing
 */
import { v4 as uuid } from 'uuid';
import type { GameEntity, Vector2, TeamSide, MinionType } from '@shared/types/game';
import { GAME_CONSTANTS, MAP_CONFIG } from '@shared/constants/game';
import type { GameEngine } from './GameEngine';
import { Physics } from '../physics/Physics';

interface MinionData {
  type: MinionType;
  waypoints: Vector2[];
  currentWaypointIndex: number;
  aggroTargetId?: string;
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  lastAttackTime: number;
  isAggressive: boolean;
  lane: 'top' | 'mid' | 'bot';
}

export class MinionManager {
  private engine: GameEngine;
  private physics: Physics;
  private nextWaveTime: Map<string, number> = new Map([
    ['blue', GAME_CONSTANTS.MINION_FIRST_SPAWN],
    ['red', GAME_CONSTANTS.MINION_FIRST_SPAWN],
  ]);
  private waveCount: Map<string, number> = new Map([
    ['blue', 0],
    ['red', 0],
  ]);
  private minions: Map<string, MinionData> = new Map();
  private superMinionActive: Map<string, boolean> = new Map([
    ['blue', false],
    ['red', false],
  ]);

  // Lane waypoints (simplified paths to enemy nexus)
  private laneWaypoints = {
    top: {
      blue: [
        { x: 1380, y: 1380 },
        { x: 5000, y: 1380 },
        { x: 9000, y: 1380 },
        { x: 11000, y: 3380 },
        { x: 12000, y: 5380 },
        { x: 13000, y: 10000 },
        { x: 13450, y: 13450 },
      ],
      red: [
        { x: 13490, y: 13490 },
        { x: 9880, y: 13490 },
        { x: 5880, y: 13490 },
        { x: 3880, y: 11090 },
        { x: 2880, y: 9080 },
        { x: 1880, y: 4870 },
        { x: 1380, y: 1380 },
      ],
    },
    mid: {
      blue: [
        { x: 1380, y: 1380 },
        { x: 4000, y: 4000 },
        { x: 6000, y: 6000 },
        { x: 8000, y: 8000 },
        { x: 10000, y: 10000 },
        { x: 13450, y: 13450 },
      ],
      red: [
        { x: 13490, y: 13490 },
        { x: 9880, y: 9880 },
        { x: 7880, y: 7880 },
        { x: 5880, y: 5880 },
        { x: 3880, y: 3880 },
        { x: 1380, y: 1380 },
      ],
    },
    bot: {
      blue: [
        { x: 1380, y: 1380 },
        { x: 1380, y: 5000 },
        { x: 1380, y: 9000 },
        { x: 3380, y: 11000 },
        { x: 5380, y: 12000 },
        { x: 10000, y: 13000 },
        { x: 13450, y: 13450 },
      ],
      red: [
        { x: 13490, y: 13490 },
        { x: 13490, y: 9880 },
        { x: 13490, y: 5880 },
        { x: 11090, y: 3880 },
        { x: 9080, y: 2880 },
        { x: 4870, y: 1880 },
        { x: 1380, y: 1380 },
      ],
    },
  };

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.physics = new Physics(engine);
  }

  // ==========================================
  // SPAWNING
  // ==========================================

  update(dt: number): void {
    const time = this.engine.state.time;

    // Check if it's time to spawn a wave
    for (const team of ['blue', 'red'] as const) {
      const nextWave = this.nextWaveTime.get(team);
      if (nextWave && time >= nextWave) {
        this.spawnWave(team, time);
        this.nextWaveTime.set(team, time + GAME_CONSTANTS.MINION_SPAWN_INTERVAL);
        this.waveCount.set(team, (this.waveCount.get(team) || 0) + 1);
      }
    }

    // Update all minions
    this.updateMinions(dt);
  }

  private spawnWave(team: 'blue' | 'red', time: number): void {
    const waveNumber = this.waveCount.get(team) || 0;
    const spawnPos = team === 'blue' ? { ...MAP_CONFIG.BLUE_SPAWN } : { ...MAP_CONFIG.RED_SPAWN };

    // Check if super minions should spawn
    const shouldSpawnSuper = this.checkSuperMinionCondition(team);

    for (const lane of ['top', 'mid', 'bot'] as const) {
      // Melee minions (3)
      for (let i = 0; i < 3; i++) {
        const offset = this.getLaneSpawnOffset(lane);
        const pos = {
          x: spawnPos.x + offset.x + (i - 1) * 50,
          y: spawnPos.y + offset.y + (i - 1) * 50,
        };
        this.spawnMinion(team, 'melee', pos, lane);
      }

      // Ranged minions (3)
      for (let i = 0; i < 3; i++) {
        const offset = this.getLaneSpawnOffset(lane);
        const pos = {
          x: spawnPos.x + offset.x + 80 + (i - 1) * 40,
          y: spawnPos.y + offset.y + 80 + (i - 1) * 40,
        };
        this.spawnMinion(team, 'ranged', pos, lane);
      }

      // Cannon minion (every 3rd wave)
      if (waveNumber % 3 === 0) {
        const offset = this.getLaneSpawnOffset(lane);
        const pos = {
          x: spawnPos.x + offset.x + 120,
          y: spawnPos.y + offset.y + 120,
        };
        this.spawnMinion(team, 'cannon', pos, lane);
      }
    }

    // Super minions if conditions met
    if (shouldSpawnSuper) {
      for (const lane of ['top', 'mid', 'bot'] as const) {
        const offset = this.getLaneSpawnOffset(lane);
        const pos = {
          x: spawnPos.x + offset.x + 200,
          y: spawnPos.y + offset.y + 200,
        };
        this.spawnMinion(team, 'super', pos, lane);
      }
      this.superMinionActive.set(team, true);
    }

    this.engine.emit('minionWaveSpawned', { team, waveNumber, time });
  }

  private checkSuperMinionCondition(team: TeamSide): boolean {
    // Super minions spawn when an inhibitor is destroyed
    // For simplicity, we'll use a flag that gets set when an inhibitor dies
    return this.superMinionActive.get(team) || false;
  }

  markSuperMinionActive(team: TeamSide): void {
    this.superMinionActive.set(team, true);
  }

  private getLaneSpawnOffset(lane: 'top' | 'mid' | 'bot'): Vector2 {
    const offsets: Record<string, Vector2> = {
      top: { x: 5000, y: 0 },
      mid: { x: 3000, y: 3000 },
      bot: { x: 0, y: 5000 },
    };
    return offsets[lane];
  }

  private spawnMinion(team: 'blue' | 'red', type: MinionType, spawnPos: Vector2, lane: 'top' | 'mid' | 'bot'): GameEntity {
    const stats = this.getMinionStats(type);
    const waypoints = this.laneWaypoints[lane][team];

    const minion: GameEntity = {
      id: `${team}-${type}-${lane}-${Date.now()}-${uuid().slice(0, 8)}`,
      type: 'minion',
      team,
      position: { ...spawnPos },
      facing: 0,
      velocity: { x: 0, y: 0 },
      stats: { ...stats },
      baseStats: { ...stats },
      current: {
        health: stats.health || 455,
        maxHealth: stats.health || 455,
        mana: 0,
        maxMana: 0,
        energy: 0,
        maxEnergy: 0,
        level: 1,
        xp: type === 'super' ? 100 : type === 'cannon' ? 60 : 25,
        xpToLevel: 0,
        gold: type === 'super' ? 100 : type === 'cannon' ? 60 : 25,
        killCount: 0,
        deathCount: 0,
        assistCount: 0,
      },
      states: [],
      buffs: [],
      effects: [],
      model: {
        skinId: 'default',
        scale: type === 'cannon' ? 1.3 : type === 'super' ? 1.5 : 0.8,
        alpha: 1,
        tint: team === 'blue' ? '#1e3a5f' : '#5f1e1e',
        animation: 'move',
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

    this.engine.state.entities[minion.id] = minion;

    // Store minion data
    this.minions.set(minion.id, {
      type,
      waypoints,
      currentWaypointIndex: 0,
      aggroRange: GAME_CONSTANTS.MINION_AGGRO_RANGE,
      attackRange: stats.currentRange || 110,
      attackCooldown: 1 / stats.currentAttackSpeed,
      lastAttackTime: 0,
      isAggressive: false,
      lane,
    });

    return minion;
  }

  private getMinionStats(type: MinionType): any {
    const baseStats = {
      health: 455,
      mana: 0,
      armor: 16,
      magicResist: 0,
      moveSpeed: 325,
      attackRange: 110,
      attackDamage: 12,
      attackSpeed: 0.625,
      critChance: 0,
      critDamage: 1.75,
      spellBlock: 0,
      currentAttackSpeed: 0.625,
      currentRange: 110,
      currentMoveSpeed: 325,
      currentArmor: 16,
      currentMR: 0,
      currentAD: 12,
      currentAP: 0,
      attackSpeedMultiplier: 1,
      critMultiplier: 1.75,
      lifesteal: 0,
      armorPenetration: 0,
      magicPenetration: 0,
      cdr: 0,
    };

    switch (type) {
      case 'melee':
        return {
          ...baseStats,
          health: 455,
          attackDamage: 12,
          currentArmor: 16,
          currentRange: 110,
          currentAD: 12,
        };
      case 'ranged':
        return {
          ...baseStats,
          health: 290,
          attackDamage: 10,
          currentArmor: 8,
          currentRange: 450,
          currentAD: 10,
        };
      case 'cannon':
        return {
          ...baseStats,
          health: 700,
          attackDamage: 40,
          currentArmor: 30,
          currentRange: 300,
          currentAD: 40,
        };
      case 'super':
        return {
          ...baseStats,
          health: 2000,
          attackDamage: 65,
          currentArmor: 45,
          currentRange: 170,
          currentAD: 65,
          currentMoveSpeed: 300,
          moveSpeed: 300,
        };
      default:
        return baseStats;
    }
  }

  // ==========================================
  // MINION AI
  // ==========================================

  private updateMinions(dt: number): void {
    const minionsToRemove: string[] = [];

    for (const [minionId, minionData] of this.minions) {
      const minion = this.engine.getEntity(minionId);
      if (!minion || this.engine.isDead(minion)) {
        minionsToRemove.push(minionId);
        continue;
      }

      // Check for aggro (enemy in range)
      const aggroTarget = this.findAggroTarget(minion, minionData);
      
      if (aggroTarget) {
        // Combat mode
        this.updateMinionCombat(minion, minionData, aggroTarget, dt);
      } else {
        // Movement mode (following waypoints)
        this.updateMinionMovement(minion, minionData, dt);
      }

      // Check if minion should be removed (reached nexus)
      if (this.hasReachedDestination(minion, minionData)) {
        minionsToRemove.push(minionId);
      }
    }

    // Clean up dead/removed minions
    for (const id of minionsToRemove) {
      this.minions.delete(id);
      delete this.engine.state.entities[id];
    }
  }

  private findAggroTarget(minion: GameEntity, minionData: MinionData): GameEntity | null {
    // Priority: enemy minions > enemy champions
    let closestMinion: GameEntity | null = null;
    let closestMinionDist = Infinity;
    let closestChampion: GameEntity | null = null;
    let closestChampionDist = Infinity;

    for (const entity of Object.values(this.engine.state.entities)) {
      if (entity.team === minion.team) continue;
      if (this.engine.isDead(entity)) continue;

      const dist = this.physics.distance(minion.position, entity.position);
      if (dist > minionData.aggroRange) continue;

      if (entity.type === 'minion') {
        if (dist < closestMinionDist) {
          closestMinionDist = dist;
          closestMinion = entity;
        }
      } else if (entity.type === 'champion') {
        if (dist < closestChampionDist) {
          closestChampionDist = dist;
          closestChampion = entity;
        }
      }
    }

    // Return closest minion if in range, otherwise champion
    return closestMinion || closestChampion;
  }

  private updateMinionCombat(minion: GameEntity, minionData: MinionData, target: GameEntity, dt: number): void {
    const dist = this.physics.distance(minion.position, target.position);
    const attackRange = minionData.attackRange;

    // Face the target
    minion.facing = this.physics.angle(minion.position, target.position);

    if (dist <= attackRange) {
      // In attack range - attack
      this.minionAttack(minion, minionData, target);
    } else {
      // Move toward target
      const angle = this.physics.angle(minion.position, target.position);
      minion.velocity = {
        x: Math.cos(angle) * minion.stats.currentMoveSpeed,
        y: Math.sin(angle) * minion.stats.currentMoveSpeed,
      };
      minion.model.animation = 'move';
    }
  }

  private minionAttack(minion: GameEntity, minionData: MinionData, target: GameEntity): void {
    const now = this.engine.state.time;

    // Check cooldown
    if (now - minionData.lastAttackTime < minionData.attackCooldown) return;

    // Deal damage
    const damage = minion.stats.currentAD;
    this.engine.dealDamage(minion.id, target.id, damage, 'physical');

    minionData.lastAttackTime = now;
    minion.model.animation = 'attack';

    // Emit event
    this.engine.emit('minionAttack', {
      minionId: minion.id,
      targetId: target.id,
      damage,
      timestamp: now,
    });
  }

  private updateMinionMovement(minion: GameEntity, minionData: MinionData, dt: number): void {
    // Check if reached current waypoint
    const currentWaypoint = minionData.waypoints[minionData.currentWaypointIndex];
    if (!currentWaypoint) return;

    const dist = this.physics.distance(minion.position, currentWaypoint);

    if (dist < GAME_CONSTANTS.MINION_WAYPOINT_THRESHOLD) {
      // Move to next waypoint
      minionData.currentWaypointIndex++;
      if (minionData.currentWaypointIndex >= minionData.waypoints.length) {
        // Reached destination
        return;
      }
    }

    // Move toward current waypoint
    const angle = this.physics.angle(minion.position, currentWaypoint);
    minion.velocity = {
      x: Math.cos(angle) * minion.stats.currentMoveSpeed,
      y: Math.sin(angle) * minion.stats.currentMoveSpeed,
    };
    minion.facing = angle;
    minion.model.animation = 'move';
  }

  private hasReachedDestination(minion: GameEntity, minionData: MinionData): boolean {
    // Check if minion reached the last waypoint (enemy nexus area)
    if (minionData.currentWaypointIndex >= minionData.waypoints.length - 1) {
      const lastWaypoint = minionData.waypoints[minionData.waypoints.length - 1];
      const dist = this.physics.distance(minion.position, lastWaypoint);
      return dist < GAME_CONSTANTS.MINION_WAYPOINT_THRESHOLD;
    }
    return false;
  }

  // ==========================================
  // MINION DEATH
  // ==========================================

  handleMinionDeath(minionId: string, killerId: string): void {
    const minionData = this.minions.get(minionId);
    if (!minionData) return;

    const killer = this.engine.getEntity(killerId);
    if (!killer) return;

    // Award gold
    const goldReward = minionData.type === 'super' ? 100 : minionData.type === 'cannon' ? 60 : 25;
    killer.current.gold += goldReward;

    // Award XP to nearby allies
    this.shareXP(minionId, minionData.type);

    // Event
    this.engine.addGameEvent('minion_kill', {
      minionId,
      minionType: minionData.type,
      killerId,
      goldReward,
    });

    // Remove from tracking
    this.minions.delete(minionId);
  }

  private shareXP(minionId: string, minionType: MinionType): void {
    const minion = this.engine.getEntity(minionId);
    if (!minion) return;

    const xpValue = minionType === 'super' ? 100 : minionType === 'cannon' ? 60 : 25;
    const shareRadius = 1500; // XP range

    // Find nearby allies
    for (const entity of Object.values(this.engine.state.entities)) {
      if (entity.team !== minion.team) continue;
      if (entity.type !== 'champion') continue;

      const dist = this.physics.distance(minion.position, entity.position);
      if (dist <= shareRadius) {
        entity.current.xp += xpValue;
        
        // Check for level up
        this.checkLevelUp(entity);
      }
    }
  }

  private checkLevelUp(entity: GameEntity): void {
    if (entity.current.xp >= entity.current.xpToLevel) {
      const newLevel = entity.current.level + 1;
      if (newLevel > 18) return; // Max level

      entity.current.level = newLevel;
      entity.current.xp -= entity.current.xpToLevel;
      entity.current.xpToLevel = this.getXPToNextLevel(newLevel);

      // Increase stats
      entity.stats.health += entity.baseStats.healthPerLevel || 0;
      entity.stats.attackDamage += entity.baseStats.attackDamagePerLevel || 0;
      entity.stats.armor += entity.baseStats.armorPerLevel || 0;
      entity.stats.magicResist += entity.baseStats.magicResistPerLevel || 0;

      // Recalculate current stats
      this.engine.recalculateEntityStats(entity.id);

      this.engine.emit('levelUp', {
        entityId: entity.id,
        newLevel,
        timestamp: this.engine.state.time,
      });
    }
  }

  private getXPToNextLevel(level: number): number {
    // XP curve from constants
    const xpTable = [0, 280, 660, 1140, 1720, 2400, 3180, 4060, 5040, 6120, 7300, 8580, 9960, 11440, 13020, 14700, 16480, 18360];
    return xpTable[level] || 20000;
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  getMinionCount(team: TeamSide): number {
    let count = 0;
    for (const [minionId] of this.minions) {
      const minion = this.engine.getEntity(minionId);
      if (minion && minion.team === team) count++;
    }
    return count;
  }

  getMinionsInLane(team: TeamSide, lane: 'top' | 'mid' | 'bot'): string[] {
    const result: string[] = [];
    for (const [minionId, minionData] of this.minions) {
      if (minionData.lane === lane) {
        const minion = this.engine.getEntity(minionId);
        if (minion && minion.team === team) {
          result.push(minionId);
        }
      }
    }
    return result;
  }
}
