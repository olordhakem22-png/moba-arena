FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copy and generate prisma client
COPY database/prisma ./prisma
RUN npx prisma generate

COPY . .

ENV DATABASE_URL=${DATABASE_URL}

EXPOSE 4000

CMD ["npx", "tsx", "src/index.ts"]
