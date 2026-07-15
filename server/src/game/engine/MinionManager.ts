/**
 * MinionManager - Spawning, pathing, aggro
 */
import type { GameEntity, Vector2, MinionType } from '../../shared/src/types/game';
import { GAME_CONSTANTS, MAP_CONFIG } from '../../shared/src/constants/game';
import type { GameEngine } from './GameEngine';

export class MinionManager {
  private engine: GameEngine;
  private nextWaveTime: Map<string, number> = new Map([
    ['blue', GAME_CONSTANTS.MINION_FIRST_SPAWN],
    ['red', GAME_CONSTANTS.MINION_FIRST_SPAWN],
  ]);

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  update(dt: number): void {
    const time = this.engine.state.time;

    // Check if it's time to spawn a wave
    for (const team of ['blue', 'red'] as const) {
      const nextWave = this.nextWaveTime.get(team);
      if (nextWave && time >= nextWave) {
        this.spawnWave(team, time);
        this.nextWaveTime.set(team, time + GAME_CONSTANTS.MINION_SPAWN_INTERVAL);
      }
    }
  }

  private spawnWave(team: 'blue' | 'red', time: number): void {
    const enemy = team === 'blue' ? 'red' : 'blue';
    const spawnPos = team === 'blue' ? MAP_CONFIG.BLUE_SPAWN : MAP_CONFIG.RED_SPAWN;
    const nexusPos = team === 'blue' ? MAP_CONFIG.RED_NEXUS : MAP_CONFIG.BLUE_NEXUS;

    // Spawn one wave per lane
    for (const lane of ['top', 'mid', 'bot'] as const) {
      const laneOffset = this.getLaneOffset(lane);

      // Melee minions (3)
      for (let i = 0; i < 3; i++) {
        this.spawnMinion(team, 'melee', {
          x: spawnPos.x + laneOffset.x + (i - 1) * 40,
          y: spawnPos.y + laneOffset.y + (i - 1) * 40,
        }, nexusPos);
      }

      // Ranged minions (3)
      for (let i = 0; i < 3; i++) {
        this.spawnMinion(team, 'ranged', {
          x: spawnPos.x + laneOffset.x + 60 + (i - 1) * 40,
          y: spawnPos.y + laneOffset.y + 60 + (i - 1) * 40,
        }, nexusPos);
      }

      // Cannon minion (1, every 3rd wave starting from wave 3)
      const waveNumber = Math.floor((time - GAME_CONSTANTS.MINION_FIRST_SPAWN) / GAME_CONSTANTS.MINION_SPAWN_INTERVAL);
      if (waveNumber % 3 === 0) {
        this.spawnMinion(team, 'cannon', {
          x: spawnPos.x + laneOffset.x + 100,
          y: spawnPos.y + laneOffset.y + 100,
        }, nexusPos);
      }
    }
  }

  private spawnMinion(team: 'blue' | 'red', type: MinionType, spawnPos: Vector2, targetPos: Vector2): GameEntity {
    const stats = this.getMinionStats(type);
    const waypoints = this.calculateWaypoints(team, type, spawnPos, targetPos);

    const minion: GameEntity = {
      id: `${team}-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'minion',
      team,
      position: { ...spawnPos },
      facing: 0,
      velocity: { x: 0, y: 0 },
      stats: { ...stats },
      baseStats: { ...stats },
      current: {
        health: stats.health,
        maxHealth: stats.health,
        mana: 0,
        maxMana: 0,
        energy: 0,
        maxEnergy: 0,
        level: 1,
        xp: stats.xpValue,
        xpToLevel: 0,
        gold: stats.goldValue,
        killCount: 0,
        deathCount: 0,
        assistCount: 0,
      },
      states: [],
      buffs: [],
      effects: [],
      model: {
        skinId: 'default',
        scale: type === 'cannon' ? 1.3 : type === 'siege' ? 1.5 : 0.8,
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

    (minion as any).waypoints = waypoints;
    (minion as any).currentWaypointIndex = 0;
    (minion as any).isMinionAgressive = false;

    this.engine.state.entities[minion.id] = minion;
    return minion;
  }

  private calculateWaypoints(team: 'blue' | 'red', lane: MinionType, start: Vector2, end: Vector2): Vector2[] {
    // Simplified - direct path
    const laneOffsets: Record<string, Vector2> = {
      top: { x: 7000, y: 0 },
      mid: { x: 6000, y: 6000 },
      bot: { x: 0, y: 7000 },
    };

    const laneName = this.getLaneFromPosition(start);
    const offset = laneOffsets[laneName] || laneOffsets.mid;

    return [
      start,
      {
        x: (start.x + offset.x) / 2,
        y: (start.y + offset.y) / 2,
      },
      offset,
      end,
    ];
  }

  private getLaneFromPosition(pos: Vector2): string {
    const dx = Math.abs(pos.x - MAP_CONFIG.centerX);
    const dy = Math.abs(pos.y - MAP_CONFIG.centerY);

    if (dx < 2000 && dy < 2000) return 'mid';
    if (dx > dy) return 'top';
    return 'bot';
  }

  private getLaneOffset(lane: string): Vector2 {
    const offsets: Record<string, Vector2> = {
      top: { x: 6000, y: 0 },
      mid: { x: 4000, y: 4000 },
      bot: { x: 0, y: 6000 },
    };
    return offsets[lane] || offsets.mid;
  }

  private getMinionStats(type: MinionType): any {
    const base = {
      health: 455,
      healthPerLevel: 0,
      mana: 0,
      manaPerLevel: 0,
      armor: 16,
      armorPerLevel: 0,
      magicResist: 0,
      magicResistPerLevel: 0,
      moveSpeed: 325,
      attackRange: 110,
      attackDamage: 12,
      attackDamagePerLevel: 0,
      attackSpeed: 0.625,
      attackSpeedPerLevel: 0,
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
        return { ...base, health: 455, attackDamage: 12, armor: 16, attackRange: 110 };
      case 'ranged':
        return { ...base, health: 290, attackDamage: 10, armor: 8, attackRange: 450, currentRange: 450 };
      case 'cannon':
        return { ...base, health: 700, attackDamage: 40, armor: 30, attackRange: 300, currentRange: 300 };
      case 'super':
        return { ...base, health: 2000, attackDamage: 65, armor: 45, attackRange: 170 };
      default:
        return base;
    }
  }
}
