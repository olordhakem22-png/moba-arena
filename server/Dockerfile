FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copy and generate prisma client
COPY database/prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 4000

CMD ["npx", "tsx", "src/index.ts"]
