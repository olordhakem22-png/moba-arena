"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectiveManager = void 0;
const game_1 = require("../../../../shared/src/constants/game");
class ObjectiveManager {
    engine;
    objectives = new Map();
    constructor(engine) {
        this.engine = engine;
        this.initializeObjectives();
    }
    initializeObjectives() {
        // Dragon
        this.objectives.set('dragon', {
            id: 'dragon',
            type: 'dragon',
            position: { x: game_1.MAP_CONFIG.centerX, y: game_1.MAP_CONFIG.centerY },
            respawnTime: game_1.GAME_CONSTANTS.DRAGON_RESPAWN,
            isAlive: true,
            spawnedAt: game_1.GAME_CONSTANTS.DRAGON_SPAWN,
            state: 'alive',
        });
        // Baron
        this.objectives.set('baron', {
            id: 'baron',
            type: 'baron',
            position: { x: game_1.MAP_CONFIG.centerX + 600, y: game_1.MAP_CONFIG.centerY + 600 },
            respawnTime: game_1.GAME_CONSTANTS.BARON_RESPAWN,
            isAlive: false,
            state: 'respawning',
        });
    }
    getObjective(id) {
        return this.objectives.get(id);
    }
    handleObjectiveKill(objectiveId, killerId) {
        const objective = this.objectives.get(objectiveId);
        if (!objective)
            return;
        const killer = this.engine.getEntity(killerId);
        if (!killer)
            return;
        objective.isAlive = false;
        objective.state = 'respawning';
        const event = {
            objectiveId,
            killedBy: killerId,
            team: killer.team,
            timestamp: this.engine.state.time,
        };
        this.engine.addGameEvent(`${objective.type}_kill`, event);
        this.engine.emit('objectiveKilled', event);
        // Apply buff to team
        this.applyObjectiveBuff(objective, killer.team);
        // Schedule respawn
        setTimeout(() => {
            objective.isAlive = true;
            objective.state = 'alive';
            objective.spawnedAt = this.engine.state.time;
            this.engine.emit('objectiveSpawned', objective);
        }, objective.respawnTime * 1000);
    }
    applyObjectiveBuff(objective, team) {
        const allies = this.engine.getTeam(team);
        switch (objective.type) {
            case 'dragon': {
                // Dragon gives team-wide stat boost
                const buffName = 'Dragon Slayer';
                for (const ally of allies) {
                    ally.buffs.push({
                        id: `dragon-buff-${Date.now()}`,
                        name: buffName,
                        icon: 'dragon',
                        stacks: 1,
                        maxStacks: 5,
                        duration: 180,
                        startTime: this.engine.state.time,
                        source: 'objective',
                        effects: [{ stat: 'currentAD', value: 8, type: 'flat' }],
                    });
                }
                this.engine.addGameEvent('dragon_kill', { team, stackCount: this.getStackCount(team) });
                break;
            }
            case 'baron': {
                // Baron gives team-wide empowered recall
                for (const ally of allies) {
                    ally.buffs.push({
                        id: `baron-buff-${Date.now()}`,
                        name: 'Baron Nashor Slayer',
                        icon: 'baron',
                        stacks: 1,
                        maxStacks: 1,
                        duration: 240,
                        startTime: this.engine.state.time,
                        source: 'objective',
                        effects: [],
                    });
                }
                this.engine.addGameEvent('baron_kill', { team });
                break;
            }
        }
    }
    getStackCount(team) {
        let count = 0;
        for (const entity of Object.values(this.engine.state.entities)) {
            if (entity.team === team) {
                count += entity.buffs.filter(b => b.name === 'Dragon Slayer').reduce((sum, b) => sum + b.stacks, 0);
            }
        }
        return count;
    }
    update(_dt) {
        // Check if objectives should spawn
        const time = this.engine.state.time;
        const baron = this.objectives.get('baron');
        if (baron && baron.state === 'respawning' && time >= game_1.GAME_CONSTANTS.BARON_SPAWN) {
            baron.isAlive = true;
            baron.state = 'alive';
            baron.spawnedAt = time;
        }
    }
}
exports.ObjectiveManager = ObjectiveManager;
//# sourceMappingURL=ObjectiveManager.js.map