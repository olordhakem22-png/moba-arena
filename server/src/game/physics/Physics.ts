/**
 * Physics - Pathfinding, collision, movement
 */
import type { GameEntity, Vector2 } from '../../../shared/src/types/game';
import { MAP_CONFIG, GAME_CONSTANTS } from '../../../shared/src/constants/game';
import type { GameEngine } from '../engine/GameEngine';

export class Physics {
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  // ==========================================
  // MOVEMENT
  // ==========================================

  moveEntity(entity: GameEntity, dt: number): void {
    const target = entity.model.animation === 'move' ? this.getMoveTarget(entity) : null;
    if (!target) return;

    const pos = entity.position;
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < GAME_CONSTANTS.MINION_WAYPOINT_THRESHOLD) {
      entity.velocity = { x: 0, y: 0 };
      return;
    }

    // Normalize and apply speed
    const speed = entity.stats.currentMoveSpeed;
    const vx = (dx / dist) * speed * dt;
    const vy = (dy / dist) * speed * dt;

    const newX = pos.x + vx;
    const newY = pos.y + vy;

    // Check terrain collision
    if (!this.checkTerrainCollision({ x: newX, y: newY })) {
      entity.position.x = newX;
      entity.position.y = newY;
      entity.facing = Math.atan2(dy, dx);
    } else {
      // Try to slide along the obstacle
      const slideX = this.trySlide(entity, { x: vx, y: 0 });
      const slideY = this.trySlide(entity, { x: 0, y: vy });
      entity.velocity = { x: 0, y: 0 };
    }

    // Check bounds
    entity.position.x = Math.max(0, Math.min(MAP_CONFIG.MAP_WIDTH, entity.position.x));
    entity.position.y = Math.max(0, Math.min(MAP_CONFIG.MAP_HEIGHT, entity.position.y));
  }

  private getMoveTarget(entity: GameEntity): Vector2 | null {
    // For champions with explicit move orders, stored in a movement target field
    // Simplified: entity velocity direction is the move direction
    return null; // Override in subclass or use entity.targetPosition
  }

  private trySlide(entity: GameEntity, delta: { x: number; y: number }): Vector2 {
    const pos = entity.position;
    const newPos = { x: pos.x + delta.x, y: pos.y + delta.y };

    if (!this.checkTerrainCollision(newPos)) {
      entity.position = newPos;
      return newPos;
    }
    return pos;
  }

  // ==========================================
  // COLLISION
  // ==========================================

  checkTerrainCollision(pos: Vector2): boolean {
    // Check map boundaries
    if (pos.x < 0 || pos.x > MAP_CONFIG.MAP_WIDTH || pos.y < 0 || pos.y > MAP_CONFIG.MAP_HEIGHT) {
      return true;
    }

    // Check wall collision (simplified - use actual terrain data)
    // In production, this checks the terrain grid
    return this.checkWallCollision(pos);
  }

  private checkWallCollision(pos: Vector2): boolean {
    // River avoidance paths (simplified)
    const center = MAP_CONFIG.centerX;
    const riverWidth = 600;

    // Diagonal walls
    if (pos.x < center && pos.y < center) {
      // Blue base - allow movement in base
      return false;
    }
    if (pos.x > center && pos.y > center) {
      // Red base - allow movement in base
      return false;
    }

    return false; // Simplified - real implementation uses grid-based terrain
  }

  checkEntityCollision(pos: Vector2, radius: number, excludeId?: string): GameEntity | null {
    for (const entity of Object.values(this.engine.state.entities)) {
      if (entity.id === excludeId) continue;
      if (this.engine.isDead(entity)) continue;

      const dist = this.distance(pos, entity.position);
      const entityRadius = this.getEntityRadius(entity);

      if (dist < radius + entityRadius) {
        return entity;
      }
    }
    return null;
  }

  checkAOE(pos: Vector2, radius: number, team: string): GameEntity[] {
    const inRange: GameEntity[] = [];
    for (const entity of Object.values(this.engine.state.entities)) {
      if (entity.team === team) continue;
      if (this.engine.isDead(entity)) continue;

      if (this.distance(pos, entity.position) <= radius) {
        inRange.push(entity);
      }
    }
    return inRange;
  }

  // ==========================================
  // DISTANCE & GEOMETRY
  // ==========================================

  distance(a: Vector2, b: Vector2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  distanceSquared(a: Vector2, b: Vector2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return dx * dx + dy * dy;
  }

  angle(from: Vector2, to: Vector2): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  lerp(a: Vector2, b: Vector2, t: number): Vector2 {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
  }

  normalize(v: Vector2): Vector2 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
  }

  magnitude(v: Vector2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  isInRange(from: Vector2, to: Vector2, range: number): boolean {
    return this.distanceSquared(from, to) <= range * range;
  }

  // ==========================================
  // LINE OF SIGHT
  // ==========================================

  hasLineOfSight(from: Vector2, to: Vector2): boolean {
    const dist = this.distance(from, to);
    const steps = Math.ceil(dist / 50);

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const point = this.lerp(from, to, t);
      if (this.checkTerrainCollision(point)) {
        return false;
      }
    }
    return true;
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private getEntityRadius(entity: GameEntity): number {
    switch (entity.type) {
      case 'champion': return 40;
      case 'minion': return 20;
      case 'tower': return 100;
      case 'nexus': return 150;
      default: return 30;
    }
  }

  // ==========================================
  // PATHFINDING (A* simplified)
  // ==========================================

  findPath(from: Vector2, to: Vector2): Vector2[] {
    // Simplified A* - in production use navmesh or grid-based A*
    const directPath = this.tryDirectPath(from, to);
    if (directPath) return directPath;

    // Fallback: direct path with wall avoidance
    return [to];
  }

  private tryDirectPath(from: Vector2, to: Vector2): Vector2[] | null {
    const dist = this.distance(from, to);
    const steps = Math.ceil(dist / 50);
    const angle = this.angle(from, to);

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const point = this.lerp(from, to, t);
      if (this.checkTerrainCollision(point)) {
        return null;
      }
    }
    return [to];
  }

  // ==========================================
  // CONE & RECT
  // ==========================================

  isInCone(origin: Vector2, target: Vector2, coneOrigin: Vector2, angle: number, range: number): boolean {
    const dist = this.distance(coneOrigin, target);
    if (dist > range) return false;

    const angleToTarget = this.angle(coneOrigin, target);
    const angleDiff = Math.abs(this.normalizeAngle(angleToTarget - angle));
    return angleDiff < Math.PI / 6; // 60 degree cone
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  // ==========================================
  // UPDATE
  // ==========================================

  update(_dt: number): void {
    // Physics is stateless - all operations are called directly
  }
}
