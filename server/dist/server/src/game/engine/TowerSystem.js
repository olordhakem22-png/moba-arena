"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TowerSystem = void 0;
const game_1 = require("@shared/constants/game");
const Physics_1 = require("../physics/Physics");
class TowerSystem {
    engine;
    physics;
    towers = new Map();
    towerRange = game_1.GAME_CONSTANTS.GLOBAL_TOWER_RANGE;
    // Tower stats per order
    towerStats = {
        1: { health: 3800, damage: 152, attackSpeed: 0.8, range: 850 },
        2: { health: 4600, damage: 189, attackSpeed: 0.8, range: 850 },
        3: { health: 5400, damage: 226, attackSpeed: 0.8, range: 850 },
    };
    constructor(engine) {
        this.engine = engine;
        this.physics = new Physics_1.Physics(engine);
    }
    // ==========================================
    // TOWER MANAGEMENT
    // ==========================================
    registerTower(towerId, lane, order) {
        const stats = this.towerStats[order] || this.towerStats[1];
        this.towers.set(towerId, {
            order,
            lane,
            platings: 5,
            platingsRemaining: 5,
            lastAttackTime: 0,
            attackCooldown: 1 / stats.attackSpeed,
            attackRange: stats.range,
            attackDamage: stats.damage,
            aggroTimeout: 0,
        });
        // Set tower attack damage in entity stats
        const tower = this.engine.getEntity(towerId);
        if (tower) {
            tower.stats.currentAD = stats.damage;
            tower.stats.currentAttackSpeed = stats.attackSpeed;
            tower.stats.currentRange = stats.range;
            tower.stats.currentArmor = 50 + order * 10;
        }
    }
    getTowerData(towerId) {
        return this.towers.get(towerId);
    }
    getAllTowers() {
        return this.towers;
    }
    // ==========================================
    // TARGETING PRIORITY
    // ==========================================
    /**
     * Get the target for a tower based on priority:
     * 1. Minions closest to the nexus
     * 2. Champions closest to the nexus (only if no minions)
     * 3. Current target if still valid
     */
    getTarget(towerId) {
        const tower = this.engine.getEntity(towerId);
        if (!tower || this.engine.isDead(tower))
            return null;
        const towerData = this.towers.get(towerId);
        if (!towerData)
            return null;
        // Check if current target is still valid
        if (towerData.currentTargetId) {
            const currentTarget = this.engine.getEntity(towerData.currentTargetId);
            if (currentTarget && this.isValidTarget(tower, currentTarget, towerData)) {
                // Refresh aggro timeout
                towerData.aggroTimeout = this.engine.state.time + 1.5;
                return currentTarget;
            }
        }
        // Find new target
        const potentialTargets = this.getPotentialTargets(tower, towerData);
        if (potentialTargets.length === 0)
            return null;
        // Sort by priority: minions first, then by distance to nexus
        potentialTargets.sort((a, b) => {
            // Minions have priority over champions
            if (a.type !== b.type) {
                return a.type === 'minion' ? -1 : 1;
            }
            // Then by distance to nexus (closer = higher priority)
            const nexusPos = this.getEnemyNexusPosition(tower.team);
            const distA = this.physics.distance(a.position, nexusPos);
            const distB = this.physics.distance(b.position, nexusPos);
            return distA - distB;
        });
        const newTarget = potentialTargets[0];
        towerData.currentTargetId = newTarget.id;
        towerData.aggroTimeout = this.engine.state.time + 1.5;
        return newTarget;
    }
    getPotentialTargets(tower, towerData) {
        const targets = [];
        const range = towerData.attackRange;
        for (const entity of Object.values(this.engine.state.entities)) {
            // Only target enemies
            if (entity.team === tower.team)
                continue;
            // Dead units
            if (this.engine.isDead(entity))
                continue;
            // Must be in range
            const dist = this.physics.distance(tower.position, entity.position);
            if (dist > range)
                continue;
            // Valid target types
            if (!['minion', 'champion', 'monster'].includes(entity.type))
                continue;
            // Check for invulnerability
            if (this.engine.hasState(entity, 'invulnerable') || this.engine.hasState(entity, 'untargetable'))
                continue;
            targets.push(entity);
        }
        return targets;
    }
    isValidTarget(tower, target, towerData) {
        // Must be in range
        const dist = this.physics.distance(tower.position, target.position);
        if (dist > towerData.attackRange)
            return false;
        // Must not be dead
        if (this.engine.isDead(target))
            return false;
        // Must not be invulnerable
        if (this.engine.hasState(target, 'invulnerable') || this.engine.hasState(target, 'untargetable'))
            return false;
        // Aggro timeout check
        if (this.engine.state.time > towerData.aggroTimeout)
            return false;
        return true;
    }
    getEnemyNexusPosition(team) {
        return team === 'blue' ? game_1.MAP_CONFIG.RED_NEXUS : game_1.MAP_CONFIG.BLUE_NEXUS;
    }
    // ==========================================
    // TOWER ATTACKING
    // ==========================================
    /**
     * Attempt tower attack
     */
    attack(towerId) {
        const tower = this.engine.getEntity(towerId);
        if (!tower || this.engine.isDead(tower))
            return false;
        const towerData = this.towers.get(towerId);
        if (!towerData)
            return false;
        const now = this.engine.state.time;
        // Check cooldown
        if (now - towerData.lastAttackTime < towerData.attackCooldown)
            return false;
        // Get target
        const target = this.getTarget(towerId);
        if (!target)
            return false;
        // Perform attack
        const damage = towerData.attackDamage;
        this.engine.dealDamage(towerId, target.id, damage, 'physical');
        towerData.lastAttackTime = now;
        towerData.currentTargetId = target.id;
        // Update facing
        tower.facing = this.physics.angle(tower.position, target.position);
        tower.model.animation = 'attack';
        // Emit event
        this.engine.emit('towerAttack', {
            towerId,
            targetId: target.id,
            damage,
            timestamp: now,
        });
        return true;
    }
    // ==========================================
    // PLATING SYSTEM
    // ==========================================
    /**
     * Damage tower plating (called when tower takes damage)
     */
    damagePlating(towerId, damage) {
        const tower = this.engine.getEntity(towerId);
        if (!tower)
            return;
        const towerData = this.towers.get(towerId);
        if (!towerData || towerData.platingsRemaining <= 0)
            return;
        // Remove plating
        towerData.platingsRemaining--;
        towerData.attackDamage += 15; // Increase damage per plating
        // Update tower tint to show damage
        tower.model.tint = this.getPlatingTint(towerData.platingsRemaining);
        // Emit plating destroyed event
        if (towerData.platingsRemaining < towerData.platings) {
            this.engine.addGameEvent('tower_plating', {
                towerId,
                platingsRemaining: towerData.platingsRemaining,
                damageIncrease: 15,
            });
            this.engine.emit('towerPlatingDestroyed', {
                towerId,
                platingsRemaining: towerData.platingsRemaining,
            });
        }
    }
    getPlatingTint(platingsRemaining) {
        const colors = [
            '#FFD700', // Gold - full plating
            '#FFA500', // Orange - 4 platings
            '#FF8C00', // Dark orange - 3 platings
            '#FF6347', // Tomato - 2 platings
            '#DC143C', // Crimson - 1 plating
            '#8B0000', // Dark red - no platings
        ];
        return colors[5 - platingsRemaining] || colors[0];
    }
    // ==========================================
    // TOWER AGGRO
    // ==========================================
    /**
     * Force tower to target a specific entity
     */
    setAggro(towerId, targetId) {
        const towerData = this.towers.get(towerId);
        if (!towerData)
            return;
        const target = this.engine.getEntity(targetId);
        if (!target)
            return;
        towerData.aggroTargetId = targetId;
        towerData.aggroTimeout = this.engine.state.time + 3; // 3 second aggro
        towerData.currentTargetId = targetId;
    }
    /**
     * Clear tower aggro
     */
    clearAggro(towerId) {
        const towerData = this.towers.get(towerId);
        if (!towerData)
            return;
        towerData.aggroTargetId = undefined;
        towerData.currentTargetId = undefined;
    }
    /**
     * Check if a champion is in tower range
     */
    isInTowerRange(towerId, entityId) {
        const tower = this.engine.getEntity(towerId);
        const entity = this.engine.getEntity(entityId);
        if (!tower || !entity)
            return false;
        const towerData = this.towers.get(towerId);
        if (!towerData)
            return false;
        const dist = this.physics.distance(tower.position, entity.position);
        return dist <= towerData.attackRange;
    }
    /**
     * Get the tower that's targeting an entity
     */
    getTowerTargeting(entityId) {
        for (const [towerId, towerData] of this.towers) {
            if (towerData.currentTargetId === entityId) {
                return towerId;
            }
        }
        return null;
    }
    // ==========================================
    // TOWER EVENTS
    // ==========================================
    handleTowerKill(towerId, killerId) {
        const tower = this.engine.getEntity(towerId);
        if (!tower)
            return;
        const killer = this.engine.getEntity(killerId);
        if (!killer)
            return;
        // Award gold
        const goldReward = this.calculateTowerGoldReward(towerId, killer.team);
        killer.current.gold += goldReward;
        // Update team stats
        const teamIndex = killer.team === 'blue' ? 0 : 1;
        this.engine.state.teams[teamIndex].gold += goldReward;
        this.engine.state.teams[teamIndex].towers++;
        // Event
        this.engine.addGameEvent('tower_kill', {
            towerId,
            killerId,
            team: killer.team,
            goldReward,
        });
        this.engine.emit('towerDestroyed', {
            towerId,
            killerId,
            team: killer.team,
            lane: this.towers.get(towerId)?.lane,
            order: this.towers.get(towerId)?.order,
        });
        // Remove from tracking
        this.towers.delete(towerId);
    }
    calculateTowerGoldReward(towerId, killerTeam) {
        const towerData = this.towers.get(towerId);
        if (!towerData)
            return game_1.GAME_CONSTANTS.TOWER_GOLD_SPLIT[0];
        // Global gold + local gold
        const globalGold = game_1.GAME_CONSTANTS.TOWER_GOLD_SPLIT[towerData.platingsRemaining] || 150;
        const localGold = game_1.GAME_CONSTANTS.TOWER_GOLD_LOCAL;
        return globalGold + localGold;
    }
    // ==========================================
    // UPDATE
    // ==========================================
    update(dt) {
        // Update all towers
        for (const [towerId, _towerData] of this.towers) {
            this.attack(towerId);
        }
    }
    // ==========================================
    // LANE LOGIC
    // ==========================================
    /**
     * Check if an inhibitor is destroyed and spawn super minions
     */
    isInhibitorDestroyed(team, lane) {
        const inhibitorId = `${team}-${lane}-inhibitor`;
        const inhibitor = this.engine.getEntity(inhibitorId);
        return !inhibitor || this.engine.isDead(inhibitor);
    }
    /**
     * Get all towers still standing for a team
     */
    getTeamTowers(team) {
        const result = [];
        for (const [towerId, _towerData] of this.towers) {
            const tower = this.engine.getEntity(towerId);
            if (tower && tower.team === team && !this.engine.isDead(tower)) {
                result.push(towerId);
            }
        }
        return result;
    }
    /**
     * Check if all towers in a lane are destroyed
     */
    isLaneOpen(team, lane) {
        const towerPositions = game_1.MAP_CONFIG.TOWER_POSITIONS[team === 'blue' ? 'red' : 'blue'][lane];
        for (const pos of towerPositions) {
            // Check if any tower exists at this position
            for (const [towerId] of this.towers) {
                const tower = this.engine.getEntity(towerId);
                if (tower && tower.team !== team) {
                    const dist = this.physics.distance(tower.position, pos);
                    if (dist < 200)
                        return false; // Tower still standing
                }
            }
        }
        return true; // No towers remaining
    }
}
exports.TowerSystem = TowerSystem;
//# sourceMappingURL=TowerSystem.js.map