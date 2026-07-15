FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma client and push schema
RUN npx prisma generate
RUN npx prisma db push

# Copy source code
COPY . .

# Build TypeScript
RUN npx tsc

# Move dist to correct location
RUN mkdir -p dist/server-dist && mv dist/server/src/* dist/server-dist/ || mv dist/* dist/server-dist/ 2>/dev/null || true

EXPOSE 4000

CMD ["node", "dist/server-dist/index.js"]
