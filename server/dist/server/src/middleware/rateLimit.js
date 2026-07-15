"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const index_js_1 = require("../config/index.js");
function rateLimit(max, windowMs) {
    return (0, express_rate_limit_1.default)({
        windowMs: windowMs ?? index_js_1.config.rateLimit.windowMs,
        max: max ?? index_js_1.config.rateLimit.max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, please try again later.' },
        keyGenerator: (req) => {
            return req.ip || req.headers['x-forwarded-for'] || 'unknown';
        },
    });
}
//# sourceMappingURL=rateLimit.js.map