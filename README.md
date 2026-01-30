# Fluxora

Fluxora is a production-grade backend rate limiting and API traffic control platform built with Node.js, Express.js, PostgreSQL, and Redis. It enables developers to create API keys, configure dynamic rate limiting rules, and protect services using multiple algorithms including Fixed Window, Sliding Window, and Token Bucket.

Fluxora focuses on scalable backend architecture and distributed systems concepts such as Redis-based counters, asynchronous logging pipelines, analytics aggregation workers, audit logging, idempotency, webhook alerts, and fault-tolerant fallback strategies. The project is designed to simulate real-world infrastructure systems used in API gateways, developer platforms, and cloud services.

## Key features:

- JWT authentication
- API key management
- Configurable rate limiting rules
- Multiple rate limiting algorithms
- Redis-powered distributed limiting
- PostgreSQL analytics and audit storage
- BullMQ background workers
- Request analytics and monitoring
- Idempotency support
- Webhook alerting
- Dockerized infrastructure
- Production-grade modular backend architecture

See [docs/README.md](docs/README.md) for setup and scripts.
