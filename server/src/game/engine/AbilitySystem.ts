/**
 * AbilitySystem - Q/W/E/R abilities, cooldowns, effects
 */
import { v4 as uuid } from 'uuid';
import type { GameEntity, AbilityUse, Vector2, Projectile } from '../../../../shared/src/types/game';
import type { AbilityEffect } from '../../../../shared/src/types/champion';
import type { GameEngine } from './GameEngine';
import { GAME_CONSTANTS } from '../../../../shared/src/constants/game';

export class AbilitySystem {
  private engine: GameEngine;
  private cooldowns: Map<string, Map<string, number>> = new Map();
  private passiveTimers: Map<string, Map<string, number>> = new Map();

  // Champion ability definitions (in production, loaded from DB)
  private abilities: Record<string, Record<string, AbilityDefinition>> = {
    'lux': {
      Q: { name: 'Light Binding', cooldown: 11, cost: 50, range: 1300, type: 'skillshot', effects: [{ type: 'root', duration: 2, scaling: 0 }] },
      W: { name: 'Prismatic Barrier', cooldown: 14, cost: 60, range: 1200, type: 'skillshot', effects: [{ type: 'shield', value: 80, scaling: 0.4 }] },
      E: { name: 'Lucent Singularity', cooldown: 10, cost: 70, range: 1100, type: 'aoe', radius: 350, effects: [{ type: 'damage', value: 80, scaling: 0.8, damageType: 'magic' }] },
      R: { name: 'Final Spark', cooldown: 80, cost: 100, range: 3000, type: 'global', effects: [{ type: 'damage', value: 300, scaling: 1.2, damageType: 'magic' }] },
    },
    'garen': {
      Q: { name: 'Decisive Strike', cooldown: 8, cost: 0, range: 350, type: 'targeted', effects: [{ type: 'speed', value: 30, duration: 3, scaling: 0 }] },
      W: { name: 'Courage', cooldown: 20, cost: 0, range: 0, type: 'self', effects: [{ type: 'shield', value: 60, duration: 2, scaling: 0 }] },
      E: { name: 'Judgment', cooldown: 9, cost: 0, range: 325, type: 'aoe', radius: 325, effects: [{ type: 'damage', value: 40, scaling: 0.7, damageType: 'physical' }] },
      R: { name: 'Demacian Justice', cooldown: 120, cost: 0, range: 400, type: 'targeted', effects: [{ type: 'execute', value: 200, scaling: 0.75, damageType: 'magic' }] },
    },
  };

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  // ==========================================
  // USE ABILITY
  // ==========================================

  useAbility(casterId: string, ability: AbilityUse): boolean {
    const caster = this.engine.getEntity(casterId);
    if (!caster) return false;
    if (this.engine.isDead(caster)) return false;

    const def = this.getAbilityDefinition(casterId, ability.abilityKey);
    if (!def) return false;

    // Check cooldown
    if (this.isOnCooldown(casterId, ability.abilityKey)) return false;

    // Check mana
    if (def.cost > 0 && caster.current.mana < def.cost) return false;

    // Consume mana
    caster.current.mana -= def.cost;

    // Set cooldown
    const cd = def.cooldown * (1 - caster.stats.cdr / 100);
    this.setCooldown(casterId, ability.abilityKey, cd);

    // Execute based on type
    switch (def.type) {
      case 'skillshot':
        this.executeSkillshot(caster, ability, def);
        break;
      case 'targeted':
        this.executeTargeted(caster, ability, def);
        break;
      case 'aoe':
        this.executeAOE(caster, ability, def);
        break;
      case 'self':
        this.executeSelf(caster, ability, def);
        break;
      case 'global':
        this.executeGlobal(caster, ability, def);
        break;
    }

    caster.model.animation = `ability_${ability.abilityKey.toLowerCase()}`;
    this.engine.addGameEvent('ability_used', { casterId, ability: ability.abilityKey, name: def.name });
    this.engine.emit('abilityUsed', { casterId, ability: ability.abilityKey });

    return true;
  }

