import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

export const storeRoutes = Router();

storeRoutes.get('/items', async (_req, res, next) => {
  try {
    const { category } = _req.query;

    const where: any = {};
    if (category) where.type = category;

    const champions = await prisma.champion.findMany({
      where: { isEnabled: true },
      select: {
        id: true,
        name: true,
        portrait: true,
        roles: true,
        priceBlueEssence: true,
        priceRP: true,
      },
    });

    const items = champions.map(c => ({
      id: c.id,
      type: 'champion' as const,
      name: c.name,
      icon: c.portrait,
      category: 'champions',
      price: {
        blueEssence: c.priceBlueEssence,
        rp: c.priceRP,
        isFree: false,
      },
      isOwned: false,
    }));

    res.json(items);
  } catch (error) {
    next(error);
  }
});

storeRoutes.get('/inventory', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        ownedChampions: { where: { isOwned: true }, include: { champion: true } },
        ownedSkins: { where: { isOwned: true }, include: { champion: true } },
      },
    });

    res.json({
      champions: user?.ownedChampions.map(uc => uc.championId) || [],
      skins: user?.ownedSkins.map(us => us.championId) || [],
      blueEssence: user?.blueEssence || 0,
      rp: user?.rp || 0,
    });
  } catch (error) {
    next(error);
  }
});

storeRoutes.post('/purchase', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { itemId, itemType, paymentMethod } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { inventory: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get item price
    let price = { blueEssence: 0, rp: 0 };
    if (itemType === 'champion') {
      const champ = await prisma.champion.findUnique({ where: { id: itemId } });
      if (!champ) return res.status(404).json({ error: 'Item not found' });
      price = { blueEssence: champ.priceBlueEssence, rp: champ.priceRP };
    }

    // Check balance
    if (paymentMethod === 'rp') {
      if ((user.inventory?.rp || 0) < price.rp) {
        return res.status(400).json({ error: 'Insufficient RP' });
      }
    } else if (paymentMethod === 'blue-essence') {
      if ((user.inventory?.blueEssence || 0) < price.blueEssence) {
        return res.status(400).json({ error: 'Insufficient Blue Essence' });
      }
    }

    // Purchase
    await prisma.$transaction(async (tx) => {
      // Deduct currency
      if (paymentMethod === 'rp') {
        await tx.inventory.update({
          where: { userId: user.id },
          data: { rp: { decrement: price.rp } },
        });
      } else {
        await tx.inventory.update({
          where: { userId: user.id },
          data: { blueEssence: { decrement: price.blueEssence } },
        });
      }

      // Grant item
      if (itemType === 'champion') {
        await tx.userChampion.upsert({
          where: { userId_championId: { userId: user.id, championId: itemId } },
          create: { userId: user.id, championId: itemId, isOwned: true },
          update: { isOwned: true },
        });
      }

      // Record transaction
      await tx.transaction.create({
        data: {
          userId: user.id,
          itemId,
          itemType,
          priceRP: price.rp,
          priceBlueEssence: price.blueEssence,
          status: 'completed',
        },
      });
    });

    res.json({ success: true, message: 'Purchase successful' });
  } catch (error) {
    next(error);
  }
});
