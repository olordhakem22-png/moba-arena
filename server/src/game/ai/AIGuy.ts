/**
 * AIGuy - Bot player that makes decisions in game
 */
import type { GameEntity, Vector2, TeamSide } from '../../shared/src/types/game';
import type { GameEngine } from '../engine/GameEngine';
import { MAP_CONFIG } from '../../shared/src/constants/game';

export class AIGuy {
  private id: string;
  private engine: GameEngine;
  private team: TeamSide;
  private difficulty: 'easy' | 'medium' | 'hard';
  private role: 'top' | 'mid' | 'bot' | 'jungle' | 'support' = 'mid';
  private decisionInterval: number;
  private targetId: string | null = null;
  private state: 'farming' | 'pushing' | 'roaming' | 'teamfight' | 'defending' = 'farming';
  private lastDecision: number = 0;
  private roamTimer: number = 0;
  private laneTimer: number = 0;

  constructor(id: string, engine: GameEngine, team: TeamSide, difficulty: 'easy' | 'medium' | 'hard') {
    this.id = id;
    this.engine = engine;
    this.team = team;
    this.difficulty = difficulty;

    this.decisionInterval = difficulty === 'easy' ? 2000 : difficulty === 'medium' ? 1000 : 500;
  }

  start(): void {
    this.laneTimer = 0;
    this.roamTimer = 0;
  }

  update(dt: number): void {
    const entity = this.engine.getEntity(this.id);
    if (!entity || this.engine.isDead(entity)) return;

    this.lastDecision += dt * 1000;
    if (this.lastDecision < this.decisionInterval) return;
    this.lastDecision = 0;

    this.evaluateState();
    this.executeState();
  }

  private evaluateState(): void {
    const entity = this.engine.getEntity(this.id);
    if (!entity) return;

    const enemiesNearby = this.getEnemiesInRange(entity, 800);
    const towersNearby = this.getTowersInRange(entity, 1000);
    const healthPercent = entity.current.health / entity.current.maxHealth;

    // Determine state
    if (healthPercent < 0.3) {
      this.state = 'defending';
    } else if (enemiesNearby.length >= 3) {
      this.state = 'teamfight';
    } else if (towersNearby.length > 0 && this.isPushing()) {
      this.state = 'pushing';
    } else {
      this.state = 'farming';
    }

    // Find target
    if (enemiesNearby.length > 0) {
      this.targetId = enemiesNearby[0].id;
    } else {
      this.targetId = null;
    }
  }

  private executeState(): void {
    const entity = this.engine.getEntity(this.id);
    if (!entity) return;

    switch (this.state) {
      case 'farming':
        this.executeFarming();
        break;
      case 'pushing':
        this.executePushing();
        break;
      case 'roaming':
        this.executeRoaming();
        break;
      case 'teamfight':
        this.executeTeamfight();
        break;
      case 'defending':
        this.executeDefending();
        break;
    }

    // Auto-attack if target in range
    if (this.targetId) {
      this.engine.attackOrder(this.id, this.targetId);
    }
  }

  private executeFarming(): void {
    const entity = this.engine.getEntity(this.id);
    if (!entity) return;

    const minions = this.getMinionsInRange(entity, entity.stats.currentRange + 200);
    if (minions.length > 0) {
      this.targetId = minions[0].id;
      this.engine.attackOrder(this.id, this.targetId);
    } else {
      // Move to lane
      this.moveToLane();
    }
  }

  private executePushing(): void {
    const entity = this.engine.getEntity(this.id);
    if (!entity) return;

    const tower = this.getNearestTower(entity);
    if (tower) {
      const dist = this.getDistance(entity.position, tower.position);
      if (dist > entity.stats.currentRange) {
        this.engine.moveOrder(this.id, tower.position);
      } else {
        this.targetId = tower.id;
        this.engine.attackOrder(this.id, tower.id);
      }
    }
  }

