"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const index_js_1 = require("./socket/index.js");
const database_js_1 = require("./config/database.js");
const index_js_2 = require("./routes/index.js");
const errorHandler_js_1 = require("./middleware/errorHandler.js");
const security_js_1 = require("./middleware/security.js");
const logger_js_1 = require("./utils/logger.js");
const index_js_3 = require("./config/index.js");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// --- Middleware ---
(0, security_js_1.securityMiddleware)(app);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('combined'));
// --- Routes ---
(0, index_js_2.setupRoutes)(app);
// --- Socket.IO (Game Server) ---
(0, index_js_1.setupSocketIO)(httpServer);
// --- Error Handler ---
app.use(errorHandler_js_1.errorHandler);
// --- Start ---
async function start() {
    try {
        await (0, database_js_1.connectDB)();
        httpServer.listen(index_js_3.config.port, () => {
            logger_js_1.logger.info(`🚀 Server running on port ${index_js_3.config.port}`);
            logger_js_1.logger.info(`📡 Socket.IO ready for connections`);
            logger_js_1.logger.info(`🔗 API: http://localhost:${index_js_3.config.port}/api`);
        });
    }
    catch (error) {
        logger_js_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
start();
//# sourceMappingURL=index.js.map