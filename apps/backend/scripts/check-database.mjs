import { PrismaService } from '../dist/database/prisma.service.js';

const prisma = new PrismaService();
try {
  await prisma.$connect();
  const result = await prisma.$queryRaw`SELECT 1 AS connection_check`;
  if (result[0]?.connection_check !== 1) {
    throw new Error('Unexpected database check result.');
  }
  console.log('Prisma PostgreSQL connection check passed.');
} catch {
  console.error('Prisma database check failed. Verify DATABASE_URL and PostgreSQL availability.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
