# Fluxora 

Fluxora is a production-grade backend rate limiting and API traffic control platform built with Node.js, Express.js, PostgreSQL, and Redis. It enables developers to create API keys, configure dynamic rate limiting rules, and protect services using multiple algorithms including Fixed Window, Sliding Window, and Token Bucket.

Fluxora focuses on scalable backend architecture and distributed systems concepts such as Redis-based counters, asynchronous logging pipelines, analytics aggregation workers, audit logging, idempotency, webhook alerts, and fault-tolerant fallback strategies. The project is designed to simulate real-world infrastructure systems used in API gateways, developer platforms, and cloud services.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create an environment file:

   ```bash
   cp .env.example .env
   ```

3. Generate the Prisma client and run migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. Start the API:

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` starts the API with nodemon.
- `npm start` starts the API with Node.js.
- `npm test` runs Jest tests.
- `npm run worker` starts BullMQ workers.
- `npm run prisma:migrate` creates and applies local migrations.
- `npm run prisma:deploy` applies migrations in production.
