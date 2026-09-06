FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
COPY . .
RUN bun run build
ENV PORT=4321
EXPOSE 4321
CMD ["bun", "./dist/server/entry.mjs"]
