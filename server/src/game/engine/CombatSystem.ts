/**
 * CombatSystem - Full damage calculation, auto-attacks, on-hit effects
 * Handles armor/MR, crits, lifesteal, and item effects
 */
import { v4 as uuid } from 'uuid';
import type { GameEntity, DamageType, DamageEvent, AbilityUse, Vector2 } from '@shared/types/game';
import type { GameEngine } from './GameEngine';
import { GAME_CONSTANTS } from '@shared/constants/game';
import { Physics } from '../physics/Physics';

export class CombatSystem {
  private engine: GameEngine;
  private physics: Physics;
  private attackTimers: Map<string, number> = new Map();
  private lastAutoAttackTime: Map<string, number> = new Map();

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.physics = new Physics(engine);
  }

  // ==========================================
  // CORE DAMAGE CALCULATION
  // ==========================================

  /**
   * Calculate physical damage with armor penetration
   * Formula: damage reduction = armor / (100 + armor)
   */
  calculatePhysicalDamage(baseDamage: number, target: GameEntity): number {
    const armor = target.stats.currentArmor;
    const flatPen = this.engine.getItemStat(target.id, 'armorPenetrationFlat') || 0;
    const percentPen = this.engine.getItemStat(target.id, 'armorPenetrationPercent') || 0;
    
    // Apply percentage penetration first
    const afterPercentPen = Math.max(0, armor * (1 - percentPen / 100));
    // Then flat penetration
    const effectiveArmor = Math.max(0, afterPercentPen - flatPen);

    // League formula: damage reduction = armor / (100 + armor)
    const reduction = effectiveArmor / (100 + effectiveArmor);
    const finalDamage = baseDamage * (1 - reduction);
    
    return Math.max(1, Math.floor(finalDamage));
  }

  /**
   * Calculate magic damage with magic resistance penetration
   */
  calculateMagicDamage(baseDamage: number, target: GameEntity): number {
    const mr = target.stats.currentMR;
    const flatPen = this.engine.getItemStat(target.id, 'magicPenFlat') || 0;
    const percentPen = this.engine.getItemStat(target.id, 'magicPenPercent') || 0;
    
    // Apply percentage penetration first
    const afterPercentPen = Math.max(0, mr * (1 - percentPen / 100));
    // Then flat penetration
    const effectiveMR = Math.max(0, afterPercentPen - flatPen);

    // Same formula as armor
    const reduction = effectiveMR / (100 + effectiveMR);
    const finalDamage = baseDamage * (1 - reduction);
    
    return Math.max(1, Math.floor(finalDamage));
  }

  /**
   * True damage bypasses all resistances
   */
  calculateTrueDamage(baseDamage: number): number {
    return Math.floor(baseDamage);
  }

  /**
   * Calculate execute damage based on target's missing health
   */
  calculateExecuteDamage(baseDamage: number, target: GameEntity, executeThreshold: number = 0.5): number {
    const missingHealthPercent = 1 - (target.current.health / target.current.maxHealth);
    
    // Execute deals more damage when target is lower HP
    if (missingHealthPercent >= executeThreshold) {
      const executeBonus = 1 + (missingHealthPercent - executeThreshold) * 2;
      return Math.floor(baseDamage * executeBonus);
    }
    
    return Math.floor(baseDamage * 0.5);
  }

  /**
   * Apply critical strike damage multiplier
   */
  calculateCritDamage(baseDamage: number, critMult: number): number {
    return Math.floor(baseDamage * critMult);
  }

  // ==========================================
  // AUTO ATTACKS
  // ==========================================

  /**
   * Attempt to perform an auto-attack
   */
  attemptAutoAttack(attackerId: string, targetId: string): boolean {
    const attacker = this.engine.getEntity(attackerId);
    const target = this.engine.getEntity(targetId);

    if (!attacker || !target) return false;
    if (this.engine.isDead(attacker) || this.engine.isDead(target)) return false;
    if (!this.canAttackTarget(attacker, target)) return false;

    // Check attack cooldown
    const now = this.engine.state.time;
    const attackSpeed = attacker.stats.currentAttackSpeed;
    const attackTime = 1 / attackSpeed;
    const lastAttack = this.attackTimers.get(attackerId) || 0;

    if (now - lastAttack < attackTime) return false;

    // Calculate damage
    const ad = attacker.stats.currentAD;
    const critChance = Math.min(1, attacker.stats.critChance);
    const isCrit = Math.random() < critChance;
    const critMult = attacker.stats.critMultiplier;
    
    let damage = ad;
    if (isCrit) {
      damage = this.calculateCritDamage(damage, critMult);
    }

    // Apply on-hit effects before damage
    this.applyOnHitEffects(attacker, target);

    // Deal the damage
    this.engine.dealDamage(attackerId, targetId, damage, 'physical');

    // Apply on-attack effects after damage
    this.applyOnAttackEffects(attacker, target);

    // Apply lifesteal
    if (attacker.stats.lifesteal > 0) {
      const healAmount = damage * attacker.stats.lifesteal;
      this.applyHealing(attackerId, attackerId, healAmount);
    }

    // Update timers
    this.attackTimers.set(attackerId, now);
    this.lastAutoAttackTime.set(attackerId, now);

    // Update facing and animation
    attacker.model.animation = 'attack';
    attacker.facing = this.engine.physics.angle(attacker.position, target.position);

    // Emit event
    this.engine.emit('autoAttack', {
      attackerId,
      targetId,
      damage,
      isCrit,
      timestamp: now,
    });

    return true;
  }

  /**
   * Check if attacker can attack target
   */
  canAttackTarget(attacker: GameEntity, target: GameEntity): boolean {
    // Can't attack allies
    if (attacker.team === target.team) return false;

    // Check range
    const range = attacker.stats.currentRange;
    const dist = this.physics.distance(attacker.position, target.position);
    if (dist > range) return false;

    // Check if target is invulnerable/untargetable
    if (this.engine.hasState(target, 'invulnerable') || this.engine.hasState(target, 'untargetable')) {
      return false;
    }

    return true;
  }

  /**
   * Find nearest attackable enemy in range
   */
  findAttackTarget(entityId: string): GameEntity | null {
    const entity = this.engine.getEntity(entityId);
    if (!entity) return null;

    const range = entity.stats.currentRange;
    const enemies = this.engine.getLivingEntities().filter(
      e => e.team !== entity.team && this.physics.distance(entity.position, e.position) <= range
    );

    if (enemies.length === 0) return null;

    // Return closest enemy
    return enemies.reduce((closest, e) => {
      const closestDist = this.physics.distance(entity.position, closest.position);
      const eDist = this.physics.distance(entity.position, e.position);
      return eDist < closestDist ? e : closest;
    });
  }

  // ==========================================
  // ON-HIT & ON-ATTACK EFFECTS
  // ==========================================

  private onHitItems: Record<string, (attacker: GameEntity, target: GameEntity) => void> = {
    // These would be registered by the ItemSystem
  };

  registerOnHitEffect(itemId: string, effect: (attacker: GameEntity, target: GameEntity) => void): void {
    this.onHitItems[itemId] = effect;
  }

  private applyOnHitEffects(attacker: GameEntity, target: GameEntity): void {
    // Process all registered on-hit effects
    for (const effect of Object.values(this.onHitItems)) {
      effect(attacker, target);
    }

    // Built-in on-hit effects from items
    const onHitDamage = this.engine.getItemStat(attacker.id, 'onHitDamage') || 0;
    if (onHitDamage > 0) {
      this.engine.dealDamage(attacker.id, target.id, onHitDamage, 'physical');
    }

    const onHitMagicDamage = this.engine.getItemStat(attacker.id, 'onHitMagicDamage') || 0;
    if (onHitMagicDamage > 0) {
      this.engine.dealDamage(attacker.id, target.id, onHitMagicDamage, 'magic');
    }
  }

  private applyOnAttackEffects(attacker: GameEntity, target: GameEntity): void {
    // Process on-attack effects (like armor shred on-hit)
    const armorShred = this.engine.getItemStat(attacker.id, 'armorShredOnHit') || 0;
    if (armorShred > 0) {
      this.applyDebuff(target.id, 'armor', -armorShred, 3);
    }
  }

  // ==========================================
  // BUFFS & DEBUFFS
  // ==========================================

  applyBuff(targetId: string, stat: string, value: number, duration: number): void {
    const entity = this.engine.getEntity(targetId);
    if (!entity) return;

    entity.buffs.push({
      id: uuid(),
      name: stat,
      icon: '',
      stacks: 1,
      maxStacks: 1,
      duration,
      startTime: this.engine.state.time,
      source: 'combat',
      effects: [{ stat: stat as any, value, type: 'flat' }],
    });

    // Immediately apply stat modifier
    this.modifyStat(entity, stat, value);
  }

  applyDebuff(targetId: string, stat: string, value: number, duration: number): void {
    const entity = this.engine.getEntity(targetId);
    if (!entity) return;

    // Negative values are debuffs
    entity.buffs.push({
      id: uuid(),
      name: `debuff_${stat}`,
      icon: '',
      stacks: 1,
      maxStacks: 1,
      duration,
      startTime: this.engine.state.time,
      source: 'combat',
      effects: [{ stat: stat as any, value, type: 'flat' }],
    });

    // Immediately apply stat modifier
    this.modifyStat(entity, stat, value);
  }

  private modifyStat(entity: GameEntity, stat: string, value: number): void {
    switch (stat.toLowerCase()) {
      case 'health':
      case 'maxhealth':
        entity.current.maxHealth += value;
        entity.current.health = Math.min(entity.current.health, entity.current.maxHealth);
        break;
      case 'armor':
        entity.stats.currentArmor += value;
        break;
      case 'mr':
      case 'magicresist':
        entity.stats.currentMR += value;
        break;
      case 'ad':
      case 'attackdamage':
        entity.stats.currentAD += value;
        break;
      case 'ap':
      case 'abilitypower':
        entity.stats.currentAP += value;
        break;
      case 'movespeed':
        entity.stats.currentMoveSpeed += value;
        break;
      case 'attackspeed':
        entity.stats.currentAttackSpeed += value;
        break;
      case 'lifesteal':
        entity.stats.lifesteal += value;
        break;
      case 'armorpen':
      case 'armorpenetration':
        entity.stats.armorPenetration += value;
        break;
    }
  }

  // ==========================================
  // HEALING & SHIELDING
  // ==========================================

  applyHealing(sourceId: string, targetId: string, amount: number): void {
    const target = this.engine.getEntity(targetId);
    if (!target) return;

    const oldHealth = target.current.health;
    target.current.health = Math.min(target.current.maxHealth, target.current.health + amount);
    const actualHeal = target.current.health - oldHealth;

    if (actualHeal > 0) {
      this.engine.emit('heal', {
        sourceId,
        targetId,
        amount: actualHeal,
        timestamp: this.engine.state.time,
      });
    }
  }

  applyShield(targetId: string, amount: number, duration: number): void {
    const target = this.engine.getEntity(targetId);
    if (!target) return;

    target.buffs.push({
      id: uuid(),
      name: 'Shield',
      icon: '',
      stacks: Math.ceil(amount / 50),
      maxStacks: Math.ceil(amount / 50),
      duration,
      startTime: this.engine.state.time,
      source: 'combat',
      effects: [{ stat: 'health', value: amount, type: 'flat' }],
    });

    this.engine.emit('shieldApplied', {
      targetId,
      amount,
      duration,
      timestamp: this.engine.state.time,
    });
  }

  /**
   * Consume shields when taking damage
   */
  consumeShield(entityId: string, damage: number): number {
    const entity = this.engine.getEntity(entityId);
    if (!entity) return damage;

    let remainingDamage = damage;
    const shieldBuffs = entity.buffs.filter(b => b.name === 'Shield' && b.stacks > 0);

    for (const shield of shieldBuffs) {
      const shieldValue = shield.effects.reduce((sum, e) => sum + (e.stat === 'health' ? e.value : 0), 0);
      if (remainingDamage <= 0) break;

      if (shieldValue >= remainingDamage) {
        // Shield absorbs partial damage
        shield.effects[0].value -= remainingDamage;
        remainingDamage = 0;
      } else {
        // Shield fully consumed
        remainingDamage -= shieldValue;
        shield.stacks = 0;
      }
    }

    // Clean up depleted shields
    entity.buffs = entity.buffs.filter(b => b.name !== 'Shield' || b.stacks > 0);

    return remainingDamage;
  }

  // ==========================================
  // AREA OF EFFECT DAMAGE
  // ==========================================

  /**
   * Apply AOE damage to all enemies in radius
   */
  applyAOEDamage(sourceId: string, center: Vector2, radius: number, baseDamage: number, damageType: DamageType): number {
    const source = this.engine.getEntity(sourceId);
    if (!source) return 0;

    let totalDamage = 0;
    const targets = this.physics.checkAOE(center, radius, source.team);

    for (const target of targets) {
      let damage = baseDamage;
      
      if (damageType === 'physical') {
        damage = this.calculatePhysicalDamage(baseDamage, target);
      } else if (damageType === 'magic') {
        damage = this.calculateMagicDamage(baseDamage, target);
      }

      this.engine.dealDamage(sourceId, target.id, damage, damageType);
      totalDamage += damage;
    }

    return totalDamage;
  }

  // ==========================================
  // DOT (DAMAGE OVER TIME)
  // ==========================================

  applyDOT(sourceId: string, targetId: string, damage: number, duration: number, tickRate: number = 1): void {
    const target = this.engine.getEntity(targetId);
    if (!target) return;

    const ticks = Math.ceil(duration * tickRate);
    const damagePerTick = damage / ticks;
    const tickInterval = 1000 / tickRate;

    const dotId = uuid();
    
    const applyTick = () => {
      const currentTarget = this.engine.getEntity(targetId);
      if (!currentTarget || this.engine.isDead(currentTarget)) return;
      
      this.engine.dealDamage(sourceId, targetId, damagePerTick, 'magic');
    };

    // Apply ticks
    for (let i = 0; i < ticks; i++) {
      setTimeout(applyTick, i * tickInterval);
    }
  }

  // ==========================================
  // CROWD CONTROL
  // ==========================================

  applyStun(targetId: string, duration: number, sourceId?: string): void {
    const entity = this.engine.getEntity(targetId);
    if (!entity) return;

    entity.states.push({
      type: 'stunned',
      startTime: this.engine.state.time,
      duration,
      source: sourceId,
    });

    entity.velocity = { x: 0, y: 0 };

    this.engine.emit('ccApplied', {
      targetId,
      type: 'stun',
      duration,
      sourceId,
      timestamp: this.engine.state.time,
    });
  }

  applyRoot(targetId: string, duration: number, sourceId?: string): void {
    const entity = this.engine.getEntity(targetId);
    if (!entity) return;

    entity.states.push({
      type: 'rooted',
      startTime: this.engine.state.time,
      duration,
      source: sourceId,
    });

    entity.velocity = { x: 0, y: 0 };

    this.engine.emit('ccApplied', {
      targetId,
      type: 'root',
      duration,
      sourceId,
      timestamp: this.engine.state.time,
    });
  }

  applySlow(targetId: string, amount: number, duration: number, sourceId?: string): void {
    const entity = this.engine.getEntity(targetId);
    if (!entity) return;

    // Slow is applied as a buff that modifies move speed
    entity.buffs.push({
      id: uuid(),
      name: 'slow',
      icon: '',
      stacks: 1,
      maxStacks: 1,
      duration,
      startTime: this.engine.state.time,
      source: sourceId || 'system',
      effects: [{ stat: 'currentMoveSpeed', value: -amount, type: 'percent' }],
    });

    // Apply slow immediately
    const slowMultiplier = 1 - (amount / 100);
    entity.stats.currentMoveSpeed = Math.max(50, entity.stats.currentMoveSpeed * slowMultiplier);

    this.engine.emit('ccApplied', {
      targetId,
      type: 'slow',
      amount,
      duration,
      sourceId,
      timestamp: this.engine.state.time,
    });
  }

  applySilence(targetId: string, duration: number, sourceId?: string): void {
    const entity = this.engine.getEntity(targetId);
    if (!entity) return;

    entity.states.push({
      type: 'silenced',
      startTime: this.engine.state.time,
      duration,
      source: sourceId,
    });

    this.engine.emit('ccApplied', {
      targetId,
      type: 'silence',
      duration,
      sourceId,
      timestamp: this.engine.state.time,
    });
  }

  applyFear(targetId: string, duration: number, sourceId?: string): void {
    const entity = this.engine.getEntity(targetId);
    if (!entity) return;

    entity.states.push({
      type: 'feared',
      startTime: this.engine.state.time,
      duration,
      source: sourceId,
    });

    // In fear, entity runs in random direction
    const angle = Math.random() * Math.PI * 2;
    entity.velocity = {
      x: Math.cos(angle) * entity.stats.currentMoveSpeed,
      y: Math.sin(angle) * entity.stats.currentMoveSpeed,
    };

    this.engine.emit('ccApplied', {
      targetId,
      type: 'fear',
      duration,
      sourceId,
      timestamp: this.engine.state.time,
    });
  }

  // ==========================================
  // UPDATE
  // ==========================================

  update(dt: number): void {
    // Update buff durations
    this.updateBuffs(dt);
    
    // Update state durations (remove expired states)
    this.updateStates(dt);

    // Auto-attack logic is event-driven
  }

  private updateBuffs(dt: number): void {
    for (const entity of Object.values(this.engine.state.entities)) {
      const expiredBuffs: string[] = [];

      for (const buff of entity.buffs) {
        const elapsed = this.engine.state.time - buff.startTime;
        if (elapsed >= buff.duration) {
          expiredBuffs.push(buff.id);
          
          // Remove stat modifications from buff
          for (const effect of buff.effects) {
            if (effect.stat) {
              this.reverseStatModification(entity, effect.stat, effect.value);
            }
          }
        }
      }

      entity.buffs = entity.buffs.filter(b => !expiredBuffs.includes(b.id));
    }
  }

  private updateStates(dt: number): void {
    for (const entity of Object.values(this.engine.state.entities)) {
      entity.states = entity.states.filter(state => {
        const elapsed = this.engine.state.time - state.startTime;
        
        // For movement-impairing states, restore velocity
        if (elapsed >= state.duration) {
          if (state.type === 'stunned' || state.type === 'rooted' || state.type === 'feared' || state.type === 'sleeping') {
            // Velocity should be set by movement system based on orders
          }
          return false;
        }
        return true;
      });
    }
  }

  private reverseStatModification(entity: GameEntity, stat: string, value: number): void {
    // Reverse the stat modification (subtract instead of add)
    this.modifyStat(entity, stat, -value);
  }

  // ==========================================
  // STAT CALCULATIONS
  // ==========================================

  /**
   * Recalculate all derived stats for an entity
   * Should be called when items/levels change
   */
  recalculateStats(entityId: string): void {
    const entity = this.engine.getEntity(entityId);
    if (!entity) return;

    // Base stats from champion data
    const baseStats = entity.baseStats;
    
    // Start with base stats
    let health = baseStats.health;
    let mana = baseStats.mana;
    let ad = baseStats.attackDamage;
    let armor = baseStats.armor;
    let mr = baseStats.magicResist;
    let moveSpeed = baseStats.moveSpeed;
    let attackRange = baseStats.attackRange;
    let attackSpeed = baseStats.attackSpeed;
    
    // Apply level scaling
    const level = entity.current.level;
    health += (level - 1) * baseStats.healthPerLevel;
    mana += (level - 1) * baseStats.manaPerLevel;
    ad += (level - 1) * baseStats.attackDamagePerLevel;
    armor += (level - 1) * baseStats.armorPerLevel;
    mr += (level - 1) * baseStats.magicResistPerLevel;
    attackSpeed = baseStats.attackSpeed * (1 + (level - 1) * baseStats.attackSpeedPerLevel / 100);

    // Apply item bonuses from ItemSystem
    const itemStats = this.engine.getItemBonuses(entityId);
    health += itemStats.health || 0;
    mana += itemStats.mana || 0;
    ad += itemStats.ad || 0;
    armor += itemStats.armor || 0;
    mr += itemStats.mr || 0;
    moveSpeed += itemStats.moveSpeed || 0;
    attackRange += itemStats.attackRange || 0;
    attackSpeed *= (1 + (itemStats.attackSpeed || 0) / 100);
    
    // Apply buff effects
    for (const buff of entity.buffs) {
      for (const effect of buff.effects) {
        if (effect.stat) {
          if (effect.type === 'flat') {
            // Direct stat modification already handled in applyBuff
          } else if (effect.type === 'percent') {
            // Applied in applyBuff/debuff
          }
        }
      }
    }

    // Update entity stats
    entity.stats.currentHealth = health;
    entity.stats.currentMana = mana;
    entity.stats.currentAD = ad;
    entity.stats.currentArmor = armor;
    entity.stats.currentMR = mr;
    entity.stats.currentMoveSpeed = Math.max(50, moveSpeed); // Min move speed
    entity.stats.currentRange = attackRange;
    entity.stats.currentAttackSpeed = Math.min(2.5, attackSpeed); // Cap at 2.5

    // Also update the entity's current max values
    entity.current.maxHealth = health;
    entity.current.maxMana = mana;

    // Recalculate derived values
    entity.stats.attackSpeedMultiplier = attackSpeed / baseStats.attackSpeed;
  }
}
