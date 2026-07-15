/**
 * CombatSystem - Damage calculation, auto-attacks, on-hit effects
 */
import type { GameEntity, DamageType } from '../../../../shared/src/types/game';
import type { GameEngine } from './GameEngine';

export class CombatSystem {
  private engine: GameEngine;
  private attackTimers: Map<string, number> = new Map();

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  // ==========================================
  // DAMAGE CALCULATION
  // ==========================================

  calculatePhysicalDamage(baseDamage: number, target: GameEntity): number {
    const armor = target.stats.currentArmor;
    const penetration = target.stats.armorPenetration;
    const effectiveArmor = Math.max(0, armor * (1 - penetration / 100));

    // Armor formula: damage reduction = armor / (100 + armor)
    const reduction = effectiveArmor / (100 + effectiveArmor);
    return Math.floor(baseDamage * (1 - reduction));
  }

  calculateMagicDamage(baseDamage: number, target: GameEntity): number {
    const mr = target.stats.currentMR;
    const penetration = target.stats.magicPenetration;
    const effectiveMR = Math.max(0, mr * (1 - penetration / 100));

    const reduction = effectiveMR / (100 + effectiveMR);
    return Math.floor(baseDamage * (1 - reduction));
  }

  // ==========================================
  // AUTO ATTACKS
  // ==========================================

  attemptAutoAttack(attackerId: string, targetId: string): boolean {
    const attacker = this.engine.getEntity(attackerId);
    const target = this.engine.getEntity(targetId);

    if (!attacker || !target) return false;
    if (this.engine.isDead(attacker) || this.engine.isDead(target)) return false;
    if (!this.canAttack(attacker, target)) return false;

    const attackSpeed = attacker.stats.currentAttackSpeed;
    const attackTime = 1 / attackSpeed;
    const lastAttack = this.attackTimers.get(attackerId) || 0;
    const now = this.engine.state.time;

    if (now - lastAttack < attackTime) return false;

    // Deal damage
    const critChance = attacker.stats.critChance;
    const isCrit = Math.random() < critChance;
    const ad = attacker.stats.currentAD;
    const critMult = attacker.stats.critMultiplier;
    const damage = isCrit ? ad * critMult : ad;

    this.engine.dealDamage(attackerId, targetId, damage, 'physical');

    // On-hit effects (lifesteal, on-hit procs)
    if (attacker.stats.lifesteal > 0) {
      const heal = damage * attacker.stats.lifesteal;
      this.applyHealing(attackerId, attackerId, heal);
    }

    this.attackTimers.set(attackerId, now);
    attacker.model.animation = 'attack';
    attacker.facing = this.engine.state.entities[targetId]
      ? Math.atan2(
          target.position.y - attacker.position.y,
          target.position.x - attacker.position.x
        )
      : attacker.facing;

    return true;
  }

  private canAttack(attacker: GameEntity, target: GameEntity): boolean {
    if (attacker.team === target.team) return false;

    const range = attacker.stats.currentRange;
    const dist = this.engine.state.entities[target.id]
      ? Math.sqrt(
          (target.position.x - attacker.position.x) ** 2 +
          (target.position.y - attacker.position.y) ** 2
        )
      : Infinity;

    return dist <= range;
  }

  // ==========================================
  // HEALING
  // ==========================================

  applyHealing(sourceId: string, targetId: string, amount: number): void {
    const target = this.engine.getEntity(targetId);
    if (!target) return;

    target.current.health = Math.min(target.current.maxHealth, target.current.health + amount);
    this.engine.emit('heal', { sourceId, targetId, amount });
  }

  applyShield(targetId: string, amount: number, duration: number): void {
    const target = this.engine.getEntity(targetId);
    if (!target) return;

    target.buffs.push({
      id: `shield-${Date.now()}`,
      name: 'Shield',
      icon: '',
      stacks: 1,
      maxStacks: 1,
      duration,
      startTime: this.engine.state.time,
      source: 'system',
      effects: [{ stat: 'health', value: amount, type: 'flat' }],
    });
  }

  // ==========================================
  // UPDATE
  // ==========================================

  update(_dt: number): void {
    // Auto-attack logic is event-driven, not polled
  }
}