  private executeRoaming(): void {
    this.roamTimer++;
    if (this.roamTimer > 10) {
      this.roamTimer = 0;
      this.state = 'farming';
    }

    const targetPos = this.team === 'blue' ? MAP_CONFIG.RED_SPAWN : MAP_CONFIG.BLUE_SPAWN;
    this.engine.moveOrder(this.id, targetPos);
  }

  private executeTeamfight(): void {
    const entity = this.engine.getEntity(this.id);
    if (!entity) return;

    // Target lowest health enemy
    const enemies = this.getEnemiesInRange(entity, 1000);
    if (enemies.length === 0) return;

    const lowestHealth = enemies.reduce((prev, curr) => {
      const prevHP = prev.current.health / prev.current.maxHealth;
      const currHP = curr.current.health / curr.current.maxHealth;
      return currHP < prevHP ? curr : prev;
    });

    this.targetId = lowestHealth.id;
    this.engine.attackOrder(this.id, this.targetId);
  }

  private executeDefending(): void {
    const entity = this.engine.getEntity(this.id);
    if (!entity) return;

    const basePos = this.team === 'blue' ? MAP_CONFIG.BLUE_SPAWN : MAP_CONFIG.RED_SPAWN;
    const dist = this.getDistance(entity.position, basePos);

    if (dist > 500) {
      this.engine.moveOrder(this.id, basePos);
    }

    // Try to recall
    if (entity.current.health < entity.current.maxHealth * 0.5) {
      this.engine.startRecall(this.id);
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private getEnemiesInRange(entity: GameEntity, range: number): GameEntity[] {
    const enemies: GameEntity[] = [];
    for (const other of Object.values(this.engine.state.entities)) {
      if (other.team === entity.team) continue;
      if (this.engine.isDead(other)) continue;
      if (this.getDistance(entity.position, other.position) <= range) {
        enemies.push(other);
      }
    }
    return enemies;
  }

  private getMinionsInRange(entity: GameEntity, range: number): GameEntity[] {
    const minions: GameEntity[] = [];
    for (const other of Object.values(this.engine.state.entities)) {
      if (other.type !== 'minion') continue;
      if (other.team === entity.team) continue;
      if (this.engine.isDead(other)) continue;
      if (this.getDistance(entity.position, other.position) <= range) {
        minions.push(other);
      }
    }
    return minions;
  }

  private getTowersInRange(entity: GameEntity, range: number): GameEntity[] {
    const towers: GameEntity[] = [];
    for (const other of Object.values(this.engine.state.entities)) {
      if (other.type !== 'tower') continue;
      if (this.engine.isDead(other)) continue;
      if (this.getDistance(entity.position, other.position) <= range) {
        towers.push(other);
      }
    }
    return towers;
  }

  private getNearestTower(entity: GameEntity): GameEntity | null {
    let nearest: GameEntity | null = null;
    let minDist = Infinity;

    for (const other of Object.values(this.engine.state.entities)) {
      if (other.type !== 'tower') continue;
      if (this.engine.isDead(other)) continue;
      const dist = this.getDistance(entity.position, other.position);
      if (dist < minDist) {
        minDist = dist;
        nearest = other;
      }
    }
    return nearest;
  }

  private moveToLane(): void {
    const lanePositions = this.getLanePosition();
    this.engine.moveOrder(this.id, lanePositions);
    this.laneTimer++;
    if (this.laneTimer > 30) {
      this.laneTimer = 0;
    }
  }

  private getLanePosition(): Vector2 {
    // Mid lane by default
    return {
      x: MAP_CONFIG.centerX + (this.team === 'blue' ? -2000 : 2000),
      y: MAP_CONFIG.centerY + (this.team === 'blue' ? -2000 : 2000),
    };
  }

  private isPushing(): boolean {
    const entity = this.engine.getEntity(this.id);
    if (!entity) return false;

    const minions = this.getMinionsInRange(entity, 2000);
    const ownMinions = minions.filter(m => m.team === entity.team);
    const enemyMinions = minions.filter(m => m.team !== entity.team);

    return ownMinions.length > enemyMinions.length;
  }

  private getDistance(a: Vector2, b: Vector2): number {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  }
}
