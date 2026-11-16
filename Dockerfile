FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

ENV NODE_ENV=production
EXPOSE 3010 50051

CMD ["npm", "start"]
