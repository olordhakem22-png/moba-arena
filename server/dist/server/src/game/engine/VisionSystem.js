"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionSystem = void 0;
const game_1 = require("@shared/constants/game");
class VisionSystem {
    engine;
    wards = new Map();
    constructor(engine) {
        this.engine = engine;
    }
    isVisible(entityId, forTeam) {
        const entity = this.engine.getEntity(entityId);
        if (!entity)
            return false;
        // Own team always sees own units
        if (entity.team === forTeam)
            return true;
        // Check if any ally has vision
        const allies = this.engine.getTeam(forTeam);
        for (const ally of allies) {
            if (this.hasVisionOf(ally, entity))
                return true;
        }
        return false;
    }
    hasVisionOf(viewer, target) {
        const dist = this.getDistance(viewer.position, target.position);
        const sightRange = game_1.GAME_CONSTANTS.SIGHT_RANGE_MEDIUM;
        if (dist > sightRange)
            return false;
        // Check line of sight
        return this.engine.state.entities[viewer.id] !== undefined;
    }
    getVisibleEntities(forTeam) {
        const visible = [];
        for (const entity of Object.values(this.engine.state.entities)) {
            if (this.isVisible(entity.id, forTeam)) {
                visible.push(entity.id);
            }
        }
        return visible;
    }
    placeWard(entityId, position, type) {
        const entity = this.engine.getEntity(entityId);
        if (!entity)
            return false;
        const ward = {
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
    revealArea(position, radius, forTeam, duration) {
        this.engine.state.effects.push({
            id: `reveal-${Date.now()}`,
            type: 'vision',
            position,
            startTime: this.engine.state.time,
            duration,
            data: { radius, team: forTeam },
        });
    }
    getDistance(a, b) {
        return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }
    update(_dt) {
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
exports.VisionSystem = VisionSystem;
//# sourceMappingURL=VisionSystem.js.map