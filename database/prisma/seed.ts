import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create champions
  const champions = [
    { id: 'lux', name: 'Lux', slug: 'lux', title: 'Lady of Luminosity', lore: 'Luxanna Crownguard hails from Demacia, a kingdom that prizes unity and order. She is a mage of light.', portrait: 'https://picsum.photos/seed/lux/300/400', roles: '["mid","support"]', difficulty: 2, faction: 'order', priceBlueEssence: 450, priceRP: 260, stats: { health: 500, healthPerLevel: 90, mana: 480, manaPerLevel: 30, armor: 18, armorPerLevel: 4, mr: 30, mrPerLevel: 0.5, moveSpeed: 330, attackRange: 550, ad: 50, adPerLevel: 2.5, attackSpeed: 0.625, asPerLevel: 2, critChance: 0, critDamage: 1.75 } },
    { id: 'garen', name: 'Garen', slug: 'garen', title: 'Might of Demacia', lore: 'Garen is a warrior from Demacia who embodies the nations military excellence.', portrait: 'https://picsum.photos/seed/garen/300/400', roles: '["top"]', difficulty: 1, faction: 'order', priceBlueEssence: 450, priceRP: 260, stats: { health: 620, healthPerLevel: 100, mana: 0, manaPerLevel: 0, armor: 36, armorPerLevel: 3.5, mr: 32, mrPerLevel: 1.25, moveSpeed: 340, attackRange: 175, ad: 65, adPerLevel: 4.5, attackSpeed: 0.625, asPerLevel: 2.5, critChance: 0, critDamage: 1.75 } },
    { id: 'ahri', name: 'Ahri', slug: 'ahri', title: 'Nine-Tailed Fox', lore: 'Ahri is a vastaya with a ties to magic, able to manipulate her targets emotions.', portrait: 'https://picsum.photos/seed/ahri/300/400', roles: '["mid"]', difficulty: 3, faction: 'neutral', priceBlueEssence: 480, priceRP: 880, stats: { health: 480, healthPerLevel: 82, mana: 400, manaPerLevel: 35, armor: 18, armorPerLevel: 3.5, mr: 30, mrPerLevel: 0.5, moveSpeed: 330, attackRange: 550, ad: 50, adPerLevel: 3, attackSpeed: 0.625, asPerLevel: 2, critChance: 0, critDamage: 1.75 } },
    { id: 'yasuo', name: 'Yasuo', slug: 'yasuo', title: 'Unforgiven', lore: 'Yasuo is an Ionian swordsman who seeks vengeance for his masters death.', portrait: 'https://picsum.photos/seed/yasuo/300/400', roles: '["mid","top"]', difficulty: 3, faction: 'neutral', priceBlueEssence: 630, priceRP: 975, stats: { health: 520, healthPerLevel: 82, mana: 0, manaPerLevel: 0, armor: 30, armorPerLevel: 3, mr: 30, mrPerLevel: 1.25, moveSpeed: 345, attackRange: 175, ad: 58, adPerLevel: 3.5, attackSpeed: 0.625, asPerLevel: 3.5, critChance: 0, critDamage: 1.75 } },
    { id: 'jinx', name: 'Jinx', slug: 'jinx', title: 'Loose Cannon', lore: 'Jinx is a manic and unpredictable killer who worships chaos and destruction.', portrait: 'https://picsum.photos/seed/jinx/300/400', roles: '["adc"]', difficulty: 2, faction: 'chaos', priceBlueEssence: 630, priceRP: 975, stats: { health: 500, healthPerLevel: 75, mana: 250, manaPerLevel: 45, armor: 26, armorPerLevel: 3.5, mr: 30, mrPerLevel: 0.5, moveSpeed: 325, attackRange: 525, ad: 55, adPerLevel: 3, attackSpeed: 0.625, asPerLevel: 1.5, critChance: 0, critDamage: 1.75 } },
    { id: 'thresh', name: 'Thresh', slug: 'thresh', title: 'Chain Warden', lore: 'Thresh is a sadistic spectral entity who guards the souls of the dead.', portrait: 'https://picsum.photos/seed/thresh/300/400', roles: '["support"]', difficulty: 3, faction: 'chaos', priceBlueEssence: 630, priceRP: 975, stats: { health: 500, healthPerLevel: 85, mana: 310, manaPerLevel: 45, armor: 28, armorPerLevel: 0, mr: 30, mrPerLevel: 0.5, moveSpeed: 330, attackRange: 450, ad: 50, adPerLevel: 3.5, attackSpeed: 0.625, asPerLevel: 3.5, critChance: 0, critDamage: 1.75 } },
    { id: 'lee-sin', name: 'Lee Sin', slug: 'lee-sin', title: 'Blind Monk', lore: 'Lee Sin is a master of the ancient martial art of Shojin.', portrait: 'https://picsum.photos/seed/leesin/300/400', roles: '["jungle"]', difficulty: 3, faction: 'neutral', priceBlueEssence: 480, priceRP: 880, stats: { health: 570, healthPerLevel: 90, mana: 200, manaPerLevel: 0, armor: 32, armorPerLevel: 3.5, mr: 30, mrPerLevel: 1.25, moveSpeed: 345, attackRange: 175, ad: 60, adPerLevel: 3.5, attackSpeed: 0.625, asPerLevel: 3, critChance: 0, critDamage: 1.75 } },
    { id: 'nasus', name: 'Nasus', slug: 'nasus', title: 'Curator of the Sands', lore: 'Nasus is an ascended being of ancient Shurima, a bibliotheque of knowledge.', portrait: 'https://picsum.photos/seed/nasus/300/400', roles: '["top"]', difficulty: 1, faction: 'neutral', priceBlueEssence: 450, priceRP: 780, stats: { health: 620, healthPerLevel: 95, mana: 280, manaPerLevel: 40, armor: 28, armorPerLevel: 3.5, mr: 32, mrPerLevel: 1.25, moveSpeed: 335, attackRange: 175, ad: 60, adPerLevel: 3.5, attackSpeed: 0.625, asPerLevel: 2.2, critChance: 0, critDamage: 1.75 } },
  ];

  for (const champ of champions) {
    const { stats, ...champData } = champ;
    const existing = await prisma.champion.findUnique({ where: { id: champ.id } });

    if (!existing) {
      await prisma.champion.create({
        data: {
          ...champData,
          stats: { create: stats },
          abilities: {
            create: [
              { key: 'P', name: 'Illumination', description: 'Attacks charge enemies with light.', icon: 'passive', cooldown: 0, cost: 0, costType: 'none', range: 0, targeting: 'self' },
              { key: 'Q', name: 'Light Binding', description: 'Projects a ball of light that binds enemies.', icon: 'q', cooldown: 11, cost: 50, costType: 'mana', range: 1300, targeting: 'skillshot' },
              { key: 'W', name: 'Prismatic Barrier', description: 'Throws a prismatic barrier that shields and slows.', icon: 'w', cooldown: 14, cost: 60, costType: 'mana', range: 1200, targeting: 'skillshot' },
              { key: 'E', name: 'Lucent Singularity', description: 'Creates a zone of singularity that slows.', icon: 'e', cooldown: 10, cost: 70, costType: 'mana', range: 1100, targeting: 'aoe' },
              { key: 'R', name: 'Final Spark', description: 'Fires a massive beam of light.', icon: 'r', cooldown: 80, cost: 100, costType: 'mana', range: 3000, targeting: 'global' },
            ],
          },
        },
      });
    }
  }

  // Create admin user
  const adminHash = await bcrypt.hash('admin123', 12);
  const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@mobaarena.com' } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        username: 'Admin',
        email: 'admin@mobaarena.com',
        passwordHash: adminHash,
        role: 'SUPERADMIN',
        level: 30,
        rank: 'CHALLENGER',
        rankLP: 500,
        rankDivision: 1,
        mmr: 6500,
        wins: 999,
        losses: 1,
        blueEssence: 999999,
        rp: 999999,
        status: 'ONLINE',
        inventory: { create: { blueEssence: 999999, rp: 999999 } },
      },
    });
  }

  // Create demo player
  const demoHash = await bcrypt.hash('player123', 12);
  const existingDemo = await prisma.user.findUnique({ where: { email: 'player@test.com' } });
  if (!existingDemo) {
    await prisma.user.create({
      data: {
        username: 'TestPlayer',
        email: 'player@test.com',
        passwordHash: demoHash,
        role: 'PLAYER',
        level: 10,
        rank: 'GOLD',
        rankLP: 75,
        rankDivision: 3,
        mmr: 1800,
        wins: 42,
        losses: 38,
        blueEssence: 5000,
        rp: 500,
        status: 'ONLINE',
        inventory: { create: { blueEssence: 5000, rp: 500 } },
      },
    });
  }

  // Create default channels
  const channels = [
    { name: 'global', type: 'global', description: 'Global chat', isPrivate: false },
    { name: 'help', type: 'global', description: 'Help and support', isPrivate: false },
  ];

  for (const channel of channels) {
    const existing = await prisma.chatChannel.findUnique({ where: { name: channel.name } });
    if (!existing) {
      await prisma.chatChannel.create({ data: channel });
    }
  }

  console.log('✅ Seeding complete!');
  console.log('   Admin login: admin@mobaarena.com / admin123');
  console.log('   Demo login:  player@test.com / player123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
