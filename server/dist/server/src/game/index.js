"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameManager = exports.GameManager = exports.MMRCaclulatorWrapper = exports.MMRCalculator = exports.mmrCalculator = exports.DraftManager = exports.MatchmakingService = exports.matchmakingService = void 0;
/**
 * Game Module - Barrel Export
 */
var matchmaking_1 = require("./matchmaking");
Object.defineProperty(exports, "matchmakingService", { enumerable: true, get: function () { return matchmaking_1.matchmakingService; } });
Object.defineProperty(exports, "MatchmakingService", { enumerable: true, get: function () { return matchmaking_1.MatchmakingService; } });
var draft_1 = require("./draft");
Object.defineProperty(exports, "DraftManager", { enumerable: true, get: function () { return draft_1.DraftManager; } });
var mmr_1 = require("./mmr");
Object.defineProperty(exports, "mmrCalculator", { enumerable: true, get: function () { return mmr_1.mmrCalculator; } });
Object.defineProperty(exports, "MMRCalculator", { enumerable: true, get: function () { return mmr_1.MMRCalculator; } });
Object.defineProperty(exports, "MMRCaclulatorWrapper", { enumerable: true, get: function () { return mmr_1.MMRCaclulatorWrapper; } });
var GameManager_1 = require("./managers/GameManager");
Object.defineProperty(exports, "GameManager", { enumerable: true, get: function () { return GameManager_1.GameManager; } });
Object.defineProperty(exports, "gameManager", { enumerable: true, get: function () { return GameManager_1.gameManager; } });
//# sourceMappingURL=index.js.map