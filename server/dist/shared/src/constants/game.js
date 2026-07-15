"use strict";
// ============================================
// GAME CONSTANTS
// All magic numbers live here
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_BASE_URL = exports.GAME_WS_URL = exports.GAME_SERVER_URL = exports.RANK_DIVISIONS = exports.RANK_THRESHOLDS = exports.MAP_CONFIG = exports.GAME_CONSTANTS = void 0;
exports.GAME_CONSTANTS = {
    // --- Map ---
    MAP_WIDTH: 14870,
    MAP_HEIGHT: 14870,
    GRID_SIZE: 50,
    TICK_RATE: 20, // server ticks per second
    CLIENT_TICK_RATE: 20,
    // --- Timing ---
    GAME_START_COUNTDOWN: 90, // seconds
    MIN_GAME_DURATION: 180, // can't surrender before this
    SURRENDER_VOTE_TIMEOUT: 30,
    PAUSE_DURATION: 600, // max pause in seconds
    // --- Levels ---
    MAX_LEVEL: 18,
    BASE_XP_PER_LEVEL: [0, 280, 660, 1140, 1720, 2400, 3180, 4060, 5040, 6120, 7300, 8580, 9960, 11440, 13020, 14700, 16480, 18360],
    XP_FIRST_BLOOD_BONUS: 150,
    // --- Gold ---
    STARTING_GOLD: 500,
    PASSIVE_GOLD_PER_SECOND: 2.0,
    GOLD_PER_CS: 15,
    KILL_GOLD_BASE: 300,
    TOWER_GOLD_SPLIT: [150, 150, 150, 200], // per plating
    TOWER_GOLD_LOCAL: 50,
    // --- Combat ---
    BASE_ATTACK_TIME: 1.6,
    GLOBAL_TOWER_RANGE: 850,
    NEXUS_RANGE: 1250,
    INHIBITOR_RANGE: 850,
    RECALL_TIME: 8,
    RECALL_HP_THRESHOLD: 0.4, // cancel recall if HP goes below
    // --- Vision ---
    SIGHT_RANGE_MEDIUM: 1450,
    SIGHT_RANGE_LARGE: 2300,
    CLONE_SHARE_RANGE: 700,
    TRINKET_WARD_RANGE: 1100,
    CONTROL_WARD_RANGE: 900,
    // --- Minions ---
    MINION_SPAWN_INTERVAL: 30, // seconds
    MINION_FIRST_SPAWN: 90, // seconds into game
    MINION_WAYPOINT_THRESHOLD: 30,
    MINION_AGGRO_RANGE: 400,
    MINION_TOWER_AGGRO_PRIORITY: ['minion', 'champion', 'minion'], // priority order
    // --- Neutral Objectives ---
    DRAGON_SPAWN: 240, // 4 min
    DRAGON_RESPAWN: 300, // 5 min
    RIFT_HERALD_SPAWN: 240,
    RIFT_HERALD_RESPAWN: 360,
    BARON_SPAWN: 900, // 15 min
    BARON_RESPAWN: 360,
    // --- Abilities ---
    ABILITY_LEVELUP_XP_COST: [0, 0, 0, 0, 0, 0], // XP cost to level at each level
    ULTIMATE_LEVEL: 6,
    // --- Items ---
    MAX_ITEMS: 6,
    TRINKET_SLOT: 6,
    CONSUMABLE_SLOT: 7,
    // --- Client ---
    INPUT_BUFFER_SIZE: 128,
    SNAPSHOT_COMPRESSION: 0.4,
    MAX_RECONNECT_TIME: 30,
    // --- Matchmaking ---
    MMR_RANGE_START: 500,
    MMR_RANGE_MAX: 500,
    QUEUE_TIMEOUT: 300, // seconds
    // --- Ranking ---
    LP_GAIN_BASE: 20,
    LP_GAIN_STREAK_MULT: 1.5,
    LP_LOSS_BASE: 20,
    PROMOTION_GAMES: 3,
    LP_DECAY_THRESHOLD_DAYS: 28,
    LP_DECAY_PER_WEEK: 50,
};
exports.MAP_CONFIG = {
    name: 'Summoners Rift',
    width: 14870,
    height: 14870,
    gridSize: 50,
    MAP_WIDTH: 14870,
    MAP_HEIGHT: 14870,
    GRID_SIZE: 50,
    TICK_RATE: 20,
    GAME_START_COUNTDOWN: 90,
    MIN_GAME_DURATION: 180,
    PASSIVE_GOLD_PER_SECOND: 2.0,
    KILL_GOLD_BASE: 300,
    DRAGON_SPAWN: 240,
    DRAGON_RESPAWN: 300,
    RIFT_HERALD_SPAWN: 240,
    RIFT_HERALD_RESPAWN: 360,
    BARON_SPAWN: 900,
    BARON_RESPAWN: 360,
    MINION_SPAWN_INTERVAL: 30,
    MINION_FIRST_SPAWN: 90,
    MINION_WAYPOINT_THRESHOLD: 30,
    RECALL_TIME: 8,
    SIGHT_RANGE_MEDIUM: 1450,
    STARTING_GOLD: 500,
    MAX_LEVEL: 18,
    GLOBAL_TOWER_RANGE: 850,
    MAX_ITEMS: 6,
    centerX: 7435,
    centerY: 7435,
    laneWidth: 600,
    // Spawn points
    BLUE_SPAWN: { x: 1380, y: 1380 },
    RED_SPAWN: { x: 13490, y: 13490 },
    // Nexus positions
    BLUE_NEXUS: { x: 1420, y: 1420 },
    RED_NEXUS: { x: 13450, y: 13450 },
    // Base bounds
    BLUE_BASE: { x: 500, y: 500, w: 3000, h: 3000 },
    RED_BASE: { x: 11370, y: 11370, w: 3000, h: 3000 },
    // River
    RIVER_BOUNDS: { x: 5500, y: 5500, w: 3870, h: 3870 },
    // Towers
    TOWER_POSITIONS: {
        blue: {
            top: [
                { x: 3450, y: 1050 },
                { x: 5700, y: 1550 },
                { x: 7100, y: 2950 },
            ],
            mid: [
                { x: 2800, y: 2800 },
                { x: 4300, y: 4300 },
                { x: 5600, y: 5600 },
            ],
            bot: [
                { x: 1050, y: 3450 },
                { x: 1550, y: 5700 },
                { x: 2950, y: 7100 },
            ],
        },
        red: {
            top: [
                { x: 11420, y: 13820 },
                { x: 9180, y: 13320 },
                { x: 7780, y: 11920 },
            ],
            mid: [
                { x: 12070, y: 12070 },
                { x: 10570, y: 10570 },
                { x: 9270, y: 9270 },
            ],
            bot: [
                { x: 13820, y: 11420 },
                { x: 13320, y: 9180 },
                { x: 11920, y: 7780 },
            ],
        },
    },
    // Inhibitor positions
    INHIBITOR_POSITIONS: {
        blue: {
            top: { x: 2100, y: 700 },
            mid: { x: 2500, y: 2500 },
            bot: { x: 700, y: 2100 },
        },
        red: {
            top: { x: 12770, y: 14170 },
            mid: { x: 12370, y: 12370 },
            bot: { x: 14170, y: 12770 },
        },
    },
    // Jungle camps
    JUNGLE_CAMPS: {
        blue: {
            camps: [
                { id: 'blue巨石', x: 3400, y: 6100, type: 'ancient' },
                { id: 'red狼人', x: 6400, y: 3400, type: 'ancient' },
                { id: 'blue-gromp', x: 2100, y: 8000, type: 'small' },
                { id: 'blue-wolves', x: 3600, y: 7500, type: 'medium' },
                { id: 'blue-raptor', x: 7000, y: 4300, type: 'medium' },
                { id: 'blue-krugs', x: 5000, y: 10100, type: 'large' },
                { id: 'blue-shrimp', x: 6600, y: 6400, type: 'small' },
            ],
        },
        red: {
            camps: [
                { id: 'red巨石', x: 11470, y: 8770, type: 'ancient' },
                { id: 'blue狼人', x: 8480, y: 11470, type: 'ancient' },
                { id: 'red-gromp', x: 12770, y: 6870, type: 'small' },
                { id: 'red-wolves', x: 11270, y: 7380, type: 'medium' },
                { id: 'red-raptor', x: 7880, y: 10570, type: 'medium' },
                { id: 'red-krugs', x: 9880, y: 4780, type: 'large' },
                { id: 'red-shrimp', x: 8270, y: 8480, type: 'small' },
            ],
        },
    },
};
exports.RANK_THRESHOLDS = [
    { rank: 'Bronze', mmr: 0, lp: 0 },
    { rank: 'Silver', mmr: 1000, lp: 0 },
    { rank: 'Gold', mmr: 1500, lp: 0 },
    { rank: 'Platinum', mmr: 2200, lp: 0 },
    { rank: 'Diamond', mmr: 3000, lp: 0 },
    { rank: 'Master', mmr: 4000, lp: 0 },
    { rank: 'Grandmaster', mmr: 5000, lp: 0 },
    { rank: 'Challenger', mmr: 6000, lp: 0 },
];
exports.RANK_DIVISIONS = [1, 2, 3, 4];
exports.GAME_SERVER_URL = process.env.GAME_SERVER_URL || 'http://localhost:4000';
exports.GAME_WS_URL = process.env.GAME_WS_URL || 'ws://localhost:4000';
exports.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api';
//# sourceMappingURL=game.js.map