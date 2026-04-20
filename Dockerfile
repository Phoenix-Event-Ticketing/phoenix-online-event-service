
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

USER 1000:1000

EXPOSE 4001

CMD ["node", "src/server.js"]
