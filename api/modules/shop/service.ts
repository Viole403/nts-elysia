import { prisma } from '../../lib/prisma';
import { ShopItemStatus, PaymentType, PaymentEntityType, PaymentGateway } from '@prisma/client';
import { PaymentService } from '../../modules/payments/service';

export class ShopItemService {
  static async create(data: { name: string; description: string; price: number; stock: number; sellerId: string }) {
    return prisma.shopItem.create({
      data,
    });
  }

  static async findAll(filters: { sellerId?: string; status?: ShopItemStatus }, page: number = 1, limit: number = 10) {
    const where: any = {};
    if (filters.sellerId) {
      where.sellerId = filters.sellerId;
    }
    if (filters.status) {
      where.status = filters.status as ShopItemStatus;
    }

    const skip = (page - 1) * limit;

    const shopItems = await prisma.shopItem.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    const total = await prisma.shopItem.count({ where });
    return { shopItems, total, page, limit };
  }

  static async findOne(id: string) {
    return prisma.shopItem.findUnique({
      where: { id },
    });
  }

  static async update(id: string, data: any) {
    return prisma.shopItem.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    return prisma.shopItem.delete({
      where: { id },
    });
  }

  static async purchaseItem(shopItemId: string, userId: string, quantity: number, paymentGateway: PaymentGateway) {
    const item = await prisma.shopItem.findUnique({
      where: { id: shopItemId },
    });

    if (!item) {
      throw new Error('Shop item not found');
    }

    if (item.stock - item.reservedStock < quantity) {
      throw new Error('Not enough available stock');
    }

    // Reserve stock
    await prisma.shopItem.update({
      where: { id: shopItemId },
      data: { reservedStock: { increment: quantity } },
    });

    const totalAmount = item.price * quantity;

    // Create a payment record
    const payment = await PaymentService.create({
      userId,
      amount: totalAmount,
      paymentType: PaymentType.SHOP_ITEM_PURCHASE,
      entityId: shopItemId,
      entityType: PaymentEntityType.SHOP_ITEM,
      paymentGateway,
      quantity, // Pass quantity to payment service
    });

    return payment;
  }
}
