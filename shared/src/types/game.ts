// ============================================
// GAME ENGINE TYPES
// Core game state & networking
// ============================================

import type { Champion, ChampionStats, Role } from './champion.js';

// --- Team State ---
export interface TeamState {
  id: string;
  kills: number;
  towers: number;
  dragons: number;
  barons: number;
  gold: number;
}

// --- Game Effect ---
export interface GameEffect {
  id: string;
  type: string;
  position: Vector2;
  startTime: number;
  duration: number;
  data: Record<string, unknown>;
}

// --- Map Config ---
export interface MapConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  gridSize: number;
}

// --- Fog of War ---
export interface FogArea {
  x: number;
  y: number;
  radius: number;
}

// --- Core Identifiers ---
export type TeamSide = 'blue' | 'red';
export type UnitType = 'champion' | 'minion' | 'tower' | 'nexus' | 'inhibitor' | 'jungle';
export type UnitClass = 'assassin' | 'mage' | 'fighter' | 'tank' | 'marksman' | 'support';
export type MinionType = 'melee' | 'ranged' | 'siege' | 'super' | 'cannon';
export type ObjectType = 'unit' | 'projectile' | 'effect' | 'building';

// --- Game State ---
export interface GameState {
  id: string;
  phase: GamePhase;
  time: number; // seconds elapsed
  map: MapState;
  teams: [TeamState, TeamState];
  entities: Record<string, GameEntity>;
  projectiles: Projectile[];
  effects: GameEffect[];
  events: GameEvent[];
  settings: GameSettings;
}

export type GamePhase =
  | 'loading'
  | 'champion-select'
  | 'pre-game'
  | 'countdown'
  | 'playing'
  | 'paused'
  | 'end';

export interface GameSettings {
  map: MapConfig;
  gameMode: GameMode;
  matchLength: number;
  surrenderEnabled: boolean;
  minimapSharing: boolean;
}

export type GameMode = 'classic' | 'aram' | 'ranked' | 'custom';

// --- Map ---
export interface MapState {
  id: string;
  name: string;
  width: number;
  height: number;
  gridSize: number;
  terrain: TerrainCell[][];
  zones: MapZone[];
  lanes: LaneData[];
  spawnPoints: Record<TeamSide, { x: number; y: number }>;
}

export interface TerrainCell {
  walkable: boolean;
  flyable: boolean;
  cost: number; // movement cost multiplier
  type: TerrainType;
  height: number;
}

export type TerrainType =
  | 'plain'
  | 'wall'
  | 'water'
  | 'cliff'
  | 'bush'
  | 'path'
  | 'tower-range'
  | 'nexus';

export interface MapZone {
  id: string;
  name: string;
  bounds: { x: number; y: number; w: number; h: number };
  type: ZoneType;
  respawnTime?: number;
}

export type ZoneType =
  | 'base'
  | 'lane'
  | 'jungle'
  | 'river'
  | 'objective'
  | 'shop';

export interface LaneData {
  id: string;
  name: 'top' | 'mid' | 'bot';
  waypoints: Vector2[];
  towers: TowerPosition[];
  inhibitors: TowerPosition[];
  minions: MinionWaveConfig;
}

export interface TowerPosition {
  id: string;
  order: number;
  pos: Vector2;
  range: number;
  damage: number;
  attackSpeed: number;
}

export interface MinionWaveConfig {
  spawnInterval: number; // seconds between waves
  count: { melee: number; ranged: number; siege: number };
  stats: Partial<MinionStats>;
}

// --- Entities ---
export interface GameEntity {
  id: string;
  type: UnitType;
  team: TeamSide;
  position: Vector2;
  facing: number; // radians
  velocity: Vector2;
  stats: ComputedStats;
  baseStats: ChampionStats;
  current: EntityCurrent;
  states: EntityState[];
  buffs: Buff[];
  effects: ActiveEffect[];
  model: ModelState;
  network: NetworkState;
  ownerId?: string; // for minions, towers, etc.
}

export interface EntityCurrent {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  energy: number;
  maxEnergy: number;
  level: number;
  xp: number;
  xpToLevel: number;
  gold: number;
  killCount: number;
  deathCount: number;
  assistCount: number;
}

export interface ComputedStats extends ChampionStats {
  currentHealth: number;
  currentMana: number;
  currentEnergy: number;
  currentAttackSpeed: number;
  currentRange: number;
  currentMoveSpeed: number;
  currentArmor: number;
  currentMR: number;
  currentAD: number;
  currentAP: number;
  attackSpeedMultiplier: number;
  critMultiplier: number;
  lifesteal: number;
  armorPenetration: number;
  magicPenetration: number;
  cdr: number;
}

export interface EntityState {
  type: StateType;
  startTime: number;
  duration: number;
  source?: string;
}

export type StateType =
  | 'dead'
  | 'stunned'
  | 'rooted'
  | 'silenced'
  | 'sleeping'
  | 'feared'
  | 'charmed'
  | 'invisible'
  | 'untargetable'
  | 'invulnerable'
  | 'recalling'
  | 'teleporting'
  | 'channeling';

export interface Buff {
  id: string;
  name: string;
  icon: string;
  stacks: number;
  maxStacks: number;
  duration: number;
  startTime: number;
  source: string;
  effects: BuffEffect[];
}

export interface BuffEffect {
  stat?: keyof ComputedStats;
  value: number;
  type: 'flat' | 'percent' | 'multiplicative';
}

export interface ActiveEffect {
  id: string;
  type: string;
  position: Vector2;
  startTime: number;
  duration: number;
  data: Record<string, unknown>;
}

export interface ModelState {
  skinId: string;
  scale: number;
  alpha: number;
  tint: string;
  animation: string;
  animationFrame: number;
}

