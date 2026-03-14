import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;

export async function findOrCreateUser(
  telegramId: bigint,
  firstName: string,
  lastName?: string,
  username?: string
): Promise<User> {
  const existing = await prisma.user.findUnique({
    where: { telegramId },
  });

  if (existing) {
    return prisma.user.update({
      where: { telegramId },
      data: { firstName, lastName, username },
    });
  }

  return prisma.user.create({
    data: { telegramId, firstName, lastName, username },
  });
}
