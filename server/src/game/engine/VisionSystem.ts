/**
 * VisionSystem - Fog of war, sight range, wards
 */
import type { GameEntity, TeamSide, Vector2 } from '../../../../shared/src/types/game';
import { GAME_CONSTANTS } from '../../../../shared/src/constants/game';
import type { GameEngine } from './GameEngine';

export class VisionSystem {
  private engine: GameEngine;
  private wards: Map<string, WardData> = new Map();

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  isVisible(entityId: string, forTeam: TeamSide): boolean {
    const entity = this.engine.getEntity(entityId);
    if (!entity) return false;

    // Own team always sees own units
    if (entity.team === forTeam) return true;

    // Check if any ally has vision
    const allies = this.engine.getTeam(forTeam);
    for (const ally of allies) {
      if (this.hasVisionOf(ally, entity)) return true;
    }

    return false;
  }

  private hasVisionOf(viewer: GameEntity, target: GameEntity): boolean {
    const dist = this.getDistance(viewer.position, target.position);
    const sightRange = GAME_CONSTANTS.SIGHT_RANGE_MEDIUM;

    if (dist > sightRange) return false;

    // Check line of sight
    return this.engine.state.entities[viewer.id] !== undefined;
  }

  getVisibleEntities(forTeam: TeamSide): string[] {
    const visible: string[] = [];

    for (const entity of Object.values(this.engine.state.entities)) {
      if (this.isVisible(entity.id, forTeam)) {
        visible.push(entity.id);
      }
    }

    return visible;
  }

  placeWard(entityId: string, position: Vector2, type: 'normal' | 'control'): boolean {
    const entity = this.engine.getEntity(entityId);
    if (!entity) return false;

    const ward: WardData = {
      id: `ward-${Date.now()}`,
      ownerId: entityId,
      team: entity.team,
      position,
      type,
      duration: type === 'normal' ? 180 : 240,
      startTime: this.engine.state.time,
      isActive: true,
    };

    this.wards.set(ward.id, ward);
    return true;
  }

  revealArea(position: Vector2, radius: number, forTeam: TeamSide, duration: number): void {
    this.engine.state.effects.push({
      id: `reveal-${Date.now()}`,
      type: 'vision',
      position,
      startTime: this.engine.state.time,
      duration,
      data: { radius, team: forTeam },
    });
  }

  private getDistance(a: Vector2, b: Vector2): number {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  }

  update(_dt: number): void {
    // Remove expired wards
    const now = this.engine.state.time;
    for (const [id, ward] of this.wards) {
      if (now - ward.startTime > ward.duration) {
        ward.isActive = false;
        this.wards.delete(id);
      }
    }
  }
}

interface WardData {
  id: string;
  ownerId: string;
  team: TeamSide;
  position: Vector2;
  type: 'normal' | 'control';
  duration: number;
  startTime: number;
  isActive: boolean;
}
