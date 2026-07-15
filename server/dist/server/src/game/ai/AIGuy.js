"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIGuy = void 0;
const game_1 = require("@shared/constants/game");
class AIGuy {
    id;
    engine;
    team;
    difficulty;
    role = 'mid';
    decisionInterval;
    targetId = null;
    state = 'farming';
    lastDecision = 0;
    roamTimer = 0;
    laneTimer = 0;
    constructor(id, engine, team, difficulty) {
        this.id = id;
        this.engine = engine;
        this.team = team;
        this.difficulty = difficulty;
        this.decisionInterval = difficulty === 'easy' ? 2000 : difficulty === 'medium' ? 1000 : 500;
    }
    start() {
        this.laneTimer = 0;
        this.roamTimer = 0;
    }
    update(dt) {
        const entity = this.engine.getEntity(this.id);
        if (!entity || this.engine.isDead(entity))
            return;
        this.lastDecision += dt * 1000;
        if (this.lastDecision < this.decisionInterval)
            return;
        this.lastDecision = 0;
        this.evaluateState();
        this.executeState();
    }
    evaluateState() {
        const entity = this.engine.getEntity(this.id);
        if (!entity)
            return;
        const enemiesNearby = this.getEnemiesInRange(entity, 800);
        const towersNearby = this.getTowersInRange(entity, 1000);
        const healthPercent = entity.current.health / entity.current.maxHealth;
        // Determine state
        if (healthPercent < 0.3) {
            this.state = 'defending';
        }
        else if (enemiesNearby.length >= 3) {
            this.state = 'teamfight';
        }
        else if (towersNearby.length > 0 && this.isPushing()) {
            this.state = 'pushing';
        }
        else {
            this.state = 'farming';
        }
        // Find target
        if (enemiesNearby.length > 0) {
            this.targetId = enemiesNearby[0].id;
        }
        else {
            this.targetId = null;
        }
    }
    executeState() {
        const entity = this.engine.getEntity(this.id);
        if (!entity)
            return;
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
    executeFarming() {
        const entity = this.engine.getEntity(this.id);
        if (!entity)
            return;
        const minions = this.getMinionsInRange(entity, entity.stats.currentRange + 200);
        if (minions.length > 0) {
            this.targetId = minions[0].id;
            this.engine.attackOrder(this.id, this.targetId);
        }
        else {
            // Move to lane
            this.moveToLane();
        }
    }
    executePushing() {
        const entity = this.engine.getEntity(this.id);
        if (!entity)
            return;
        const tower = this.getNearestTower(entity);
        if (tower) {
            const dist = this.getDistance(entity.position, tower.position);
            if (dist > entity.stats.currentRange) {
                this.engine.moveOrder(this.id, tower.position);
            }
            else {
                this.targetId = tower.id;
                this.engine.attackOrder(this.id, tower.id);
            }
        }
    }
    executeRoaming() {
        this.roamTimer++;
        if (this.roamTimer > 10) {
            this.roamTimer = 0;
            this.state = 'farming';
        }
        const targetPos = this.team === 'blue' ? game_1.MAP_CONFIG.RED_SPAWN : game_1.MAP_CONFIG.BLUE_SPAWN;
        this.engine.moveOrder(this.id, targetPos);
    }
    executeTeamfight() {
        const entity = this.engine.getEntity(this.id);
        if (!entity)
            return;
        // Target lowest health enemy
        const enemies = this.getEnemiesInRange(entity, 1000);
        if (enemies.length === 0)
            return;
        const lowestHealth = enemies.reduce((prev, curr) => {
            const prevHP = prev.current.health / prev.current.maxHealth;
            const currHP = curr.current.health / curr.current.maxHealth;
            return currHP < prevHP ? curr : prev;
        });
        this.targetId = lowestHealth.id;
        this.engine.attackOrder(this.id, this.targetId);
    }
    executeDefending() {
        const entity = this.engine.getEntity(this.id);
        if (!entity)
            return;
        const basePos = this.team === 'blue' ? game_1.MAP_CONFIG.BLUE_SPAWN : game_1.MAP_CONFIG.RED_SPAWN;
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
    getEnemiesInRange(entity, range) {
        const enemies = [];
        for (const other of Object.values(this.engine.state.entities)) {
            if (other.team === entity.team)
                continue;
            if (this.engine.isDead(other))
                continue;
            if (this.getDistance(entity.position, other.position) <= range) {
                enemies.push(other);
            }
        }
        return enemies;
    }
    getMinionsInRange(entity, range) {
        const minions = [];
        for (const other of Object.values(this.engine.state.entities)) {
            if (other.type !== 'minion')
                continue;
            if (other.team === entity.team)
                continue;
            if (this.engine.isDead(other))
                continue;
            if (this.getDistance(entity.position, other.position) <= range) {
                minions.push(other);
            }
        }
        return minions;
    }
    getTowersInRange(entity, range) {
        const towers = [];
        for (const other of Object.values(this.engine.state.entities)) {
            if (other.type !== 'tower')
                continue;
            if (this.engine.isDead(other))
                continue;
            if (this.getDistance(entity.position, other.position) <= range) {
                towers.push(other);
            }
        }
        return towers;
    }
    getNearestTower(entity) {
        let nearest = null;
        let minDist = Infinity;
        for (const other of Object.values(this.engine.state.entities)) {
            if (other.type !== 'tower')
                continue;
            if (this.engine.isDead(other))
                continue;
            const dist = this.getDistance(entity.position, other.position);
            if (dist < minDist) {
                minDist = dist;
                nearest = other;
            }
        }
        return nearest;
    }
    moveToLane() {
        const lanePositions = this.getLanePosition();
        this.engine.moveOrder(this.id, lanePositions);
        this.laneTimer++;
        if (this.laneTimer > 30) {
            this.laneTimer = 0;
        }
    }
    getLanePosition() {
        // Mid lane by default
        return {
            x: game_1.MAP_CONFIG.centerX + (this.team === 'blue' ? -2000 : 2000),
            y: game_1.MAP_CONFIG.centerY + (this.team === 'blue' ? -2000 : 2000),
        };
    }
    isPushing() {
        const entity = this.engine.getEntity(this.id);
        if (!entity)
            return false;
        const minions = this.getMinionsInRange(entity, 2000);
        const ownMinions = minions.filter(m => m.team === entity.team);
        const enemyMinions = minions.filter(m => m.team !== entity.team);
        return ownMinions.length > enemyMinions.length;
    }
    getDistance(a, b) {
        return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }
}
exports.AIGuy = AIGuy;
//# sourceMappingURL=AIGuy.js.map