export interface NetworkState {
  lastServerUpdate: number;
  clientTimestamp: number;
  serverTimestamp: number;
  tickRate: number;
  latency: number;
  pinging: boolean;
}

// --- Projectiles ---
export interface Projectile {
  id: string;
  type: 'basic' | 'skill' | 'global';
  ownerId: string;
  targetId?: string;
  position: Vector2;
  velocity: Vector2;
  speed: number;
  damage: number;
  damageType: DamageType;
  source: AbilityUse;
  hitboxRadius: number;
  maxDistance: number;
  traveled: number;
  pierced: string[];
  startTime: number;
  isActive: boolean;
}

export type DamageType = 'physical' | 'magic' | 'true';

// --- Abilities ---
export interface AbilityUse {
  casterId: string;
  abilityKey: 'P' | 'Q' | 'W' | 'E' | 'R';
  targetId?: string;
  targetPosition?: Vector2;
  level: number;
}

export interface SkillshotConfig {
  width: number;
  angle: number;
  speed: number;
  maxDistance: number;
  hitboxConfig: HitboxConfig;
}

// --- Combat ---
export interface DamageEvent {
  sourceId: string;
  targetId: string;
  amount: number;
  type: DamageType;
  ability?: AbilityUse;
  isCrit: boolean;
  isKill: boolean;
  overkill: number;
  timestamp: number;
}

export interface HealEvent {
  sourceId: string;
  targetId: string;
  amount: number;
  isCrit: boolean;
  timestamp: number;
}

export interface DeathEvent {
  entityId: string;
  killerId?: string;
  assistIds: string[];
  goldReward: number;
  timestamp: number;
}

export interface LevelUpEvent {
  entityId: string;
  newLevel: number;
  statsGained: Partial<ChampionStats>;
  timestamp: number;
}

// --- Objectives ---
export interface Objective {
  id: string;
  type: ObjectiveType;
  team?: TeamSide;
  position: Vector2;
  respawnTime: number;
  isAlive: boolean;
  currentHealth?: number;
  maxHealth?: number;
  buffs?: Buff[];
  spawnedAt?: number;
  state: ObjectiveState;
}

export type ObjectiveType =
  | 'dragon'
  | 'rift-herald'
  | 'baron'
  | 'tower'
  | 'inhibitor'
  | 'nexus-tower';

export type ObjectiveState = 'alive' | 'dead' | 'respawning' | 'disabled';

export interface Tower extends GameEntity {
  type: 'tower';
  towerData: {
    order: number;
    lane: 'top' | 'mid' | 'bot';
    platings: number;
    platingsRemaining: number;
    currentTarget?: string;
    lastAttackTime: number;
  };
}

export interface Minion extends GameEntity {
  type: 'minion';
  minionData: MinionStats;
  waypoints: Vector2[];
  currentWaypointIndex: number;
  aggroTarget?: string;
  isMinionAgressive: boolean;
}

export interface MinionStats {
  minionType: MinionType;
  baseHealth: number;
  baseDamage: number;
  baseArmor: number;
  attackRange: number;
  attackSpeed: number;
  moveSpeed: number;
  xpValue: number;
  goldValue: number;
  waypoints: Vector2[];
}

// --- Game Events ---
export interface GameEvent {
  id: string;
  type: EventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export type EventType =
  | 'champion_kill'
  | 'minion_kill'
  | 'tower_kill'
  | 'inhibitor_kill'
  | 'dragon_kill'
  | 'baron_kill'
  | 'herald_kill'
  | 'level_up'
  | 'item_purchase'
  | 'summoner_spell_used'
  | 'ability_used'
  | 'game_start'
  | 'game_end'
  | 'first_blood'
  | 'game_paused'
  | 'game_resumed';

// --- Minimap ---
export interface MinimapState {
  fogOfWar: Record<TeamSide, FogArea[]>;
  revealedAreas: Record<TeamSide, Vector2[]>;
  visibleUnits: Record<TeamSide, string[]>;
  objectives: Objective[];
}

// --- Matchmaking ---
export interface MatchmakingTicket {
  id: string;
  userId: string;
  rank: string;
  queueType: QueueType;
  role: Role | 'any';
  lane: Role | 'any';
  status: 'searching' | 'found' | 'expired' | 'cancelled';
  searchTime: number;
  mmr: number;
}

export type QueueType = 'ranked' | 'normal' | 'practice' | 'custom';

// --- Client-Specific ---
export interface PlayerInput {
  type: InputType;
  timestamp: number;
  data: Record<string, unknown>;
}

export type InputType =
  | 'move'
  | 'attack'
  | 'ability'
  | 'item'
  | 'recall'
  | 'ping'
  | 'emote';

export interface MoveInput {
  targetX: number;
  targetY: number;
  isRightClick: boolean;
}

export interface AttackInput {
  targetId: string;
}

export interface AbilityInput {
  ability: 'Q' | 'W' | 'E' | 'R' | 'D' | 'F';
  targetId?: string;
  targetX?: number;
  targetY?: number;
}

// --- Hitbox ---
export interface HitboxConfig {
  type: 'circle' | 'rect' | 'cone';
  radius?: number;
  width?: number;
  height?: number;
  angle?: number;
}

// --- Utilities ---
export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 extends Vector2 {
  z: number;
}

// --- Network Packets ---
export interface GameSnapshot {
  tick: number;
  timestamp: number;
  state: Partial<GameState>;
  events: GameEvent[];
  inputs: Record<string, PlayerInput[]>;
}

export interface SyncPacket {
  type: 'full' | 'delta' | 'event' | 'input' | 'ping' | 'pong';
  tick: number;
  timestamp: number;
  data: unknown;
}
