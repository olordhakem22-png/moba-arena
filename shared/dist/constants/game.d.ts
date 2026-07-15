export declare const GAME_CONSTANTS: {
    readonly MAP_WIDTH: 14870;
    readonly MAP_HEIGHT: 14870;
    readonly GRID_SIZE: 50;
    readonly TICK_RATE: 20;
    readonly CLIENT_TICK_RATE: 20;
    readonly GAME_START_COUNTDOWN: 90;
    readonly MIN_GAME_DURATION: 180;
    readonly SURRENDER_VOTE_TIMEOUT: 30;
    readonly PAUSE_DURATION: 600;
    readonly MAX_LEVEL: 18;
    readonly BASE_XP_PER_LEVEL: readonly [0, 280, 660, 1140, 1720, 2400, 3180, 4060, 5040, 6120, 7300, 8580, 9960, 11440, 13020, 14700, 16480, 18360];
    readonly XP_FIRST_BLOOD_BONUS: 150;
    readonly STARTING_GOLD: 500;
    readonly PASSIVE_GOLD_PER_SECOND: 2;
    readonly GOLD_PER_CS: 15;
    readonly KILL_GOLD_BASE: 300;
    readonly TOWER_GOLD_SPLIT: readonly [150, 150, 150, 200];
    readonly TOWER_GOLD_LOCAL: 50;
    readonly BASE_ATTACK_TIME: 1.6;
    readonly GLOBAL_TOWER_RANGE: 850;
    readonly NEXUS_RANGE: 1250;
    readonly INHIBITOR_RANGE: 850;
    readonly RECALL_TIME: 8;
    readonly RECALL_HP_THRESHOLD: 0.4;
    readonly SIGHT_RANGE_MEDIUM: 1450;
    readonly SIGHT_RANGE_LARGE: 2300;
    readonly CLONE_SHARE_RANGE: 700;
    readonly TRINKET_WARD_RANGE: 1100;
    readonly CONTROL_WARD_RANGE: 900;
    readonly MINION_SPAWN_INTERVAL: 30;
    readonly MINION_FIRST_SPAWN: 90;
    readonly MINION_WAYPOINT_THRESHOLD: 30;
    readonly MINION_AGGRO_RANGE: 400;
    readonly MINION_TOWER_AGGRO_PRIORITY: readonly ["minion", "champion", "minion"];
    readonly DRAGON_SPAWN: 240;
    readonly DRAGON_RESPAWN: 300;
    readonly RIFT_HERALD_SPAWN: 240;
    readonly RIFT_HERALD_RESPAWN: 360;
    readonly BARON_SPAWN: 900;
    readonly BARON_RESPAWN: 360;
    readonly ABILITY_LEVELUP_XP_COST: readonly [0, 0, 0, 0, 0, 0];
    readonly ULTIMATE_LEVEL: 6;
    readonly MAX_ITEMS: 6;
    readonly TRINKET_SLOT: 6;
    readonly CONSUMABLE_SLOT: 7;
    readonly INPUT_BUFFER_SIZE: 128;
    readonly SNAPSHOT_COMPRESSION: 0.4;
    readonly MAX_RECONNECT_TIME: 30;
    readonly MMR_RANGE_START: 500;
    readonly MMR_RANGE_MAX: 500;
    readonly QUEUE_TIMEOUT: 300;
    readonly LP_GAIN_BASE: 20;
    readonly LP_GAIN_STREAK_MULT: 1.5;
    readonly LP_LOSS_BASE: 20;
    readonly PROMOTION_GAMES: 3;
    readonly LP_DECAY_THRESHOLD_DAYS: 28;
    readonly LP_DECAY_PER_WEEK: 50;
};
export declare const MAP_CONFIG: {
    readonly name: "Summoners Rift";
    readonly width: 14870;
    readonly height: 14870;
    readonly gridSize: 50;
    readonly MAP_WIDTH: 14870;
    readonly MAP_HEIGHT: 14870;
    readonly GRID_SIZE: 50;
    readonly TICK_RATE: 20;
    readonly GAME_START_COUNTDOWN: 90;
    readonly MIN_GAME_DURATION: 180;
    readonly PASSIVE_GOLD_PER_SECOND: 2;
    readonly KILL_GOLD_BASE: 300;
    readonly DRAGON_SPAWN: 240;
    readonly DRAGON_RESPAWN: 300;
    readonly RIFT_HERALD_SPAWN: 240;
    readonly RIFT_HERALD_RESPAWN: 360;
    readonly BARON_SPAWN: 900;
    readonly BARON_RESPAWN: 360;
    readonly MINION_SPAWN_INTERVAL: 30;
    readonly MINION_FIRST_SPAWN: 90;
    readonly MINION_WAYPOINT_THRESHOLD: 30;
    readonly RECALL_TIME: 8;
    readonly SIGHT_RANGE_MEDIUM: 1450;
    readonly STARTING_GOLD: 500;
    readonly MAX_LEVEL: 18;
    readonly GLOBAL_TOWER_RANGE: 850;
    readonly MAX_ITEMS: 6;
    readonly centerX: 7435;
    readonly centerY: 7435;
    readonly laneWidth: 600;
    readonly BLUE_SPAWN: {
        readonly x: 1380;
        readonly y: 1380;
    };
    readonly RED_SPAWN: {
        readonly x: 13490;
        readonly y: 13490;
    };
    readonly BLUE_NEXUS: {
        readonly x: 1420;
        readonly y: 1420;
    };
    readonly RED_NEXUS: {
        readonly x: 13450;
        readonly y: 13450;
    };
    readonly BLUE_BASE: {
        readonly x: 500;
        readonly y: 500;
        readonly w: 3000;
        readonly h: 3000;
    };
    readonly RED_BASE: {
        readonly x: 11370;
        readonly y: 11370;
        readonly w: 3000;
        readonly h: 3000;
    };
    readonly RIVER_BOUNDS: {
        readonly x: 5500;
        readonly y: 5500;
        readonly w: 3870;
        readonly h: 3870;
    };
    readonly TOWER_POSITIONS: {
        readonly blue: {
            readonly top: readonly [{
                readonly x: 3450;
                readonly y: 1050;
            }, {
                readonly x: 5700;
                readonly y: 1550;
            }, {
                readonly x: 7100;
                readonly y: 2950;
            }];
            readonly mid: readonly [{
                readonly x: 2800;
                readonly y: 2800;
            }, {
                readonly x: 4300;
                readonly y: 4300;
            }, {
                readonly x: 5600;
                readonly y: 5600;
            }];
            readonly bot: readonly [{
                readonly x: 1050;
                readonly y: 3450;
            }, {
                readonly x: 1550;
                readonly y: 5700;
            }, {
                readonly x: 2950;
                readonly y: 7100;
            }];
        };
        readonly red: {
            readonly top: readonly [{
                readonly x: 11420;
                readonly y: 13820;
            }, {
                readonly x: 9180;
                readonly y: 13320;
            }, {
                readonly x: 7780;
                readonly y: 11920;
            }];
            readonly mid: readonly [{
                readonly x: 12070;
                readonly y: 12070;
            }, {
                readonly x: 10570;
                readonly y: 10570;
            }, {
                readonly x: 9270;
                readonly y: 9270;
            }];
            readonly bot: readonly [{
                readonly x: 13820;
                readonly y: 11420;
            }, {
                readonly x: 13320;
                readonly y: 9180;
            }, {
                readonly x: 11920;
                readonly y: 7780;
            }];
        };
    };
    readonly INHIBITOR_POSITIONS: {
        readonly blue: {
            readonly top: {
                readonly x: 2100;
                readonly y: 700;
            };
            readonly mid: {
                readonly x: 2500;
                readonly y: 2500;
            };
            readonly bot: {
                readonly x: 700;
                readonly y: 2100;
            };
        };
        readonly red: {
            readonly top: {
                readonly x: 12770;
                readonly y: 14170;
            };
            readonly mid: {
                readonly x: 12370;
                readonly y: 12370;
            };
            readonly bot: {
                readonly x: 14170;
                readonly y: 12770;
            };
        };
    };
    readonly JUNGLE_CAMPS: {
        readonly blue: {
            readonly camps: readonly [{
                readonly id: "blue巨石";
                readonly x: 3400;
                readonly y: 6100;
                readonly type: "ancient";
            }, {
                readonly id: "red狼人";
                readonly x: 6400;
                readonly y: 3400;
                readonly type: "ancient";
            }, {
                readonly id: "blue-gromp";
                readonly x: 2100;
                readonly y: 8000;
                readonly type: "small";
            }, {
                readonly id: "blue-wolves";
                readonly x: 3600;
                readonly y: 7500;
                readonly type: "medium";
            }, {
                readonly id: "blue-raptor";
                readonly x: 7000;
                readonly y: 4300;
                readonly type: "medium";
            }, {
                readonly id: "blue-krugs";
                readonly x: 5000;
                readonly y: 10100;
                readonly type: "large";
            }, {
                readonly id: "blue-shrimp";
                readonly x: 6600;
                readonly y: 6400;
                readonly type: "small";
            }];
        };
        readonly red: {
            readonly camps: readonly [{
                readonly id: "red巨石";
                readonly x: 11470;
                readonly y: 8770;
                readonly type: "ancient";
            }, {
                readonly id: "blue狼人";
                readonly x: 8480;
                readonly y: 11470;
                readonly type: "ancient";
            }, {
                readonly id: "red-gromp";
                readonly x: 12770;
                readonly y: 6870;
                readonly type: "small";
            }, {
                readonly id: "red-wolves";
                readonly x: 11270;
                readonly y: 7380;
                readonly type: "medium";
            }, {
                readonly id: "red-raptor";
                readonly x: 7880;
                readonly y: 10570;
                readonly type: "medium";
            }, {
                readonly id: "red-krugs";
                readonly x: 9880;
                readonly y: 4780;
                readonly type: "large";
            }, {
                readonly id: "red-shrimp";
                readonly x: 8270;
                readonly y: 8480;
                readonly type: "small";
            }];
        };
    };
};
export declare const RANK_THRESHOLDS: readonly [{
    readonly rank: "Bronze";
    readonly mmr: 0;
    readonly lp: 0;
}, {
    readonly rank: "Silver";
    readonly mmr: 1000;
    readonly lp: 0;
}, {
    readonly rank: "Gold";
    readonly mmr: 1500;
    readonly lp: 0;
}, {
    readonly rank: "Platinum";
    readonly mmr: 2200;
    readonly lp: 0;
}, {
    readonly rank: "Diamond";
    readonly mmr: 3000;
    readonly lp: 0;
}, {
    readonly rank: "Master";
    readonly mmr: 4000;
    readonly lp: 0;
}, {
    readonly rank: "Grandmaster";
    readonly mmr: 5000;
    readonly lp: 0;
}, {
    readonly rank: "Challenger";
    readonly mmr: 6000;
    readonly lp: 0;
}];
export declare const RANK_DIVISIONS: readonly [1, 2, 3, 4];
export declare const GAME_SERVER_URL: string;
export declare const GAME_WS_URL: string;
export declare const API_BASE_URL: string;
//# sourceMappingURL=game.d.ts.map