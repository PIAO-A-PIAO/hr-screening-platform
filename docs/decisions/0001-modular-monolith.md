# ADR 0001 — Modular monolith

## Status

Accepted for the internal pilot.

## Decision

Use one TypeScript monorepo containing one Next.js web application, one modular NestJS API, one PostgreSQL database package, and shared packages. Add a separately runnable worker only when durable background work begins.

## Reason

Two developers can build, test, deploy, and change complete hiring workflows without service-to-service operational overhead. NestJS module boundaries preserve a later extraction path if measured scale requires it.
