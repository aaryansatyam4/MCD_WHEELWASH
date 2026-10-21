FROM node:22-alpine AS build

WORKDIR /app

# Copy package manifests
COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm run install:all

# Copy source code
COPY backend ./backend
COPY frontend ./frontend

# Build frontend and backend
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/public ./backend/public
COPY --from=build /app/frontend/dist ./frontend/dist

EXPOSE 5001

CMD ["node", "backend/dist/server.js"]
