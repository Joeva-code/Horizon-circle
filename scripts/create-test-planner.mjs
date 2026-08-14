import '../src/config/database.js';
import bcrypt from 'bcryptjs';

const prisma = (await import('../src/config/database.js')).prisma;

async function main() {
  const hashed = await bcrypt.hash('TestPass123!', 10);
  const user = await prisma.user.create({
    data: {
      email: 'auth-test-planner@example.com',
      password: hashed,
      firstName: 'Auth',
      lastName: 'Tester',
      role: 'PLANNER',
      isVerified: true,
      termsAcceptedAt: new Date(),
      plannerProfile: { create: {} }
    },
    select: { id: true, email: true, role: true }
  });
  console.log('Created test planner:', JSON.stringify(user));
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
