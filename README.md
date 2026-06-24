# LexCom Apps

[![CI](https://github.com/penshopx/LexCom-Apps-3/actions/workflows/ci.yml/badge.svg)](https://github.com/penshopx/LexCom-Apps-3/actions/workflows/ci.yml)

Agentic AI platform for Indonesian law — pnpm monorepo built with TypeScript, Express 5, PostgreSQL, and Drizzle ORM.

## Structure

```
artifacts/
  api-server/       Express API server
  lexcom/           LexCom web app
lib/
  api-spec/         OpenAPI spec + Orval codegen
  api-client-react/ Generated React Query hooks
  api-zod/          Generated Zod schemas
  db/               Drizzle ORM schema + DB connection
scripts/            Utility scripts
```

## Getting Started

```bash
pnpm install
pnpm run dev
```

## Running Tests

```bash
pnpm test
```
