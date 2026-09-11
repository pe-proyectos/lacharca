FROM oven/bun:latest
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock* ./
COPY prisma ./prisma
RUN bun install && bunx prisma generate
COPY . .
EXPOSE 3200
CMD ["sh","-c","bunx prisma db push --skip-generate && bun src/index.ts"]
