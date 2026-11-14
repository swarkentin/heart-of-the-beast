# ADR 0001: Start with a Modular Monolith

- Status: Proposed
- Date: 2026-11-14

## Context

The project is at inception. The first goal is a small, playable solo/co-op vertical slice. The domain includes real-time sessions and deterministic game rules, but there is no demonstrated scale or organizational need for independently deployed services.

## Decision

Start with a modular monolith. Keep game-domain rules, session orchestration, realtime transport, persistence adapters, content definitions, and client presentation as distinct logical modules with explicit boundaries. Keep game rules independent of transport and storage.

The server is authoritative for consequential game state. Clients send player intent; the server validates and resolves it. Solo and multiplayer sessions use the same domain model, with group coordination behavior disabled or shortened when only one player is present.

## Consequences

Positive:
- Faster iteration and simpler local development/deployment.
- Easier end-to-end debugging while the game loop is evolving.
- Clear boundaries preserve the option to extract services later if evidence supports it.

Trade-offs:
- Modules share a deployment and runtime failure domain.
- Boundaries require discipline; avoid cross-module shortcuts that make later extraction difficult.

## Revisit when

Operational scale, team ownership, or independently scaling workloads demonstrate a concrete need for service extraction. Do not split services preemptively.
