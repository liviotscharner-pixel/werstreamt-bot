FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY streamers.json ./
COPY src ./src

# data/ is created at runtime; mount a volume in production if desired
RUN mkdir -p /app/data

ENV NODE_ENV=production
CMD ["npm", "start"]
