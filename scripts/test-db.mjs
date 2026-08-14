import '../src/config/database.js';

const { prisma } = await import('../src/config/database.js');

try {
  await prisma.$connect();
  console.log('DB connected');
  const count = await prisma.user.count();
  console.log('User count:', count);
  await prisma.$disconnect();
} catch (e) {
  console.error('DB error:', e.message);
}
