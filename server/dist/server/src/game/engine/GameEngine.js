"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = void 0;
/**
 * GameEngine - Core game simulation server
 * Runs at fixed 20 TPS, manages all entities, physics, combat, objectives
 * Handles game phases: loading, picking, playing, ended
 */
const events_1 = require("events");
const uuid_1 = require("uuid");
const game_1 = require("@shared/constants/game");
const Physics_1 = require("../physics/Physics");
const CombatSystem_1 = require("./CombatSystem");
const AbilitySystem_1 = require("./AbilitySystem");
const VisionSystem_1 = require("./VisionSystem");
const ObjectiveManager_1 = require("./ObjectiveManager");
const MinionManager_1 = require("./MinionManager");
const TowerSystem_1 = require("./TowerSystem");
const ItemSystem_1 = require("./ItemSystem");
const AIGuy_1 = require("../ai/AIGuy");
const logger_1 = require("../../utils/logger");
const champions_1 = require("@shared/data/champions");
class GameEngine extends events_1.EventEmitter {
    // Core state
    id;
    state;
    tick = 0;
    running = false;
    lastTickTime = 0;
    tickInterval = null;
    // Systems
    physics;
    combat;
    abilities;
    vision;
    objectives;
    minions;
    towers;
    items;
    // AI
    aiPlayers = new Map();
    disconnectTimeouts = new Map();
    // Player tracking
    players = new Map();
    // State tracking
    surrenderVotes = new Map([
        ['blue', { yes: new Set(), no: new Set(), inProgress: false }],
        ['red', { yes: new Set(), no: new Set(), inProgress: false }],
    ]);
    // Snapshot settings
    lastSnapshotTick = 0;
    snapshotInterval = 2; // Send full state every 2 ticks
    constructor(id, players) {
        super();
        this.id = id;
        this.state = this.createInitialState(id, players);
        // Store player info
        for (const player of players) {
            this.players.set(player.userId, player);
        }
        // Initialize systems
        this.physics = new Physics_1.Physics(this);
        this.combat = new CombatSystem_1.CombatSystem(this);
        this.abilities = new AbilitySystem_1.AbilitySystem(this);
        this.vision = new VisionSystem_1.VisionSystem(this);
        this.objectives = new ObjectiveManager_1.ObjectiveManager(this);
        this.minions = new MinionManager_1.MinionManager(this);
        this.towers = new TowerSystem_1.TowerSystem(this);
        this.items = new ItemSystem_1.ItemSystem(this);
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
        }, msPerTick);
        // Set initial phase
        this.state.phase = 'countdown';
        this.startCountdown();
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
    startCountdown() {
        setTimeout(() => {
            this.transitionToPhase('playing');
            this.spawnAllEntities();
        }, game_1.GAME_CONSTANTS.GAME_START_COUNTDOWN * 1000);
    }
    transitionToPhase(phase) {
        const oldPhase = this.state.phase;
        this.state.phase = phase;
        this.addGameEvent('phase_change', { from: oldPhase, to: phase, time: this.state.time });
        this.emit('phaseChange', { from: oldPhase, to: phase });
        logger_1.logger.info(`🎮 Game ${this.id} transitioned: ${oldPhase} -> ${phase}`);
    }
    // ==========================================
    // ENTITY SPAWNING
    // ==========================================
    spawnAllEntities() {
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
    spawnChampion(userId, team, championId, slot) {
        const spawnPos = team === 'blue' ? game_1.MAP_CONFIG.BLUE_SPAWN : game_1.MAP_CONFIG.RED_SPAWN;
        const facing = team === 'blue' ? Math.PI / 4 : (5 * Math.PI) / 4;
        // Get champion base stats
        const baseStats = champions_1.CHAMPION_DATA[championId]?.stats;
        const statsAtLevel = (0, champions_1.getChampionStatsAtLevel)(championId, 1);
        const entity = {
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
            },
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
        // Store champion ID for ability lookup
        entity.championId = championId;
        this.state.entities[entity.id] = entity;
        this.emit('championSpawned', entity);
        return entity;
    }
    spawnAllTowers() {
        for (const team of ['blue', 'red']) {
            for (const lane of ['top', 'mid', 'bot']) {
                for (let order = 1; order <= 3; order++) {
                    const tower = this.spawnTower(team, lane, order);
                    this.towers.registerTower(tower.id, lane, order);
                }
            }
        }
    }
    spawnTower(team, lane, order) {
        const positions = game_1.MAP_CONFIG.TOWER_POSITIONS[team][lane];
        const pos = positions[order - 1];
        const towerStats = {
            1: { health: 3800, damage: 152, attackSpeed: 0.8 },
            2: { health: 4600, damage: 189, attackSpeed: 0.8 },
            3: { health: 5400, damage: 226, attackSpeed: 0.8 },
        }[order] || { health: 3800, damage: 152, attackSpeed: 0.8 };
        const tower = {
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
                attackRange: game_1.GAME_CONSTANTS.GLOBAL_TOWER_RANGE,
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
                currentRange: game_1.GAME_CONSTANTS.GLOBAL_TOWER_RANGE,
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
            baseStats: {},
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
                tickRate: game_1.GAME_CONSTANTS.TICK_RATE,
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
        };
        this.state.entities[tower.id] = tower;
        this.emit('towerSpawned', tower);
        return tower;
    }
    spawnNexus() {
        // Blue nexus
        const blueNexus = {
            id: 'blue-nexus',
            type: 'nexus',
            team: 'blue',
            position: { ...game_1.MAP_CONFIG.BLUE_NEXUS },
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
            baseStats: {},
            current: {
                health: 5500, maxHealth: 5500, mana: 0, maxMana: 0, energy: 0, maxEnergy: 0,
                level: 1, xp: 0, xpToLevel: 0, gold: 0, killCount: 0, deathCount: 0, assistCount: 0,
            },
            states: [], buffs: [], effects: [],
            model: { skinId: 'default', scale: 2, alpha: 1, tint: '#1e3a5f', animation: 'idle', animationFrame: 0 },
            network: { lastServerUpdate: Date.now(), clientTimestamp: Date.now(), serverTimestamp: Date.now(), tickRate: game_1.GAME_CONSTANTS.TICK_RATE, latency: 0, pinging: false },
        };
        // Red nexus
        const redNexus = {
            id: 'red-nexus',
            type: 'nexus',
            team: 'red',
            position: { ...game_1.MAP_CONFIG.RED_NEXUS },
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
            baseStats: {},
            current: {
                health: 5500, maxHealth: 5500, mana: 0, maxMana: 0, energy: 0, maxEnergy: 0,
                level: 1, xp: 0, xpToLevel: 0, gold: 0, killCount: 0, deathCount: 0, assistCount: 0,
            },
            states: [], buffs: [], effects: [],
            model: { skinId: 'default', scale: 2, alpha: 1, tint: '#5f1e1e', animation: 'idle', animationFrame: 0 },
            network: { lastServerUpdate: Date.now(), clientTimestamp: Date.now(), serverTimestamp: Date.now(), tickRate: game_1.GAME_CONSTANTS.TICK_RATE, latency: 0, pinging: false },
        };
        this.state.entities['blue-nexus'] = blueNexus;
        this.state.entities['red-nexus'] = redNexus;
    }
    spawnInhibitors() {
        for (const team of ['blue', 'red']) {
            for (const lane of ['top', 'mid', 'bot']) {
                const pos = game_1.MAP_CONFIG.INHIBITOR_POSITIONS[team][lane];
                const inhibitor = {
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
                    baseStats: {},
                    current: {
                        health: 3000, maxHealth: 3000, mana: 0, maxMana: 0, energy: 0, maxEnergy: 0,
                        level: 1, xp: 0, xpToLevel: 0, gold: 0, killCount: 0, deathCount: 0, assistCount: 0,
                    },
                    states: [], buffs: [], effects: [],
                    model: { skinId: 'default', scale: 1.2, alpha: 1, tint: team === 'blue' ? '#1e3a5f' : '#5f1e1e', animation: 'idle', animationFrame: 0 },
                    network: { lastServerUpdate: Date.now(), clientTimestamp: Date.now(), serverTimestamp: Date.now(), tickRate: game_1.GAME_CONSTANTS.TICK_RATE, latency: 0, pinging: false },
                };
                this.state.entities[inhibitor.id] = inhibitor;
            }
        }
    }
    ensureMinimumPlayers() {
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
    update(dt) {
        // Only update game systems when playing
        if (this.state.phase !== 'playing')
            return;
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
    updateEntities(dt) {
        for (const entity of Object.values(this.state.entities)) {
            // Skip dead units
            if (this.isDead(entity))
                continue;
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
    findAutoAttackTarget(entity) {
        // Find nearest enemy in range
        let closest = null;
        let closestDist = Infinity;
        for (const other of Object.values(this.state.entities)) {
            if (other.team === entity.team)
                continue;
            if (this.isDead(other))
                continue;
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
            else {
                // Check for any enemy in hitbox
                for (const entity of Object.values(this.state.entities)) {
                    if (entity.team === this.state.entities[projectile.ownerId]?.team)
                        continue;
                    if (this.isDead(entity))
                        continue;
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
        // true damage bypasses resistances
        // Consume shields
        finalDamage = this.combat.consumeShield(targetId, finalDamage);
        // Apply damage
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
    handleKill(killerId, victimId) {
        const killer = this.state.entities[killerId];
        const victim = this.state.entities[victimId];
        if (!killer || !victim)
            return;
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
        const deathEvent = {
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
    scheduleRespawn(entityId) {
        const entity = this.state.entities[entityId];
        if (!entity)
            return;
        const respawnTime = this.getRespawnTime(entity);
        entity.states.push({ type: 'dead', startTime: this.state.time, duration: respawnTime });
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
        return Math.max(8, level * 2.5 + 5);
    }
    findAssists(victimId) {
        // Simplified - in production would track recent damage
        return [];
    }
    calculateGoldReward(killer, victim) {
        if (victim.type === 'minion') {
            return victim.current.gold;
        }
        if (victim.type === 'champion') {
            const bounty = game_1.GAME_CONSTANTS.KILL_GOLD_BASE + Math.floor(victim.current.gold / 100);
            return Math.min(bounty, 1000);
        }
        return 0;
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
    // MOVEMENT & ORDERS
    // ==========================================
    moveOrder(entityId, target) {
        const entity = this.state.entities[entityId];
        if (!entity || this.isDead(entity))
            return;
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
    // RECALL & TELEPORT
    // ==========================================
    startRecall(entityId) {
        const entity = this.state.entities[entityId];
        if (!entity)
            return;
        // Cancel if in combat or low HP
        if (entity.current.health < entity.current.maxHealth * game_1.GAME_CONSTANTS.RECALL_HP_THRESHOLD) {
            return;
        }
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
    // PINGS
    // ==========================================
    ping(entityId, position, type, targetId) {
        this.addGameEvent('ping', { entityId, position, type, targetId });
        this.emit('ping', { entityId, position, type, targetId });
    }
    // ==========================================
    // SURRENDER
    // ==========================================
    initiateSurrenderVote(entityId) {
        if (this.state.time < game_1.GAME_CONSTANTS.MIN_GAME_DURATION)
            return;
        const entity = this.state.entities[entityId];
        if (!entity)
            return;
        const teamVotes = this.surrenderVotes.get(entity.team);
        if (!teamVotes || teamVotes.inProgress)
            return;
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
        }, game_1.GAME_CONSTANTS.SURRENDER_VOTE_TIMEOUT * 1000);
    }
    voteSurrender(entityId, vote) {
        const entity = this.state.entities[entityId];
        if (!entity)
            return;
        const teamVotes = this.surrenderVotes.get(entity.team);
        if (!teamVotes || !teamVotes.inProgress)
            return;
        if (vote) {
            teamVotes.yes.add(entityId);
        }
        else {
            teamVotes.no.add(entityId);
        }
        this.emit('surrenderVote', { entityId, vote });
        // Check if majority reached
        this.checkSurrenderVote(entity.team);
    }
    checkSurrenderVote(team) {
        const teamVotes = this.surrenderVotes.get(team);
        if (!teamVotes || !teamVotes.inProgress)
            return;
        const teamPlayerCount = Array.from(this.players.values()).filter(p => p.team === team).length;
        const requiredVotes = Math.ceil(teamPlayerCount / 2);
        if (teamVotes.yes.size >= requiredVotes) {
            this.endSurrenderVote(team, true);
        }
        else if (teamVotes.yes.size + teamVotes.no.size >= teamPlayerCount) {
            this.endSurrenderVote(team, false);
        }
    }
    endSurrenderVote(team, passed) {
        const teamVotes = this.surrenderVotes.get(team);
        if (!teamVotes)
            return;
        teamVotes.inProgress = false;
        this.emit('surrenderVoteEnded', { team, passed });
        if (passed) {
            this.endGame(team === 'blue' ? 'red' : 'blue'); // Other team wins
        }
    }
    checkSurrender() {
        // Check if surrender should be enabled based on game duration
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
    updateBuffs(entity, _dt) {
        // Buffs are handled by CombatSystem
    }
    applyStates(entity, _dt) {
        // States are handled by CombatSystem
    }
    // ==========================================
    // AI
    // ==========================================
    addAIPlayer(userId, team, difficulty) {
        const ai = new AIGuy_1.AIGuy(userId, this, team, difficulty);
        this.aiPlayers.set(userId, ai);
        // Spawn AI champion
        const championId = this.getRandomChampionId();
        this.spawnChampion(userId, team, championId, this.players.size);
        this.items.initializeEntity(userId);
        this.abilities.initializeAbilityLevels(userId);
        ai.start();
        logger_1.logger.info(`🤖 AI player added: ${userId} (${difficulty})`);
    }
    getRandomChampionId() {
        const champions = ['ahri', 'garen', 'jinx', 'lux', 'yasuo', 'nasus', 'thresh', 'leesin'];
        return champions[Math.floor(Math.random() * champions.length)];
    }
    updateAI(_dt) {
        for (const ai of this.aiPlayers.values()) {
            ai.update(_dt);
        }
    }
    // ==========================================
    // WIN CONDITION
    // ==========================================
    checkWinCondition() {
        const blueNexus = this.state.entities['blue-nexus'];
        const redNexus = this.state.entities['red-nexus'];
        if (!blueNexus || !redNexus)
            return;
        if (this.isDead(blueNexus)) {
            this.endGame('red');
        }
        else if (this.isDead(redNexus)) {
            this.endGame('blue');
        }
    }
    updateTeamStats() {
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
                if (entity.team === 'blue')
                    blueTowers++;
                else
                    redTowers++;
            }
        }
        this.state.teams[0].towers = blueTowers;
        this.state.teams[1].towers = redTowers;
    }
    endGame(winner) {
        if (this.state.phase === 'end')
            return;
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
        logger_1.logger.info(`🏆 Game ${this.id} ended. Winner: ${winner} after ${this.state.time.toFixed(0)}s`);
    }
    // ==========================================
    // NETWORKING
    // ==========================================
    emitState() {
        // Only send snapshot periodically
        if (this.tick - this.lastSnapshotTick < this.snapshotInterval) {
            return;
        }
        this.lastSnapshotTick = this.tick;
        this.emit('stateUpdate', this.getSnapshot());
    }
    getSnapshot() {
        return { ...this.state };
    }
    getEntityState(entityId) {
        const entity = this.state.entities[entityId];
        return entity ? { ...entity } : null;
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
    getItemStat(entityId, statName) {
        return this.items.getItemStat(entityId, statName);
    }
    getItemBonuses(entityId) {
        return this.items.getItemBonuses(entityId);
    }
    recalculateEntityStats(entityId) {
        // Delegate to combat system
    }
    // ==========================================
    // EVENTS
    // ==========================================
    addGameEvent(type, data) {
        this.state.events.push({
            id: (0, uuid_1.v4)(),
            type: type,
            timestamp: this.state.time,
            data,
        });
        // Keep events bounded
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
}
exports.GameEngine = GameEngine;
//# sourceMappingURL=GameEngine.js.map