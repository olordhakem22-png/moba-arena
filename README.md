# MOBA Arena - Browser-Based MOBA Game 🎮⚔️

A full-stack competitive MOBA game inspired by League of Legends, built entirely in the browser. Real-time multiplayer combat, ranked matchmaking, champion abilities, and everything you'd expect from a modern MOBA.

## 🏗️ Architecture

```
moba-game/
├── client/          # Next.js + React + TypeScript + Tailwind + Phaser.js
├── server/          # Node.js + Express + TypeScript + Socket.IO
├── shared/          # Shared types & constants (TypeScript)
├── database/        # Prisma schema + migrations
├── docker/          # Docker & Nginx configuration
└── docs/            # Architecture & API docs
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker (optional, for containerized setup)
- PostgreSQL 16+ (if running without Docker)
- Redis (if running without Docker)

### Development Setup

```bash
# 1. Clone & install
npm install

# 2. Copy environment
cp .env.example .env

# 3. Start databases (Docker)
docker-compose -f docker/docker-compose.yml up -d postgres redis

# 4. Setup database
npm run db:migrate
npm run db:seed

# 5. Start development
npm run dev
```

**URLs:**
- Client: http://localhost:3000
- Server: http://localhost:4000
- API Docs: http://localhost:4000/api/docs
- Prisma Studio: `npm run db:studio`

### Docker Setup

```bash
cp .env.example .env
# Edit .env with strong passwords

docker-compose -f docker/docker-compose.yml up --build
```

## 🛠️ Tech Stack

### Frontend
- **React 18** + **TypeScript 5** + **Vite 5**
- **Tailwind CSS** for styling
- **Phaser.js 3** for game rendering (canvas-based)
- **Zustand** for state management
- **Socket.IO Client** for real-time communication
- **React Router** for navigation
- **Framer Motion** for animations

### Backend
- **Node.js** + **Express** + **TypeScript**
- **Socket.IO** for real-time game state
- **JWT** + Refresh Tokens for authentication
- **Prisma** ORM with **PostgreSQL**
- **Redis** for pub/sub and caching
- **Zod** for validation
- **Helmet** + **CORS** for security

### Infrastructure
- **Docker** + **Docker Compose**
- **Nginx** as reverse proxy
- **PostgreSQL 16**
- **Redis 7**

## 🎮 Features

### Core Gameplay
- [x] Real-time game engine (20 TPS server simulation)
- [x] Champion movement, attacks, abilities (Q/W/E/R)
- [x] Minion waves with AI pathfinding
- [x] Tower defense mechanics
- [x] Jungle monsters & objectives (Dragon, Baron)
- [x] Fog of war & vision system
- [x] Gold, XP, leveling system
- [x] Combat damage calculation (physical/magic/true)
- [x] Buff/debuff system

### Champions
- [x] 8 playable champions with unique abilities
- [x] Passive, Q, W, E, R abilities
- [x] Cooldown management
- [x] Mana costs
- [x] Stats system (health, AD, armor, MR, etc.)

### Multiplayer
- [x] Socket.IO real-time communication
- [x] Game state synchronization
- [x] Player input processing
- [x] Matchmaking queue
- [x] Chat system
- [x] Ping system
- [x] Emotes
- [x] Spectator mode hooks
- [x] Reconnection handling

### Ranking & Progression
- [x] Ranked matchmaking (Bronze → Challenger)
- [x] LP system with promotions
- [x] MMR calculation
- [x] Win/loss tracking
- [x] Champion masteries
- [x] Player profiles with stats

### Economy
- [x] Blue Essence & RP currencies
- [x] Champion purchasing
- [x] Skin system
- [x] Inventory management
- [x] Transaction history

### Moderation
- [x] User reporting system
- [x] Ban/unban functionality
- [x] Admin panel
- [x] Activity logs

## 🎨 Screenshots

The game features:
- Canvas-rendered map with minimap
- Champion selection during loading
- Real-time health bars and effects
- Skillshot projectiles
- Chat overlay
- Ping system

## 📡 Socket.IO Events

### Client → Server
```
game:join        - Join a game room
game:ready       - Player loaded, ready to play
game:input       - Send player input (move/attack/ability)
game:chat        - Send chat message
game:ping        - Send map ping
game:emote       - Send emote
game:surrender   - Initiate surrender vote
queue:join       - Join matchmaking
queue:cancel     - Cancel queue
```

### Server → Client
```
game:joined      - Successfully joined game
game:state       - Game state update
game:chat        - Chat message received
game:ping        - Ping received
game:emote       - Emote received
game:ended       - Game ended
queue:matched    - Match found
```

## 📁 Key Files

### Server
- `server/src/game/engine/GameEngine.ts` - Core game loop
- `server/src/game/engine/CombatSystem.ts` - Damage calculation
- `server/src/game/engine/AbilitySystem.ts` - Ability execution
- `server/src/game/engine/MinionManager.ts` - Minion AI
- `server/src/socket/index.ts` - Socket.IO handlers
- `server/src/game/managers/GameManager.ts` - Multi-game orchestration

### Client
- `client/src/components/game/GameScene.ts` - Phaser game rendering
- `client/src/components/pages/PlayPage.tsx` - Matchmaking UI
- `client/src/stores/socketStore.ts` - Socket state management
- `client/src/stores/authStore.ts` - Auth state

### Shared
- `shared/src/types/game.ts` - All game types
- `shared/src/constants/game.ts` - Game constants
- `database/prisma/schema.prisma` - Database schema

## 🔒 Security

- JWT access tokens (15min) + refresh tokens (7 days)
- Password hashing with bcrypt (12 rounds)
- Rate limiting on auth endpoints
- Helmet security headers
- CORS configuration
- Input validation with Zod
- SQL injection prevention via Prisma
- XSS protection

## 📈 Performance

- Server tick rate: 20 TPS (configurable)
- Client interpolation for smooth rendering
- Delta compression for state updates
- Redis pub/sub for horizontal scaling
- Connection pooling (PostgreSQL)
- CDN-ready static assets

## 🔮 Roadmap

- [ ] Champion select with bans
- [ ] Full item shop in-game
- [ ] Replay system
- [ ] Tournament mode
- [ ] Clan system
- [ ] Mobile-responsive UI
- [ ] Sound effects & music
- [ ] WebGL renderer (upgrade from Canvas)

## 📄 License

MIT
