"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
exports.prisma = new client_1.PrismaClient({
    log: ['error', 'warn'],
});
async function connectDB() {
    try {
        await exports.prisma.$connect();
        logger_1.logger.info('✅ Database connected');
    }
    catch (error) {
        logger_1.logger.error('❌ Database connection failed:', error);
        throw error;
    }
}
async function disconnectDB() {
    await exports.prisma.$disconnect();
}
//# sourceMappingURL=database.js.map