export interface Champion {
  id: string;
  name: string;
  title: string;
  lore: string;
  portrait: string;
  faction: Faction;
  roles: Role[];
  stats: ChampionStats;
  abilities: Ability[];
  tags: string[];
  difficulty: Difficulty;
  releaseDate: Date;
  price: { blueEssence: number; rp: number; isFree: boolean };
  isEnabled: boolean;
}

export interface ChampionStats {
  health: number;
  healthPerLevel: number;
  mana: number;
  manaPerLevel: number;
  armor: number;
  armorPerLevel: number;
  magicResist: number;
  magicResistPerLevel: number;
  moveSpeed: number;
  attackRange: number;
  attackDamage: number;
  attackDamagePerLevel: number;
  attackSpeed: number;
  attackSpeedPerLevel: number;
  critChance: number;
  critDamage: number;
  spellBlock: number;
}

export interface Ability {
  id: string;
  key: 'P' | 'Q' | 'W' | 'E' | 'R';
  name: string;
  description: string;
  icon: string;
  cooldown: number;
  cost: number;
  costType: 'mana' | 'energy' | 'none';
  range: number;
  targeting: TargetingType;
  effects: AbilityEffect[];
  upgrades: AbilityUpgrade[];
  castTime: number;
  channelTime: number;
  missileSpeed?: number;
}

export interface AbilityEffect {
  type: EffectType;
  scaling: number;
  baseDamage?: number;
  healing?: number;
  shield?: number;
  duration?: number;
  aoeRadius?: number;
  maxStacks?: number;
  value?: number;
  damageType?: 'physical' | 'magic' | 'true';
}

export type EffectType =
  | 'damage'
  | 'heal'
  | 'shield'
  | 'speed'
  | 'slow'
  | 'stun'
  | 'root'
  | 'silence'
  | 'knockback'
  | 'dash'
  | 'teleport'
  | 'summon'
  | 'buff'
  | 'debuff'
  | 'execute';

export type TargetingType =
  | 'self'
  | 'unit'
  | 'area'
  | 'line'
  | 'cone'
  | 'global'
  | 'auto';

export interface AbilityUpgrade {
  level: number;
  description: string;
  effects: AbilityEffect[];
}

export interface Skin {
  id: string;
  championId: string;
  name: string;
  description: string;
  splash: string;
  icon: string;
  price: { blueEssence: number; rp: number; isFree: boolean };
  tier: SkinTier;
  effects: SkinEffects;
  isDefault: boolean;
}

export interface SkinEffects {
  model: string;
  particles: string[];
  animations: string[];
  voiceLine?: string;
}

export type SkinTier = 'standard' | 'premium' | 'epic' | 'legendary' | 'mythic';

export interface Rune {
  id: string;
  name: string;
  description: string;
  icon: string;
  slot: RuneSlot;
  stats: Partial<ChampionStats>;
  isEnabled: boolean;
}

export interface RunePage {
  id: string;
  name: string;
  primaryTree: RuneTree;
  secondaryTree: RuneTree;
  shards: RuneShard[];
}

export interface RuneTree {
  keystone: Rune;
  minor: Rune[];
}

export type RuneSlot = 'keystone' | 'tier1' | 'tier2' | 'tier3';
export type RuneShard = Rune;

export type Role = 'top' | 'jungle' | 'mid' | 'adc' | 'support';
export type Faction = 'order' | 'chaos' | 'neutral';
export type Difficulty = 1 | 2 | 3;
