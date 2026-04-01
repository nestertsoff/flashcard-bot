# Stage 1: Build React frontend
FROM node:20-alpine AS build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY src/ src/
COPY --from=build /app/client/dist client/dist/
EXPOSE 3000
VOLUME /app/data
CMD ["node", "src/index.js"]
