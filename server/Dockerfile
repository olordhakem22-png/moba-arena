FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY database/prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push && npx tsx src/index.ts"]
