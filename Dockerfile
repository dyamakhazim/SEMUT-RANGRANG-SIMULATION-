FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080 DB_FILE=/data/semut.db
EXPOSE 8080
CMD ["node", "--no-warnings", "server/index.js"]
