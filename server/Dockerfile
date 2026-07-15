FROM node:20-alpine

WORKDIR /app

# Copy server files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src/

# Install dependencies
RUN npm install

# Generate Prisma client and push schema
RUN npx prisma generate
RUN npx prisma db push

# Build TypeScript
RUN npx tsc

# Create correct dist structure
RUN mkdir -p dist/server-dist && cp -r dist/src/* dist/server-dist/ 2>/dev/null || mv dist/src dist/server-dist

EXPOSE 4000

CMD ["node", "dist/server-dist/index.js"]