  private executeSkillshot(caster: GameEntity, ability: AbilityUse, def: AbilityDefinition): void {
    const targetPos = ability.targetPosition || caster.position;
    const dx = targetPos.x - caster.position.x;
    const dy = targetPos.y - caster.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const velocity = { x: Math.cos(angle), y: Math.sin(angle) };
    const damage = this.getScaledDamage(def.effects[0], caster);

    this.engine.createProjectile({
      ownerId: caster.id,
      position: { ...caster.position },
      velocity,
      speed: 1200,
      damage,
      damageType: (def.effects[0].damageType as 'physical' | 'magic' | 'true') || 'magic',
      ability,
      hitboxRadius: 80,
      maxDistance: def.range,
    });
  }

  private executeTargeted(caster: GameEntity, ability: AbilityUse, def: AbilityDefinition): void {
    const targetId = ability.targetId;
    if (!targetId) return;

    const target = this.engine.getEntity(targetId);
    if (!target) return;

    const effect = def.effects[0];
    switch (effect.type) {
      case 'damage':
        this.engine.dealDamage(caster.id, targetId, this.getScaledDamage(effect, caster), effect.damageType as any, ability);
        break;
      case 'heal':
        this.engine.state.entities[caster.id].current.health = Math.min(
          caster.current.maxHealth,
          caster.current.health + this.getScaledDamage(effect, caster)
        );
        break;
      case 'speed':
        this.applyBuff(caster.id, 'speed', effect.value, effect.duration || 3);
        break;
    }
  }

  private executeAOE(caster: GameEntity, ability: AbilityUse, def: AbilityDefinition): void {
    const center = ability.targetPosition || caster.position;
    const radius = def.radius || 300;
    const effect = def.effects[0];

    const targets = this.engine.state.entities;
    for (const entity of Object.values(targets)) {
      if (entity.team === caster.team) continue;
      if (this.engine.isDead(entity)) continue;

      const dist = Math.sqrt(
        (entity.position.x - center.x) ** 2 + (entity.position.y - center.y) ** 2
      );
      if (dist <= radius) {
        if (effect.type === 'damage') {
          this.engine.dealDamage(caster.id, entity.id, this.getScaledDamage(effect, caster), effect.damageType as any, ability);
        }
      }
    }

    // Create visual effect
    this.engine.state.effects.push({
      id: uuid(),
      type: 'aoe',
      position: center,
      startTime: this.engine.state.time,
      duration: 0.5,
      data: { radius, team: caster.team },
    });
  }

  private executeSelf(caster: GameEntity, _ability: AbilityUse, def: AbilityDefinition): void {
    for (const effect of def.effects) {
      switch (effect.type) {
        case 'shield':
          const shield = this.getScaledDamage(effect, caster);
          caster.buffs.push({
            id: uuid(), name: 'Shield', icon: '', stacks: 1, maxStacks: 1,
            duration: effect.duration || 3, startTime: this.engine.state.time,
            source: caster.id, effects: [{ stat: 'health', value: shield, type: 'flat' }],
          });
          break;
      }
    }
  }

  private executeGlobal(caster: GameEntity, ability: AbilityUse, def: AbilityDefinition): void {
    const targetId = ability.targetId;
    const effect = def.effects[0];

    if (targetId) {
      this.engine.dealDamage(caster.id, targetId, this.getScaledDamage(effect, caster), effect.damageType as any, ability);
    } else {
      // Line skillshot for global
      const targetPos = ability.targetPosition || caster.position;
      const angle = Math.atan2(targetPos.y - caster.position.y, targetPos.x - caster.position.x);

      this.engine.createProjectile({
        ownerId: caster.id,
        position: { ...caster.position },
        velocity: { x: Math.cos(angle), y: Math.sin(angle) },
        speed: 2000,
        damage: this.getScaledDamage(effect, caster),
        damageType: (effect.damageType as 'physical' | 'magic' | 'true') || 'magic',
        ability,
        hitboxRadius: 160,
        maxDistance: def.range,
      });
    }
  }

