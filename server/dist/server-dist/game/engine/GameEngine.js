"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = void 0;
/**
 * GameEngine - Core game simulation server
 * Runs at fixed 20 TPS, manages all entities, physics, combat, objectives
 */
const events_1 = require("events");
const uuid_1 = require("uuid");
const game_1 = require("../../../../shared/src/constants/game");
const Physics_1 = require("../physics/Physics");
const CombatSystem_1 = require("./CombatSystem");
const AbilitySystem_1 = require("./AbilitySystem");
const VisionSystem_1 = require("./VisionSystem");
const ObjectiveManager_1 = require("./ObjectiveManager");
const MinionManager_1 = require("./MinionManager");
const AIGuy_1 = require("../ai/AIGuy");
const logger_1 = require("../../utils/logger");
class GameEngine extends events_1.EventEmitter {
    id;
    state;
    tick = 0;
    running = false;
    lastTickTime = 0;
    tickInterval = null;
    physics;
    combat;
    abilities;
    vision;
    objectives;
    minions;
    aiPlayers = new Map();
    disconnectTimeouts = new Map();
    constructor(id, players) {
        super();
        this.id = id;
        this.state = this.createInitialState(id, players);
        this.physics = new Physics_1.Physics(this);
        this.combat = new CombatSystem_1.CombatSystem(this);
        this.abilities = new AbilitySystem_1.AbilitySystem(this);
        this.vision = new VisionSystem_1.VisionSystem(this);
        this.objectives = new ObjectiveManager_1.ObjectiveManager(this);
        this.minions = new MinionManager_1.MinionManager(this);
        this.setupEventHandlers();
        logger_1.logger.info(`🎮 GameEngine created: ${id} with ${players.length} players`);
    }
    // ==========================================
    // LIFECYCLE
    // ==========================================
    start() {
        if (this.running)
            return;
        this.running = true;
        this.lastTickTime = Date.now();
        const msPerTick = 1000 / game_1.GAME_CONSTANTS.TICK_RATE;
        this.tickInterval = setInterval(() => {
            const now = Date.now();
            const dt = (now - this.lastTickTime) / 1000;
            this.lastTickTime = now;
            this.update(dt);
            this.tick++;
            this.state.time += dt;
            this.state.map;
        }, msPerTick);
        logger_1.logger.info(`🎮 Game started: ${this.id}`);
    }
    stop() {
        this.running = false;
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        logger_1.logger.info(`🎮 Game stopped: ${this.id}`);
    }
    destroy() {
        this.stop();
        this.emit('gameDestroyed', this.id);
    }
    // ==========================================
    // MAIN UPDATE LOOP
    // ==========================================
    update(dt) {
        if (this.state.phase !== 'playing')
            return;
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
    updateEntities(dt) {
        for (const entity of Object.values(this.state.entities)) {
            // Skip dead units
            if (this.isDead(entity))
                continue;
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
    spawnChampion(userId, team, championId, slot) {
        const spawnPos = team === 'blue' ? game_1.MAP_CONFIG.BLUE_SPAWN : game_1.MAP_CONFIG.RED_SPAWN;
        const facing = team === 'blue' ? Math.PI / 4 : (5 * Math.PI) / 4;
        const entity = {
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
                gold: game_1.GAME_CONSTANTS.STARTING_GOLD,
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
                tickRate: game_1.GAME_CONSTANTS.TICK_RATE,
                latency: 0,
                pinging: false,
            },
        };
        this.state.entities[entity.id] = entity;
        this.emit('championSpawned', entity);
        return entity;
    }
    spawnTower(team, lane, order) {
        const positions = game_1.MAP_CONFIG.TOWER_POSITIONS[team][lane];
        const pos = positions[order - 1];
        const laneName = lane;
        const tower = {
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
                tickRate: game_1.GAME_CONSTANTS.TICK_RATE,
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
        };
        this.state.entities[tower.id] = tower;
        this.emit('towerSpawned', tower);
        return tower;
    }
    // ==========================================
    // COMBAT
    // ==========================================
    dealDamage(sourceId, targetId, amount, type, ability) {
        const source = this.state.entities[sourceId];
        const target = this.state.entities[targetId];
        if (!source || !target || this.isDead(target)) {
            return { sourceId, targetId, amount: 0, type, isCrit: false, isKill: false, overkill: 0, timestamp: Date.now() };
        }
        // Apply resistances
        let finalDamage = amount;
        if (type === 'physical') {
            finalDamage = this.combat.calculatePhysicalDamage(amount, target);
        }
        else if (type === 'magic') {
            finalDamage = this.combat.calculateMagicDamage(amount, target);
        }
        // true damage goes through
        target.current.health = Math.max(0, target.current.health - finalDamage);
        const event = {
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
    handleKill(killerId, victimId) {
        const killer = this.state.entities[killerId];
        const victim = this.state.entities[victimId];
        if (!killer || !victim)
            return;
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
        const deathEvent = {
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
    scheduleRespawn(entityId) {
        const entity = this.state.entities[entityId];
        if (!entity)
            return;
        const respawnTime = this.getRespawnTime(entity);
        const state = { type: 'dead', startTime: this.state.time, duration: respawnTime };
        entity.states.push(state);
        setTimeout(() => {
            if (this.state.entities[entityId]) {
                entity.states = entity.states.filter((s) => s.type !== 'dead');
                this.respawnEntity(entityId);
            }
        }, respawnTime * 1000);
    }
    respawnEntity(entityId) {
        const entity = this.state.entities[entityId];
        if (!entity)
            return;
        const spawnPos = entity.team === 'blue' ? game_1.MAP_CONFIG.BLUE_SPAWN : game_1.MAP_CONFIG.RED_SPAWN;
        entity.position = { ...spawnPos };
        entity.current.health = entity.current.maxHealth;
        entity.current.mana = entity.current.maxMana;
        this.emit('entityRespawned', entity);
    }
    getRespawnTime(entity) {
        const level = entity.current.level;
        return Math.max(8, level * 2.5 + 5); // seconds
    }
    findAssists(victimId) {
        return []; // Simplified - real implementation tracks recent damage dealers
    }
    calculateGoldReward(killer, victim) {
        const baseKillGold = game_1.GAME_CONSTANTS.KILL_GOLD_BASE;
        const bounty = game_1.GAME_CONSTANTS.KILL_GOLD_BASE + Math.floor(victim.current.gold / 100);
        return Math.min(baseKillGold + bounty, 1000);
    }
    // ==========================================
    // PROJECTILES
    // ==========================================
    createProjectile(config) {
        const projectile = {
            id: (0, uuid_1.v4)(),
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
    updateProjectiles(dt) {
        const toRemove = [];
        for (const projectile of this.state.projectiles) {
            if (!projectile.isActive)
                continue;
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
    useAbility(casterId, ability) {
        this.abilities.useAbility(casterId, ability);
    }
    levelUpAbility(entityId, abilityKey) {
        this.abilities.levelUp(entityId, abilityKey);
    }
    // ==========================================
    // VISION
    // ==========================================
    isVisible(entityId, forTeam) {
        return this.vision.isVisible(entityId, forTeam);
    }
    getVisibleEntities(forTeam) {
        return this.vision.getVisibleEntities(forTeam);
    }
    // ==========================================
    // ITEMS & SHOP
    // ==========================================
    purchaseItem(entityId, itemId) {
        const entity = this.state.entities[entityId];
        if (!entity || entity.type !== 'champion')
            return false;
        // TODO: integrate with shop system
        return true;
    }
    sellItem(entityId, slot) {
        const entity = this.state.entities[entityId];
        if (!entity || entity.type !== 'champion')
            return false;
        return true;
    }
    // ==========================================
    // RECALL & TELEPORT
    // ==========================================
    startRecall(entityId) {
        const entity = this.state.entities[entityId];
        if (!entity)
            return;
        entity.states.push({
            type: 'recalling',
            startTime: this.state.time,
            duration: game_1.GAME_CONSTANTS.RECALL_TIME,
        });
        this.emit('recallStarted', { entityId, duration: game_1.GAME_CONSTANTS.RECALL_TIME });
    }
    cancelRecall(entityId) {
        const entity = this.state.entities[entityId];
        if (!entity)
            return;
        entity.states = entity.states.filter((s) => s.type !== 'recalling');
        this.emit('recallCancelled', { entityId });
    }
    // ==========================================
    // MOVEMENT & ORDERS
    // ==========================================
    moveOrder(entityId, target) {
        const entity = this.state.entities[entityId];
        if (!entity || this.isDead(entity))
            return;
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
    attackOrder(entityId, targetId) {
        const entity = this.state.entities[entityId];
        const target = this.state.entities[targetId];
        if (!entity || !target || this.isDead(entity) || this.isDead(target))
            return;
        entity.model.animation = 'attack';
        this.emit('attackOrder', { entityId, targetId });
    }
    stopOrder(entityId) {
        const entity = this.state.entities[entityId];
        if (!entity)
            return;
        entity.velocity = { x: 0, y: 0 };
        entity.model.animation = 'idle';
        this.emit('stopOrder', { entityId });
    }
    // ==========================================
    // PINGS
    // ==========================================
    ping(entityId, position, type, targetId) {
        this.emit('ping', { entityId, position, type, targetId });
        this.addGameEvent('ping', { entityId, position, type, targetId });
    }
    // ==========================================
    // SURRENDER
    // ==========================================
    initiateSurrenderVote(entityId) {
        const entity = this.state.entities[entityId];
        if (!entity || this.state.time < game_1.GAME_CONSTANTS.MIN_GAME_DURATION)
            return;
        this.emit('surrenderVoteStarted', { team: entity.team, initiatorId: entityId });
    }
    voteSurrender(entityId, vote) {
        this.emit('surrenderVote', { entityId, vote });
    }
    // ==========================================
    // STATE HELPERS
    // ==========================================
    isDead(entity) {
        return entity.current.health <= 0 || this.hasState(entity, 'dead');
    }
    hasState(entity, stateType) {
        return entity.states.some((s) => s.type === stateType && this.state.time < s.startTime + s.duration);
    }
    getEntity(id) {
        return this.state.entities[id];
    }
    getTeam(team) {
        return Object.values(this.state.entities).filter((e) => e.team === team && !this.isDead(e));
    }
    getLivingEntities() {
        return Object.values(this.state.entities).filter((e) => !this.isDead(e));
    }
    updateBuffs(entity, dt) {
        entity.buffs = entity.buffs.filter((buff) => {
            const elapsed = this.state.time - buff.startTime;
            return elapsed < buff.duration;
        });
    }
    applyStates(entity, dt) {
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
    addAIPlayer(userId, team, difficulty) {
        const ai = new AIGuy_1.AIGuy(userId, this, team, difficulty);
        this.aiPlayers.set(userId, ai);
        ai.start();
        logger_1.logger.info(`🤖 AI player added: ${userId} (${difficulty})`);
    }
    updateAI(dt) {
        for (const ai of this.aiPlayers.values()) {
            ai.update(dt);
        }
    }
    // ==========================================
    // WIN CONDITION
    // ==========================================
    checkWinCondition() {
        const blueNexus = this.getNexus('blue');
        const redNexus = this.getNexus('red');
        if (!blueNexus || !redNexus)
            return;
        if (this.isDead(blueNexus)) {
            this.endGame('red');
        }
        else if (this.isDead(redNexus)) {
            this.endGame('blue');
        }
    }
    getNexus(team) {
        return Object.values(this.state.entities).find((e) => e.type === 'nexus' && e.team === team);
    }
    endGame(winner) {
        this.state.phase = 'end';
        this.stop();
        this.addGameEvent('game_end', { winner, duration: this.state.time });
        this.emit('gameEnded', { winner, duration: this.state.time });
        logger_1.logger.info(`🏆 Game ${this.id} ended. Winner: ${winner}`);
    }
    // ==========================================
    // NETWORKING HELPERS
    // ==========================================
    emitState() {
        if (this.tick % Math.round(game_1.GAME_CONSTANTS.TICK_RATE / 10) !== 0)
            return; // emit ~10 times/sec
        this.emit('stateUpdate', this.getSnapshot());
    }
    getSnapshot() {
        // Return a delta or full snapshot
        return { ...this.state };
    }
    getEntityState(entityId) {
        const entity = this.state.entities[entityId];
        if (!entity)
            return null;
        return { ...entity };
    }
    // ==========================================
    // EVENT HELPERS
    // ==========================================
    addGameEvent(type, data) {
        this.state.events.push({
            id: (0, uuid_1.v4)(),
            type: type,
            timestamp: this.state.time,
            data,
        });
        // Keep events list bounded
        if (this.state.events.length > 1000) {
            this.state.events = this.state.events.slice(-500);
        }
    }
    setupEventHandlers() {
        this.on('championSpawned', (entity) => logger_1.logger.debug(`Champion spawned: ${entity.id}`));
        this.on('kill', (event) => {
            const killer = this.state.entities[event.killerId];
            const victim = this.state.entities[event.entityId];
            if (killer && victim) {
                logger_1.logger.info(`💀 ${killer.id} killed ${event.entityId}`);
            }
        });
        this.on('gameEnded', (data) => logger_1.logger.info(`🏆 Game ended: ${data.winner} wins`));
    }
    // ==========================================
    // FACTORY
    // ==========================================
    createInitialState(id, players) {
        return {
            id,
            phase: 'pre-game',
            time: 0,
            map: {
                id: 'summoners_rift',
                name: "Summoner's Rift",
                width: game_1.MAP_CONFIG.MAP_WIDTH,
                height: game_1.MAP_CONFIG.MAP_HEIGHT,
                gridSize: game_1.MAP_CONFIG.GRID_SIZE,
                terrain: [],
                zones: [],
                lanes: [],
                spawnPoints: {
                    blue: game_1.MAP_CONFIG.BLUE_SPAWN,
                    red: game_1.MAP_CONFIG.RED_SPAWN,
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
                    width: game_1.MAP_CONFIG.MAP_WIDTH,
                    height: game_1.MAP_CONFIG.MAP_HEIGHT,
                    gridSize: game_1.MAP_CONFIG.GRID_SIZE,
                },
                gameMode: 'classic',
                matchLength: 0,
                surrenderEnabled: true,
                minimapSharing: true,
            },
        };
    }
    getDefaultStats() {
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
exports.GameEngine = GameEngine;
//# sourceMappingURL=GameEngine.js.map