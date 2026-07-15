FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist/ ./dist/
COPY server.js ./

EXPOSE 8080

CMD ["node", "server.js"]