  // ==========================================
  // PASSIVES
  // ==========================================

  processPassives(entity: GameEntity, dt: number): void {
    // Passive gold income
    const goldPerSec = GAME_CONSTANTS.PASSIVE_GOLD_PER_SECOND;
    entity.current.gold += goldPerSec * dt;

    // Health regen
    if (entity.current.health < entity.current.maxHealth) {
      entity.current.health = Math.min(entity.current.maxHealth, entity.current.health + 5 * dt);
    }

    // Mana regen
    if (entity.current.mana < entity.current.maxMana) {
      entity.current.mana = Math.min(entity.current.maxMana, entity.current.mana + 8 * dt);
    }
  }

  // ==========================================
  // LEVEL UP
  // ==========================================

  levelUp(entityId: string, abilityKey: 'Q' | 'W' | 'E' | 'R'): boolean {
    const entity = this.engine.getEntity(entityId);
    if (!entity || entity.type !== 'champion') return false;

    const level = entity.current.level;
    if (level >= GAME_CONSTANTS.MAX_LEVEL) return false;

    // R is only available at level 6, 11, 16
    if (abilityKey === 'R' && level < 6) return false;
    if (abilityKey === 'R' && level < 11 && entity.current.xp >= entity.current.xpToLevel * 2) return false;

    this.engine.emit('abilityLevelUp', { entityId, ability: abilityKey, newLevel: level + 1 });
    return true;
  }

  // ==========================================
  // COOLDOWNS
  // ==========================================

  isOnCooldown(entityId: string, abilityKey: string): boolean {
    const entityCds = this.cooldowns.get(entityId);
    if (!entityCds) return false;
    const cd = entityCds.get(abilityKey);
    if (!cd) return false;
    return this.engine.state.time < cd;
  }

  getRemainingCooldown(entityId: string, abilityKey: string): number {
    const entityCds = this.cooldowns.get(entityId);
    if (!entityCds) return 0;
    const cd = entityCds.get(abilityKey);
    if (!cd) return 0;
    return Math.max(0, cd - this.engine.state.time);
  }

  private setCooldown(entityId: string, abilityKey: string, duration: number): void {
    if (!this.cooldowns.has(entityId)) {
      this.cooldowns.set(entityId, new Map());
    }
    this.cooldowns.get(entityId)!.set(abilityKey, this.engine.state.time + duration);
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private getAbilityDefinition(entityId: string, key: string): AbilityDefinition | null {
    // Get champion ID from entity
    const championAbilities = this.abilities['lux']; // Default for demo
    return championAbilities?.[key] || null;
  }

  private getScaledDamage(effect: AbilityEffect, caster: GameEntity): number {
    const base = effect.baseDamage || 0;
    const scaling = effect.scaling || 0;
    const ap = caster.stats.currentAP;
    const ad = caster.stats.currentAD;
    return base + (ap * scaling) + (ad * scaling);
  }

  private applyBuff(entityId: string, stat: string, value: number, duration: number): void {
    const entity = this.engine.getEntity(entityId);
    if (!entity) return;

    entity.buffs.push({
      id: uuid(),
      name: stat,
      icon: '',
      stacks: 1,
      maxStacks: 1,
      duration,
      startTime: this.engine.state.time,
      source: 'ability',
      effects: [{ stat: stat as any, value, type: 'flat' }],
    });
  }

  update(_dt: number): void {}
}

interface AbilityDefinition {
  name: string;
  cooldown: number;
  cost: number;
  range: number;
  type: 'skillshot' | 'targeted' | 'aoe' | 'self' | 'global';
  radius?: number;
  effects: AbilityEffect[];
}
