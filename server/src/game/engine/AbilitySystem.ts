/**
 * AbilitySystem - Champion abilities with cooldowns, mana costs, effects
 * Each of the 8 champions has 4 abilities (Q, W, E, R)
 */
import { v4 as uuid } from 'uuid';
import type { GameEntity, AbilityUse, Vector2, Projectile, DamageType } from '@shared/types/game';
import type { Ability, AbilityEffect, EffectType } from '@shared/types/champion';
import type { GameEngine } from './GameEngine';
import { GAME_CONSTANTS } from '@shared/constants/game';
import { CHAMPION_DATA, getChampion } from '@shared/data/champions';

export class AbilitySystem {
  private engine: GameEngine;
  private cooldowns: Map<string, Map<string, number>> = new Map();
  private cooldownRefunds: Map<string, Map<string, number>> = new Map();
  private abilityLevels: Map<string, Map<string, number>> = new Map();
  private passiveTimers: Map<string, Map<string, number>> = new Map();
  private channeledAbilities: Map<string, { ability: string; startTime: number; duration: number }> = new Map();

  // Cache for champion data
  private championAbilities: Map<string, Map<string, Ability>> = new Map();

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.initializeChampionAbilities();
  }

  private initializeChampionAbilities(): void {
    for (const [championId, champion] of Object.entries(CHAMPION_DATA)) {
      const abilities = new Map<string, Ability>();
      for (const ability of champion.abilities) {
        abilities.set(ability.key, ability);
      }
      this.championAbilities.set(championId, abilities);
    }
  }

  // ==========================================
  // ABILITY EXECUTION
  // ==========================================

  /**
   * Main entry point for using an ability
   */
  useAbility(casterId: string, ability: AbilityUse): boolean {
    const caster = this.engine.getEntity(casterId);
    if (!caster) return false;
    if (this.engine.isDead(caster)) return false;
    if (caster.type !== 'champion') return false;

    // Check for silencing
    if (this.engine.hasState(caster, 'silenced')) {
      this.engine.emit('abilityFailed', { casterId, reason: 'silenced' });
      return false;
    }

    // Check for channeled ability interruption
    if (this.channeledAbilities.has(casterId)) {
      this.cancelChannel(casterId);
    }

    const def = this.getAbilityDefinition(casterId, ability.abilityKey);
    if (!def) {
      this.engine.emit('abilityFailed', { casterId, reason: 'not_found' });
      return false;
    }

    // Get ability level
    const level = this.getAbilityLevel(casterId, ability.abilityKey);
    if (level === 0) {
      this.engine.emit('abilityFailed', { casterId, reason: 'not_learned' });
      return false;
    }

    // Check cooldown
    if (this.isOnCooldown(casterId, ability.abilityKey)) {
      this.engine.emit('abilityFailed', { casterId, reason: 'on_cooldown', remaining: this.getRemainingCooldown(casterId, ability.abilityKey) });
      return false;
    }

    // Check mana
    const manaCost = this.getAbilityManaCost(def, level);
    if (caster.current.mana < manaCost) {
      this.engine.emit('abilityFailed', { casterId, reason: 'no_mana', required: manaCost, current: caster.current.mana });
      return false;
    }

    // Check range
    const range = this.getAbilityRange(def, level);
    if (range > 0 && ability.targetPosition) {
      const dist = this.engine.physics.distance(caster.position, ability.targetPosition);
      if (dist > range) {
        this.engine.emit('abilityFailed', { casterId, reason: 'out_of_range', required: range, current: dist });
        return false;
      }
    }

    // Consume mana
    caster.current.mana -= manaCost;

    // Set cooldown
    const cd = this.getAbilityCooldown(def, level);
    const reducedCd = cd * (1 - caster.stats.cdr / 100);
    this.setCooldown(casterId, ability.abilityKey, reducedCd);

    // Execute ability based on type
    this.executeAbility(caster, ability, def, level);

    // Update animation
    caster.model.animation = `ability_${ability.abilityKey.toLowerCase()}`;

    // Log event
    this.engine.addGameEvent('ability_used', {
      casterId,
      ability: ability.abilityKey,
      level,
      name: def.name,
    });

    this.engine.emit('abilityUsed', {
      casterId,
      ability: ability.abilityKey,
      level,
      name: def.name,
      manaCost,
    });

    return true;
  }

  /**
   * Execute ability based on its targeting type
   */
  private executeAbility(caster: GameEntity, ability: AbilityUse, def: Ability, level: number): void {
    const effects = this.getEffectsAtLevel(def, level);

    switch (def.targeting) {
      case 'line':
        this.executeLineAbility(caster, ability, def, level, effects);
        break;
      case 'cone':
        this.executeConeAbility(caster, ability, def, level, effects);
        break;
      case 'area':
        this.executeAreaAbility(caster, ability, def, level, effects);
        break;
      case 'unit':
        this.executeTargetedAbility(caster, ability, def, level, effects);
        break;
      case 'self':
        this.executeSelfAbility(caster, ability, def, level, effects);
        break;
      case 'global':
        this.executeGlobalAbility(caster, ability, def, level, effects);
        break;
      case 'auto':
        // Auto-target nearest enemy (handled separately)
        this.executeAutoAbility(caster, ability, def, level, effects);
        break;
    }
  }

  private executeLineAbility(caster: GameEntity, ability: AbilityUse, def: Ability, level: number, effects: AbilityEffect[]): void {
    const targetPos = ability.targetPosition || caster.position;
    const range = this.getAbilityRange(def, level);
    const angle = this.engine.physics.angle(caster.position, targetPos);

    // Create projectile
    const damage = this.calculateAbilityDamage(effects, caster);
    const damageType = this.getDamageType(effects);

    this.engine.createProjectile({
      ownerId: caster.id,
      position: { ...caster.position },
      velocity: { x: Math.cos(angle), y: Math.sin(angle) },
      speed: def.missileSpeed || 1200,
      damage,
      damageType,
      ability,
      hitboxRadius: 80,
      maxDistance: range,
    });

    // Visual effect
    this.engine.state.effects.push({
      id: uuid(),
      type: 'ability_line',
      position: { ...caster.position },
      startTime: this.engine.state.time,
      duration: 0.3,
      data: { angle, range, team: caster.team },
    });
  }

  private executeConeAbility(caster: GameEntity, ability: AbilityUse, def: Ability, level: number, effects: AbilityEffect[]): void {
    const targetPos = ability.targetPosition || caster.position;
    const range = this.getAbilityRange(def, level);
    const angle = this.engine.physics.angle(caster.position, targetPos);

    // Damage all enemies in cone
    const damage = this.calculateAbilityDamage(effects, caster);
    const damageType = this.getDamageType(effects);
    const coneAngle = Math.PI / 3; // 60 degrees

    for (const entity of Object.values(this.engine.state.entities)) {
      if (entity.team === caster.team) continue;
      if (this.engine.isDead(entity)) continue;

      const dist = this.engine.physics.distance(caster.position, entity.position);
      if (dist > range) continue;

      const entityAngle = this.engine.physics.angle(caster.position, entity.position);
      const angleDiff = Math.abs(this.normalizeAngle(entityAngle - angle));
      
      if (angleDiff <= coneAngle / 2) {
        this.applyEffects(caster, entity, effects, ability);
      }
    }

    // Visual effect
    this.engine.state.effects.push({
      id: uuid(),
      type: 'ability_cone',
      position: { ...caster.position },
      startTime: this.engine.state.time,
      duration: 0.5,
      data: { angle, range, coneAngle, team: caster.team },
    });
  }

  private executeAreaAbility(caster: GameEntity, ability: AbilityUse, def: Ability, level: number, effects: AbilityEffect[]): void {
    const center = ability.targetPosition || caster.position;
    const range = this.getAbilityRange(def, level);
    const radius = effects[0]?.aoeRadius || 300;

    // Damage all enemies in area
    const damage = this.calculateAbilityDamage(effects, caster);
    const damageType = this.getDamageType(effects);

    for (const entity of Object.values(this.engine.state.entities)) {
      if (entity.team === caster.team) continue;
      if (this.engine.isDead(entity)) continue;

      const dist = this.engine.physics.distance(center, entity.position);
      if (dist <= radius) {
        this.applyEffects(caster, entity, effects, ability);
      }
    }

    // Create lingering effect
    this.engine.state.effects.push({
      id: uuid(),
      type: 'ability_area',
      position: center,
      startTime: this.engine.state.time,
      duration: 0.5,
      data: { radius, team: caster.team },
    });
  }

  private executeTargetedAbility(caster: GameEntity, ability: AbilityUse, def: Ability, level: number, effects: AbilityEffect[]): void {
    const targetId = ability.targetId;
    if (!targetId) {
      // If no target, apply to self for buffs
      this.applyEffects(caster, caster, effects, ability);
      return;
    }

    const target = this.engine.getEntity(targetId);
    if (!target) return;

    // Check range
    const range = this.getAbilityRange(def, level);
    const dist = this.engine.physics.distance(caster.position, target.position);
    if (dist > range) return;

    // Apply effects to target
    this.applyEffects(caster, target, effects, ability);
  }

  private executeSelfAbility(caster: GameEntity, _ability: AbilityUse, def: Ability, level: number, effects: AbilityEffect[]): void {
    // Apply effects to self
    this.applyEffects(caster, caster, effects, {
      casterId: caster.id,
      abilityKey: def.key,
      level,
    });
  }

  private executeGlobalAbility(caster: GameEntity, ability: AbilityUse, def: Ability, level: number, effects: AbilityEffect[]): void {
    // Global abilities (Lux R, Jinx R) - create a long-range skillshot
    const targetPos = ability.targetPosition || caster.position;
    const angle = this.engine.physics.angle(caster.position, targetPos);

    const damage = this.calculateAbilityDamage(effects, caster);
    const damageType = this.getDamageType(effects);

    this.engine.createProjectile({
      ownerId: caster.id,
      position: { ...caster.position },
      velocity: { x: Math.cos(angle), y: Math.sin(angle) },
      speed: def.missileSpeed || 2000,
      damage,
      damageType,
      ability,
      hitboxRadius: 160,
      maxDistance: 3000,
    });

    // Global visual effect
    this.engine.state.effects.push({
      id: uuid(),
      type: 'ability_global',
      position: { ...caster.position },
      startTime: this.engine.state.time,
      duration: 1.0,
      data: { team: caster.team },
    });
  }

  private executeAutoAbility(caster: GameEntity, ability: AbilityUse, def: Ability, level: number, effects: AbilityEffect[]): void {
    // Auto abilities (Ahri W, Jinx passive) - target nearby enemies
    const range = this.getAbilityRange(def, level);

    // Find nearest enemy in range
    let nearestEnemy: GameEntity | null = null;
    let nearestDist = Infinity;

    for (const entity of Object.values(this.engine.state.entities)) {
      if (entity.team === caster.team) continue;
      if (this.engine.isDead(entity)) continue;

      const dist = this.engine.physics.distance(caster.position, entity.position);
      if (dist <= range && dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = entity;
      }
    }

    if (nearestEnemy) {
      this.applyEffects(caster, nearestEnemy, effects, ability);
    }
  }

  // ==========================================
  // EFFECT APPLICATION
  // ==========================================

  private applyEffects(caster: GameEntity, target: GameEntity, effects: AbilityEffect[], ability: AbilityUse): void {
    for (const effect of effects) {
      switch (effect.type) {
        case 'damage':
          this.applyDamageEffect(caster, target, effect, ability);
          break;
        case 'heal':
          this.applyHealEffect(caster, target, effect);
          break;
        case 'shield':
          this.applyShieldEffect(caster, target, effect);
          break;
        case 'speed':
          this.applySpeedEffect(target, effect);
          break;
        case 'slow':
          this.applySlowEffect(caster, target, effect);
          break;
        case 'stun':
          this.applyStunEffect(caster, target, effect);
          break;
        case 'root':
          this.applyRootEffect(caster, target, effect);
          break;
        case 'silence':
          this.applySilenceEffect(caster, target, effect);
          break;
        case 'knockback':
          this.applyKnockbackEffect(caster, target, effect);
          break;
        case 'buff':
          this.applyBuffEffect(caster, target, effect);
          break;
        case 'debuff':
          this.applyDebuffEffect(caster, target, effect);
          break;
        case 'execute':
          this.applyExecuteEffect(caster, target, effect, ability);
          break;
        case 'charm':
          this.applyCharmEffect(caster, target, effect);
          break;
      }
    }
  }

  private applyDamageEffect(caster: GameEntity, target: GameEntity, effect: AbilityEffect, ability: AbilityUse): void {
    const baseDamage = effect.baseDamage || 0;
    const scaling = effect.scaling || 0;
    const damage = baseDamage + (caster.stats.currentAP * scaling) + (caster.stats.currentAD * scaling);
    
    const damageType = (effect.damageType as DamageType) || 'magic';
    this.engine.dealDamage(caster.id, target.id, Math.floor(damage), damageType, ability);
  }

  private applyHealEffect(caster: GameEntity, target: GameEntity, effect: AbilityEffect): void {
    const baseHeal = effect.healing || 0;
    const scaling = effect.scaling || 0;
    const heal = baseHeal + (caster.stats.currentAP * scaling);
    
    target.current.health = Math.min(target.current.maxHealth, target.current.health + Math.floor(heal));
    this.engine.emit('heal', { sourceId: caster.id, targetId: target.id, amount: heal });
  }

  private applyShieldEffect(caster: GameEntity, target: GameEntity, effect: AbilityEffect): void {
    const baseShield = effect.shield || 0;
    const scaling = effect.scaling || 0;
    const shield = baseShield + (caster.stats.currentAP * scaling);
    const duration = effect.duration || 3;

    this.engine.combat.applyShield(target.id, Math.floor(shield), duration);
  }

  private applySpeedEffect(target: GameEntity, effect: AbilityEffect): void {
    const value = effect.value || 0;
    const duration = effect.duration || 3;
    this.engine.combat.applyBuff(target.id, 'currentMoveSpeed', value, duration);
  }

  private applySlowEffect(caster: GameEntity, target: GameEntity, effect: AbilityEffect): void {
    const value = effect.value || 0;
    const duration = effect.duration || 3;
    this.engine.combat.applySlow(target.id, value, duration, caster.id);
  }

  private applyStunEffect(caster: GameEntity, target: GameEntity, effect: AbilityEffect): void {
    const duration = effect.duration || 1;
    this.engine.combat.applyStun(target.id, duration, caster.id);
  }

  private applyRootEffect(caster: GameEntity, target: GameEntity, effect: AbilityEffect): void {
    const duration = effect.duration || 1;
    this.engine.combat.applyRoot(target.id, duration, caster.id);
  }

  private applySilenceEffect(caster: GameEntity, target: GameEntity, effect: AbilityEffect): void {
    const duration = effect.duration || 1;
    this.engine.combat.applySilence(target.id, duration, caster.id);
  }

  private applyKnockbackEffect(caster: GameEntity, target: GameEntity, effect: AbilityEffect): void {
    const duration = effect.duration || 0.5;
    // Calculate knockback direction (away from caster)
    const angle = this.engine.physics.angle(caster.position, target.position) + Math.PI;
    const knockbackDist = 200;
    
    target.position.x += Math.cos(angle) * knockbackDist;
    target.position.y += Math.sin(angle) * knockbackDist;
    
    this.engine.combat.applyStun(target.id, duration, caster.id);
  }

  private applyBuffEffect(caster: GameEntity, target: GameEntity, effect: AbilityEffect): void {
    const value = effect.value || 0;
    const duration = effect.duration || 5;
    // Buff increases stats
    this.engine.combat.applyBuff(target.id, 'currentAD', value, duration);
    this.engine.combat.applyBuff(target.id, 'currentArmor', value / 2, duration);
  }

  private applyDebuffEffect(caster: GameEntity, target: GameEntity, effect: AbilityEffect): void {
    const value = effect.value || 0;
    const duration = effect.duration || 5;
    // Debuff reduces armor
    this.engine.combat.applyDebuff(target.id, 'currentArmor', value, duration);
  }

  private applyExecuteEffect(caster: GameEntity, target: GameEntity, effect: AbilityEffect, ability: AbilityUse): void {
    const baseDamage = effect.baseDamage || 0;
    const scaling = effect.scaling || 0;
    const damage = baseDamage + (caster.stats.currentAD * scaling);
    const threshold = effect.value ? effect.value / 100 : 0.5; // Default 50% threshold

    // Execute deals bonus damage based on missing HP
    const missingHPPercent = 1 - (target.current.health / target.current.maxHealth);
    let executeMultiplier = 0.5;
    if (missingHPPercent >= threshold) {
      executeMultiplier = 1 + (missingHPPercent - threshold) * 2;
    }

    const finalDamage = Math.floor(damage * executeMultiplier);
    this.engine.dealDamage(caster.id, target.id, finalDamage, 'magic', ability);
  }

  private applyCharmEffect(caster: GameEntity, target: GameEntity, effect: AbilityEffect): void {
    const duration = effect.duration || 1;
    // Charm makes enemy walk toward caster
    target.states.push({
      type: 'charmed',
      startTime: this.engine.state.time,
      duration,
      source: caster.id,
    });

    // Make target walk toward caster
    const angle = this.engine.physics.angle(target.position, caster.position);
    target.velocity = {
      x: Math.cos(angle) * target.stats.currentMoveSpeed,
      y: Math.sin(angle) * target.stats.currentMoveSpeed,
    };
  }

  // ==========================================
  // DAMAGE CALCULATION HELPERS
  // ==========================================

  private calculateAbilityDamage(effects: AbilityEffect[], caster: GameEntity): number {
    const damageEffect = effects.find(e => e.type === 'damage');
    if (!damageEffect) return 0;

    const baseDamage = damageEffect.baseDamage || 0;
    const scaling = damageEffect.scaling || 0;
    const ap = caster.stats.currentAP;
    const ad = caster.stats.currentAD;

    return Math.floor(baseDamage + (ap * scaling) + (ad * scaling));
  }

  private getDamageType(effects: AbilityEffect[]): DamageType {
    const damageEffect = effects.find(e => e.type === 'damage');
    return (damageEffect?.damageType as DamageType) || 'magic';
  }

  private getEffectsAtLevel(def: Ability, level: number): AbilityEffect[] {
    // For simplicity, return effects directly
    // In a full implementation, effects would scale with level
    return def.effects;
  }

  private getAbilityManaCost(def: Ability, level: number): number {
    // Base cost increases slightly with level
    const costPerLevel = def.cost * 0.05;
    return Math.floor(def.cost + costPerLevel * (level - 1));
  }

  private getAbilityCooldown(def: Ability, level: number): number {
    // Cooldown decreases slightly with level
    const cdPerLevel = def.cooldown * 0.05;
    return def.cooldown - cdPerLevel * (level - 1);
  }

  private getAbilityRange(def: Ability, _level: number): number {
    return def.range;
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

  reduceCooldown(entityId: string, abilityKey: string, amount: number): void {
    const entityCds = this.cooldowns.get(entityId);
    if (!entityCds) return;
    const cd = entityCds.get(abilityKey);
    if (!cd) return;
    entityCds.set(abilityKey, Math.max(this.engine.state.time, cd - amount));
  }

  // ==========================================
  // ABILITY LEVELING
  // ==========================================

  getAbilityLevel(entityId: string, abilityKey: string): number {
    const levels = this.abilityLevels.get(entityId);
    if (!levels) return 0;
    return levels.get(abilityKey) || 0;
  }

  levelUp(entityId: string, abilityKey: string): boolean {
    const entity = this.engine.getEntity(entityId);
    if (!entity || entity.type !== 'champion') return false;

    const currentLevel = this.getAbilityLevel(entityId, abilityKey);
    const maxLevel = abilityKey === 'R' ? 3 : 5;
    
    if (currentLevel >= maxLevel) return false;

    // R can only be learned at levels 6, 11, 16
    if (abilityKey === 'R' && entity.current.level < 6) return false;
    if (abilityKey === 'R' && currentLevel >= 2 && entity.current.level < 11) return false;
    if (abilityKey === 'R' && currentLevel >= 3 && entity.current.level < 16) return false;

    if (!this.abilityLevels.has(entityId)) {
      this.abilityLevels.set(entityId, new Map());
    }
    this.abilityLevels.get(entityId)!.set(abilityKey, currentLevel + 1);

    this.engine.emit('abilityLevelUp', {
      entityId,
      ability: abilityKey,
      newLevel: currentLevel + 1,
    });

    return true;
  }

  initializeAbilityLevels(entityId: string): void {
    // Auto-level Q at level 1
    this.abilityLevels.set(entityId, new Map([
      ['Q', 1],
      ['W', 0],
      ['E', 0],
      ['R', 0],
    ]));
  }

  // ==========================================
  // PASSIVES
  // ==========================================

  processPassives(entity: GameEntity, dt: number): void {
    // Passive gold income
    const goldPerSec = GAME_CONSTANTS.PASSIVE_GOLD_PER_SECOND;
    entity.current.gold += goldPerSec * dt;

    // Health regen
    const healthRegen = 5; // Base regen per second
    if (entity.current.health < entity.current.maxHealth) {
      entity.current.health = Math.min(
        entity.current.maxHealth,
        entity.current.health + healthRegen * dt
      );
    }

    // Mana regen
    const manaRegen = 8; // Base mana regen per second
    if (entity.current.mana < entity.current.maxMana) {
      entity.current.mana = Math.min(
        entity.current.maxMana,
        entity.current.mana + manaRegen * dt
      );
    }

    // Process champion-specific passives
    this.processChampionPassive(entity, dt);
  }

  private processChampionPassive(entity: GameEntity, dt: number): void {
    // Find champion ID from entity
    // For now, we'll use a placeholder - in production this would be stored on the entity
    // This is called per-tick so should be efficient
  }

  // ==========================================
  // CHANNELING
  // ==========================================

  startChannel(casterId: string, ability: string, duration: number): boolean {
    const caster = this.engine.getEntity(casterId);
    if (!caster) return false;

    if (this.channeledAbilities.has(casterId)) {
      return false; // Already channeling
    }

    this.channeledAbilities.set(casterId, {
      ability,
      startTime: this.engine.state.time,
      duration,
    });

    caster.states.push({
      type: 'channeling',
      startTime: this.engine.state.time,
      duration,
      source: ability,
    });

    return true;
  }

  cancelChannel(casterId: string): void {
    if (!this.channeledAbilities.has(casterId)) return;

    const channel = this.channeledAbilities.get(casterId)!;
    this.channeledAbilities.delete(casterId);

    const caster = this.engine.getEntity(casterId);
    if (caster) {
      caster.states = caster.states.filter(s => s.type !== 'channeling');
    }

    // Refund partial cooldown
    const elapsed = this.engine.state.time - channel.startTime;
    const refundRatio = 1 - elapsed / channel.duration;
    this.reduceCooldown(casterId, channel.ability, refundRatio * 10); // Partial refund
  }

  isChanneling(casterId: string): boolean {
    return this.channeledAbilities.has(casterId);
  }

  // ==========================================
  // ABILITY DEFINITIONS
  // ==========================================

  private getAbilityDefinition(entityId: string, key: string): Ability | null {
    const entity = this.engine.getEntity(entityId);
    if (!entity || entity.type !== 'champion') return null;

    // In a full implementation, the champion ID would be stored on the entity
    // For now, we'll check if the entity has a championId property
    const championId = (entity as any).championId || 'lux';
    
    const championAbilities = this.championAbilities.get(championId);
    if (!championAbilities) return null;

    return championAbilities.get(key) || null;
  }

  // ==========================================
  // UPDATE
  // ==========================================

  update(_dt: number): void {
    // Check for completed channels
    for (const [casterId, channel] of this.channeledAbilities) {
      const elapsed = this.engine.state.time - channel.startTime;
      if (elapsed >= channel.duration) {
        this.channeledAbilities.delete(casterId);
        
        const caster = this.engine.getEntity(casterId);
        if (caster) {
          caster.states = caster.states.filter(s => s.type !== 'channeling');
        }
      }
    }
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return Math.abs(angle);
  }

  getCooldownInfo(entityId: string): Record<string, number> {
    const info: Record<string, number> = {};
    for (const key of ['Q', 'W', 'E', 'R']) {
      info[key] = this.getRemainingCooldown(entityId, key);
    }
    return info;
  }

  getAbilityLevelInfo(entityId: string): Record<string, number> {
    const info: Record<string, number> = {};
    for (const key of ['Q', 'W', 'E', 'R']) {
      info[key] = this.getAbilityLevel(entityId, key);
    }
    return info;
  }
}
