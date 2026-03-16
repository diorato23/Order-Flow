# Workspace

## Overview

Comanda Eletrônica — A full-stack restaurant order management system (mobile app for waiters + kitchen display + admin dashboard).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) with Expo Router

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── comanda/            # Expo mobile app (waiter + kitchen + admin)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/
│   └── src/seed.ts         # Database seeder (run once to populate menu/tables)
```

## Database Schema

- `tables` — Restaurant tables with status (available/occupied/reserved/cleaning)
- `categories` — Menu categories (Bebidas, Entradas, Pratos Principais, Sobremesas)
- `menu_items` — Menu items with price, description, prep time
- `orders` — Orders linked to tables with status (pending/preparing/ready/delivered/cancelled)
- `order_items` — Line items within orders

## API Endpoints

- `GET/POST /api/tables` — List and create tables
- `GET/PATCH/DELETE /api/tables/:id` — Table CRUD
- `GET /api/tables/:id/orders` — Orders for a table
- `GET/POST /api/orders` — List and create orders (supports `?status` and `?tableId` filter)
- `GET/PATCH/DELETE /api/orders/:id` — Order CRUD
- `GET/POST /api/menu` — Menu item listing and creation
- `PATCH/DELETE /api/menu/:id` — Menu item update/delete
- `GET/POST /api/categories` — Category listing and creation
- `GET /api/stats` — Restaurant stats (revenue, top items, occupancy)

## App Screens

- **Mesas (Tables)**: Grid view of all tables with status filters, add table modal
- **Cozinha (Kitchen)**: Live orders with status progression (pending → preparing → ready → delivered)
- **Cardápio (Menu)**: Menu items by category with availability toggle, add item
- **Relatórios (Dashboard)**: Stats overview — revenue, ticket, orders, top items, occupancy
- **Table Detail**: Orders for a table, total bill, change status
- **New Order**: Browse menu by category, add to cart, notes per item, send to kitchen

## Design

- Dark espresso/amber color palette suited to restaurant environments
- Warm, premium restaurant aesthetic with liquid glass tab bar on iOS 26+
- Supports Portuguese (primary language)

## Seeding

Run once to populate the database:
```
pnpm --filter @workspace/scripts run seed
```
