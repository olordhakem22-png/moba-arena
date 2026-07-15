# Architecture Overview

## System Design

```
                    ┌─────────────────────────────────────────┐
                    │            Load Balancer                │
                    │           (Nginx / Cloud)              │
                    └──────────┬──────────────────┬───────────┘
                               │                  │
                    ┌──────────▼──┐    ┌──────────▼──┐
                    │   Client     │    │   Client    │
                    │  (Browser)   │    │  (Browser)  │
                    │  React+Phaser │    │  React+Phaser│
                    └──────┬───────┘    └──────┬───────┘
                           │ WebSocket          │ WebSocket
                    ┌──────▼──────────────────────▼───────┐
                    │          Nginx Reverse Proxy         │
                    │    (Static Files + /api routing)    │
                    └──────────┬───────────────────────────┘
                               │
                    ┌──────────▼───────────────────────────┐
                    │         Game Server (Node.js)         │
                    │   Express + Socket.IO + Game Engine   │
                    └──────────┬──────────────┬──────────────┘
                               │              │
              ┌────────────────▼──┐   ┌───────▼──────┐
              │   PostgreSQL 16    │   │   Redis 7    │
              │   (State + Auth)   │   │  (Pub/Sub)   │
              └────────────────────┘   └──────────────┘
```

## Game Server Architecture

```
┌─────────────────────────────────────────┐
│            GameEngine Instance           │
│                                         │
│  ┌─────────────┐   ┌──────────────────┐ │
│  │   Physics   │   │  CombatSystem    │ │
│  │  (Movement) │   │  (Damage/Auto)   │ │
│  └─────────────┘   └──────────────────┘ │
│                                         │
│  ┌─────────────┐   ┌──────────────────┐ │
│  │ AbilitySystem│   │ VisionSystem     │ │
│  │  (Q/W/E/R)  │   │ (Fog of War)     │ │
│  └─────────────┘   └──────────────────┘ │
│                                         │
│  ┌─────────────┐   ┌──────────────────┐ │
│  │ MinionManager│  │ObjectiveManager │ │
│  │ (Wave AI)   │   │ (Dragon/Baron)   │ │
│  └─────────────┘   └──────────────────┘ │
│                                         │
│  ┌─────────────┐   ┌──────────────────┐ │
│  │  AIGuy      │   │  Socket Manager  │ │
│  │ (Bot AI)    │   │ (Player Comm)    │ │
│  └─────────────┘   └──────────────────┘ │
└─────────────────────────────────────────┘

          │ 1:N instances per server
          ▼
┌─────────────────┐
│  GameManager    │  ← Orchestrates all game instances
└─────────────────┘
```

## Tick Rate & Networking

```
Server: 20 TPS (50ms per tick)
Client: 60 FPS (16.67ms per frame)

Interpolation: Client interpolates between server states
Prediction: Client predicts movement, reconciles on server update
```

## Database Schema (Key Entities)

```
User ←→ MatchPlayer ←→ Match
  ↓
Inventory (currencies, owned items)
  ↓
UserChampion, UserSkin (ownership)
ChampionMastery
Friend / FriendRequest
ChatMessage
Transaction
Report / AdminLog
Clan / ClanMember
```
