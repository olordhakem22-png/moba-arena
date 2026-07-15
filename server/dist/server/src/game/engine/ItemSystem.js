"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemSystem = exports.ITEM_DATABASE = void 0;
const game_1 = require("@shared/constants/game");
// Item database
exports.ITEM_DATABASE = {
    // Basic items
    'longsword': {
        id: 'longsword',
        name: 'Long Sword',
        cost: 350,
        stats: { ad: 10 },
        effects: [],
        buildFrom: [],
        sellValue: 245,
    },
    'amplifying_tome': {
        id: 'amplifying_tome',
        name: 'Amplifying Tome',
        cost: 435,
        stats: { ap: 20 },
        effects: [],
        buildFrom: [],
        sellValue: 304,
    },
    'chain_vest': {
        id: 'chain_vest',
        name: 'Chain Vest',
        cost: 800,
        stats: { armor: 40 },
        effects: [],
        buildFrom: [],
        sellValue: 560,
    },
    'negatron_cloak': {
        id: 'negatron_cloak',
        name: 'Negatron Cloak',
        cost: 850,
        stats: { mr: 50 },
        effects: [],
        buildFrom: [],
        sellValue: 595,
    },
    'zeal': {
        id: 'zeal',
        name: 'Zeal',
        cost: 1050,
        stats: { attackSpeed: 15, critChance: 15 },
        effects: [],
        buildFrom: [],
        sellValue: 735,
    },
    'vampiric_scepter': {
        id: 'vampiric_scepter',
        name: 'Vampiric Scepter',
        cost: 900,
        stats: { lifesteal: 10 },
        effects: [],
        buildFrom: [],
        sellValue: 630,
    },
    'kindlegem': {
        id: 'kindlegem',
        name: 'Kindlegem',
        cost: 800,
        stats: { health: 200, cdr: 10 },
        effects: [],
        buildFrom: [],
        sellValue: 560,
    },
    ' NLR ': {
        id: ' NLR ',
        name: 'Needlessly Large Rod',
        cost: 1250,
        stats: { ap: 60 },
        effects: [],
        buildFrom: [],
        sellValue: 875,
    },
    'bf_sword': {
        id: 'bf_sword',
        name: 'B.F. Sword',
        cost: 1300,
        stats: { ad: 40 },
        effects: [],
        buildFrom: [],
        sellValue: 910,
    },
    // Completed items
    'infinity_edge': {
        id: 'infinity_edge',
        name: 'Infinity Edge',
        cost: 3400,
        stats: { ad: 70, critChance: 25, critDamage: 40 },
        effects: [{ type: 'passive', name: 'Critical Damage', data: {} }],
        buildFrom: ['bf_sword', 'pickaxe', 'cloak'],
        sellValue: 2380,
    },
    'runaans_hurricane': {
        id: 'runaans_hurricane',
        name: "Runaan's Hurricane",
        cost: 2600,
        stats: { attackSpeed: 40, critChance: 20 },
        effects: [{ type: 'passive', name: 'Wind Fury', data: { extraTargets: 2, damagePercent: 40 } }],
        buildFrom: ['zeal', 'cloak'],
        sellValue: 1820,
    },
    'kraken_slayer': {
        id: 'kraken_slayer',
        name: 'Kraken Slayer',
        cost: 3400,
        stats: { ad: 50, attackSpeed: 25, critChance: 20 },
        effects: [{ type: 'onHit', name: 'Bring It Down', data: { damage: 60, cooldown: 3 } }],
        buildFrom: ['zeal', 'pickaxe'],
        sellValue: 2380,
    },
    'blade_of_the_ruined_king': {
        id: 'blade_of_the_ruined_king',
        name: 'Blade of the Ruined King',
        cost: 3200,
        stats: { ad: 40, attackSpeed: 30, lifesteal: 10 },
        effects: [{ type: 'onHit', name: 'Siphon', data: { damage: 8, healPercent: 1 } }],
        buildFrom: ['vampiric_scepter', 'zeal', 'pickaxe'],
        sellValue: 2240,
    },
    'mortal_reminder': {
        id: 'mortal_reminder',
        name: 'Mortal Reminder',
        cost: 3000,
        stats: { ad: 50, attackSpeed: 20, critChance: 20 },
        effects: [{ type: 'onHit', name: 'Last Whisper', data: { armorPenPercent: 30 } }],
        buildFrom: ['zeal', 'longsword'],
        sellValue: 2100,
    },
    // Mage items
    'rabadons_deathcap': {
        id: 'rabadons_deathcap',
        name: "Rabadon's Deathcap",
        cost: 3600,
        stats: { ap: 120 },
        effects: [{ type: 'passive', name: 'Magical Opus', data: { apPercentBonus: 35 } }],
        buildFrom: [' NLR ', ' NLR '],
        sellValue: 2520,
    },
    'void_staff': {
        id: 'void_staff',
        name: 'Void Staff',
        cost: 2650,
        stats: { ap: 70, magicPenPercent: 40 },
        effects: [],
        buildFrom: [' NLR ', 'amplifying_tome'],
        sellValue: 1855,
    },
    'ludens_tempest': {
        id: 'ludens_tempest',
        name: "Luden's Tempest",
        cost: 3400,
        stats: { ap: 90, moveSpeed: 5, cdr: 10, magicPenFlat: 6 },
        effects: [{ type: 'onHit', name: 'Echo', data: { damage: 100, cooldown: 10 } }],
        buildFrom: [' NLR ', 'kindlegem', 'amplifying_tome'],
        sellValue: 2380,
    },
    'liandrys_torment': {
        id: 'liandrys_torment',
        name: "Liandry's Torment",
        cost: 3400,
        stats: { ap: 75, health: 300, magicPenFlat: 15 },
        effects: [{ type: 'onDamage', name: 'Torment', data: { burnDamage: 50, burnDuration: 3 } }],
        buildFrom: [' NLR ', 'kindlegem'],
        sellValue: 2380,
    },
    'zhonyas_hourglass': {
        id: 'zhonyas_hourglass',
        name: "Zhonya's Hourglass",
        cost: 2900,
        stats: { ap: 70, armor: 50 },
        effects: [{ type: 'active', name: 'Stopwatch', data: { invulnerableDuration: 2.5, cooldown: 120 } }],
        buildFrom: [' NLR ', 'chain_vest'],
        sellValue: 2030,
    },
    // Tank items
    'sunfire_aegis': {
        id: 'sunfire_aegis',
        name: 'Sunfire Aegis',
        cost: 3200,
        stats: { health: 450, armor: 45, cdr: 10 },
        effects: [{ type: 'passive', name: 'Immolate', data: { damagePerSecond: 25, radius: 325 } }],
        buildFrom: ['kindlegem', 'chain_vest', 'ruby_crystal'],
        sellValue: 2240,
    },
    'thornmail': {
        id: 'thornmail',
        name: 'Thornmail',
        cost: 2900,
        stats: { armor: 60, health: 250 },
        effects: [{ type: 'onHit', name: 'Thorns', data: { reflectDamage: 10, slowPercent: 30 } }],
        buildFrom: ['chain_vest', 'ruby_crystal', 'bramble_vest'],
        sellValue: 2030,
    },
    'spirit_visage': {
        id: 'spirit_visage',
        name: 'Spirit Visage',
        cost: 2900,
        stats: { health: 300, mr: 50, cdr: 10 },
        effects: [{ type: 'passive', name: 'Fortify', data: { healingBonusPercent: 25 } }],
        buildFrom: ['negatron_cloak', 'kindlegem', 'ruby_crystal'],
        sellValue: 2030,
    },
    'randuins_omen': {
        id: 'randuins_omen',
        name: "Randuin's Omen",
        cost: 3000,
        stats: { health: 300, armor: 50, cdr: 10 },
        effects: [{ type: 'active', name: 'Humility', data: { slowPercent: 40, slowDuration: 2, radius: 500 } }],
        buildFrom: ['chain_vest', 'kindlegem', 'ruby_crystal'],
        sellValue: 2100,
    },
    'force_of_nature': {
        id: 'force_of_nature',
        name: 'Force of Nature',
        cost: 2900,
        stats: { mr: 60, health: 300, moveSpeed: 3 },
        effects: [{ type: 'passive', name: 'Flow', data: { healthRegenBonus: 30 } }],
        buildFrom: ['negatron_cloak', 'kindlegem', 'ruby_crystal'],
        sellValue: 2030,
    },
    // Support items
    'ardent_censer': {
        id: 'ardent_censer',
        name: 'Ardent Censer',
        cost: 2300,
        stats: { ap: 40, attackSpeed: 15, healPower: 10 },
        effects: [{ type: 'onHeal', name: 'Sanctuary', data: { attackSpeedBuff: 25, lifestealBuff: 10 } }],
        buildFrom: ['amplifying_tome', 'kindlegem', ' NLR '],
        sellValue: 1610,
    },
    'redemption': {
        id: 'redemption',
        name: 'Redemption',
        cost: 2400,
        stats: { ap: 40, health: 200, cdr: 10, healPower: 10 },
        effects: [{ type: 'active', name: 'Intervention', data: { healAmount: 250, damage: 150, radius: 550, cooldown: 120 } }],
        buildFrom: [' NLR ', 'kindlegem', 'ruby_crystal'],
        sellValue: 1680,
    },
    'mobis_boots': {
        id: 'mobis_boots',
        name: "Boots of Swiftness",
        cost: 1100,
        stats: { moveSpeed: 60 },
        effects: [],
        buildFrom: [],
        sellValue: 770,
    },
    'berserker_greaves': {
        id: 'berserker_greaves',
        name: "Berserker's Greaves",
        cost: 1100,
        stats: { moveSpeed: 45, attackSpeed: 25 },
        effects: [],
        buildFrom: [],
        sellValue: 770,
    },
    'plated_steelcaps': {
        id: 'plated_steelcaps',
        name: "Plated Steelcaps",
        cost: 1100,
        stats: { moveSpeed: 45, armor: 20 },
        effects: [],
        buildFrom: [],
        sellValue: 770,
    },
    'mercurys_treads': {
        id: 'mercurys_treads',
        name: "Mercury's Treads",
        cost: 1100,
        stats: { moveSpeed: 45, mr: 25 },
        effects: [],
        buildFrom: [],
        sellValue: 770,
    },
};
class ItemSystem {
    engine;
    equippedItems = new Map();
    activeEffects = new Map(); // entityId -> (effectId -> cooldown)
    constructor(engine) {
        this.engine = engine;
    }
    // ==========================================
    // ITEM MANAGEMENT
    // ==========================================
    initializeEntity(entityId) {
        this.equippedItems.set(entityId, {
            slots: [null, null, null, null, null, null], // 6 item slots
            itemCount: 0,
            totalCost: 0,
        });
        this.activeEffects.set(entityId, new Map());
    }
    purchaseItem(entityId, itemId) {
        const entity = this.engine.getEntity(entityId);
        if (!entity || entity.type !== 'champion')
            return false;
        const item = exports.ITEM_DATABASE[itemId];
        if (!item)
            return false;
        const equipped = this.equippedItems.get(entityId);
        if (!equipped) {
            this.initializeEntity(entityId);
        }
        const equipment = this.equippedItems.get(entityId);
        // Check if slots are full
        if (equipment.itemCount >= game_1.GAME_CONSTANTS.MAX_ITEMS)
            return false;
        // Check if can afford
        if (entity.current.gold < item.cost)
            return false;
        // Find empty slot
        const slotIndex = equipment.slots.findIndex(s => s === null);
        if (slotIndex === -1)
            return false;
        // Purchase
        entity.current.gold -= item.cost;
        equipment.slots[slotIndex] = item;
        equipment.itemCount++;
        equipment.totalCost += item.cost;
        // Apply item stats
        this.applyItemStats(entityId, item);
        // Event
        this.engine.addGameEvent('item_purchase', {
            entityId,
            itemId,
            slot: slotIndex,
            cost: item.cost,
        });
        this.engine.emit('itemPurchased', {
            entityId,
            itemId,
            slot: slotIndex,
            timestamp: this.engine.state.time,
        });
        return true;
    }
    sellItem(entityId, slot) {
        const entity = this.engine.getEntity(entityId);
        if (!entity)
            return false;
        const equipment = this.equippedItems.get(entityId);
        if (!equipment)
            return false;
        const item = equipment.slots[slot];
        if (!item)
            return false;
        // Remove item stats
        this.removeItemStats(entityId, item);
        // Refund gold
        entity.current.gold += item.sellValue;
        // Clear slot
        equipment.slots[slot] = null;
        equipment.itemCount--;
        equipment.totalCost -= item.cost;
        // Event
        this.engine.addGameEvent('item_sell', {
            entityId,
            itemId: item.id,
            slot,
            refund: item.sellValue,
        });
        return true;
    }
    // ==========================================
    // STAT APPLICATION
    // ==========================================
    applyItemStats(entityId, item) {
        const entity = this.engine.getEntity(entityId);
        if (!entity)
            return;
        // Apply stats
        const stats = item.stats;
        if (stats.health)
            entity.stats.health += stats.health;
        if (stats.mana)
            entity.stats.mana += stats.mana;
        if (stats.ad)
            entity.stats.currentAD += stats.ad;
        if (stats.ap)
            entity.stats.currentAP += stats.ap;
        if (stats.armor)
            entity.stats.currentArmor += stats.armor;
        if (stats.mr)
            entity.stats.currentMR += stats.mr;
        if (stats.attackSpeed)
            entity.stats.currentAttackSpeed += stats.attackSpeed / 100;
        if (stats.moveSpeed)
            entity.stats.currentMoveSpeed += stats.moveSpeed;
        if (stats.critChance)
            entity.stats.critChance += stats.critChance / 100;
        if (stats.critDamage)
            entity.stats.critMultiplier += stats.critDamage / 100;
        if (stats.lifesteal)
            entity.stats.lifesteal += stats.lifesteal / 100;
        if (stats.armorPenFlat)
            entity.stats.armorPenetration += stats.armorPenFlat;
        if (stats.armorPenPercent)
            entity.stats.armorPenetration += stats.armorPenPercent; // Add to existing percent
        if (stats.magicPenFlat)
            entity.stats.magicPenetration += stats.magicPenFlat;
        if (stats.magicPenPercent)
            entity.stats.magicPenetration += stats.magicPenPercent;
        if (stats.cdr)
            entity.stats.cdr += stats.cdr;
        // Recalculate derived stats
        entity.current.maxHealth = entity.stats.health;
        entity.current.maxMana = entity.stats.mana || 0;
    }
    removeItemStats(entityId, item) {
        const entity = this.engine.getEntity(entityId);
        if (!entity)
            return;
        const stats = item.stats;
        if (stats.health)
            entity.stats.health -= stats.health;
        if (stats.mana)
            entity.stats.mana -= stats.mana;
        if (stats.ad)
            entity.stats.currentAD -= stats.ad;
        if (stats.ap)
            entity.stats.currentAP -= stats.ap;
        if (stats.armor)
            entity.stats.currentArmor -= stats.armor;
        if (stats.mr)
            entity.stats.currentMR -= stats.mr;
        if (stats.attackSpeed)
            entity.stats.currentAttackSpeed -= stats.attackSpeed / 100;
        if (stats.moveSpeed)
            entity.stats.currentMoveSpeed -= stats.moveSpeed;
        if (stats.critChance)
            entity.stats.critChance -= stats.critChance / 100;
        if (stats.critDamage)
            entity.stats.critMultiplier -= stats.critDamage / 100;
        if (stats.lifesteal)
            entity.stats.lifesteal -= stats.lifesteal / 100;
        if (stats.armorPenFlat)
            entity.stats.armorPenetration -= stats.armorPenFlat;
        if (stats.armorPenPercent)
            entity.stats.armorPenetration -= stats.armorPenPercent;
        if (stats.magicPenFlat)
            entity.stats.magicPenetration -= stats.magicPenFlat;
        if (stats.magicPenPercent)
            entity.stats.magicPenetration -= stats.magicPenPercent;
        if (stats.cdr)
            entity.stats.cdr -= stats.cdr;
        // Recalculate derived stats
        entity.current.maxHealth = entity.stats.health;
        entity.current.maxMana = entity.stats.mana || 0;
    }
    // ==========================================
    // ITEM EFFECTS
    // ==========================================
    /**
     * Get item stat for combat calculations
     */
    getItemStat(entityId, statName) {
        const equipment = this.equippedItems.get(entityId);
        if (!equipment)
            return 0;
        let total = 0;
        for (const item of equipment.slots) {
            if (!item)
                continue;
            const value = item.stats[statName];
            if (value)
                total += value;
        }
        return total;
    }
    /**
     * Get all item bonuses for stat recalculation
     */
    getItemBonuses(entityId) {
        const equipment = this.equippedItems.get(entityId);
        if (!equipment)
            return {};
        const bonuses = {};
        for (const item of equipment.slots) {
            if (!item)
                continue;
            for (const [key, value] of Object.entries(item.stats)) {
                bonuses[key] = (bonuses[key] || 0) + value;
            }
        }
        return bonuses;
    }
    /**
     * Process on-hit effects
     */
    processOnHit(attackerId, targetId) {
        const equipment = this.equippedItems.get(attackerId);
        if (!equipment)
            return;
        const attacker = this.engine.getEntity(attackerId);
        const target = this.engine.getEntity(targetId);
        if (!attacker || !target)
            return;
        for (const item of equipment.slots) {
            if (!item)
                continue;
            for (const effect of item.effects) {
                if (effect.type === 'onHit') {
                    this.processOnHitEffect(attacker, target, item, effect);
                }
            }
        }
    }
    processOnHitEffect(attacker, target, item, effect) {
        const now = this.engine.state.time;
        const effects = this.activeEffects.get(attacker.id);
        if (!effects)
            return;
        const effectKey = `${item.id}_${effect.name}`;
        const lastUsed = effects.get(effectKey) || 0;
        // Check cooldown
        if (effect.cooldown && now - lastUsed < effect.cooldown)
            return;
        switch (effect.name) {
            case 'Siphon': // BOTRK
                const damage = target.current.maxHealth * (effect.data.damagePercent / 100);
                this.engine.dealDamage(attacker.id, target.id, damage, 'physical');
                const heal = damage * (effect.data.healPercent / 100);
                attacker.current.health = Math.min(attacker.current.maxHealth, attacker.current.health + heal);
                break;
            case 'Echo': // Luden's
                this.engine.dealDamage(attacker.id, target.id, effect.data.damage, 'magic');
                break;
            case 'Bring It Down': // Kraken
                this.engine.dealDamage(attacker.id, target.id, effect.data.damage, 'physical');
                break;
            case 'Thorns': // Thornmail
                const reflectDamage = this.engine.state.entities[target.id].current.health * (effect.data.reflectDamage / 100);
                this.engine.dealDamage(target.id, attacker.id, reflectDamage, 'physical');
                break;
        }
        effects.set(effectKey, now);
    }
    /**
     * Use active item effect (like Zhonya's)
     */
    useActiveItem(entityId, itemSlot) {
        const equipment = this.equippedItems.get(entityId);
        if (!equipment)
            return false;
        const item = equipment.slots[itemSlot];
        if (!item)
            return false;
        const activeEffect = item.effects.find(e => e.type === 'active');
        if (!activeEffect)
            return false;
        const effects = this.activeEffects.get(entityId);
        if (!effects)
            return false;
        const effectKey = `${item.id}_${activeEffect.name}`;
        const lastUsed = effects.get(effectKey) || 0;
        const cooldown = activeEffect.cooldown || 120;
        if (this.engine.state.time - lastUsed < cooldown)
            return false;
        const entity = this.engine.getEntity(entityId);
        if (!entity)
            return false;
        switch (activeEffect.name) {
            case 'Stopwatch': // Zhonya's
                entity.states.push({
                    type: 'invulnerable',
                    startTime: this.engine.state.time,
                    duration: activeEffect.data.invulnerableDuration,
                    source: item.id,
                });
                break;
            case 'Humility': // Randuin's
                const radius = activeEffect.data.radius;
                for (const target of Object.values(this.engine.state.entities)) {
                    if (target.team === entity.team)
                        continue;
                    const dist = this.engine.physics.distance(entity.position, target.position);
                    if (dist <= radius) {
                        this.engine.combat.applySlow(target.id, activeEffect.data.slowPercent, activeEffect.data.slowDuration, entityId);
                    }
                }
                break;
            case 'Intervention': // Redemption
                const healRadius = activeEffect.data.radius;
                for (const ally of Object.values(this.engine.state.entities)) {
                    if (ally.team !== entity.team)
                        continue;
                    const dist = this.engine.physics.distance(entity.position, ally.position);
                    if (dist <= healRadius) {
                        ally.current.health = Math.min(ally.current.maxHealth, ally.current.health + activeEffect.data.healAmount);
                    }
                }
                // Damage enemies
                for (const enemy of Object.values(this.engine.state.entities)) {
                    if (enemy.team === entity.team)
                        continue;
                    const dist = this.engine.physics.distance(entity.position, enemy.position);
                    if (dist <= healRadius) {
                        this.engine.dealDamage(entityId, enemy.id, activeEffect.data.damage, 'magic');
                    }
                }
                break;
        }
        effects.set(effectKey, this.engine.state.time);
        return true;
    }
    // ==========================================
    // UPDATE
    // ==========================================
    update(_dt) {
        // Passive effects are processed in their respective systems
    }
    // ==========================================
    // UTILITIES
    // ==========================================
    getEquippedItems(entityId) {
        const equipment = this.equippedItems.get(entityId);
        if (!equipment)
            return [];
        return equipment.slots.filter((s) => s !== null);
    }
    canAffordItem(entityId, itemId) {
        const entity = this.engine.getEntity(entityId);
        if (!entity)
            return false;
        const item = exports.ITEM_DATABASE[itemId];
        return !!item && entity.current.gold >= item.cost;
    }
    getItemCost(itemId) {
        return exports.ITEM_DATABASE[itemId]?.cost || 0;
    }
    getAvailableItems() {
        return Object.values(exports.ITEM_DATABASE);
    }
}
exports.ItemSystem = ItemSystem;
//# sourceMappingURL=ItemSystem.js.map