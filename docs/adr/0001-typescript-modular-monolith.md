# ADR 0001: Transitional TypeScript modular monolith

Status: proposed; engineering and security review required.

Keep Spring authoritative while a NestJS/Fastify sidecar is built incrementally. PostgreSQL remains authoritative and Flyway history remains untouched. Do not enable a sidecar business endpoint or database writer until contract, authorization, MFA, audit, transaction and migration parity are demonstrated. Prefer a modular monolith with explicit domain ownership.

Sidecar health reports process readiness only. Roll back this foundation by disabling its optional Compose profile or reverting its additive files. The existing Java service, web lockfile and database volume are unaffected. Production release gates remain in force.
