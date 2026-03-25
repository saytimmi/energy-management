import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;

export async function findOrCreateUser(
  telegramId: bigint,
  firstName: string,
  lastName?: string,
  username?: string
): Promise<User> {
  return prisma.user.upsert({
    where: { telegramId },
    update: { firstName, lastName, username },
    create: { telegramId, firstName, lastName, username },
  });
}
