import { prisma } from '../src/config/database.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Starting seed...');

  const vendors = [
    {
      email: 'tunde.photo@example.com',
      password: 'password123',
      firstName: 'Tunde',
      lastName: 'Ogunlesi',
      role: 'VENDOR',
      profile: {
        businessName: 'Tunde Photography',
        category: 'Photographer',
        description: 'Professional photographer with 8 years of experience in weddings, corporate events, and portraits.',
        location: 'Lagos, Nigeria',
        priceRange: '₦150,000 - ₦500,000',
        isPublished: true,
      },
      portfolio: [
        { url: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg', caption: 'Wedding shoot', priceRange: '200k-300k', sortOrder: 0 },
        { url: 'https://res.cloudinary.com/demo/image/upload/v2/sample.jpg', caption: 'Corporate event', priceRange: '150k-250k', sortOrder: 1 },
      ],
    },
    {
      email: 'fatima.catering@example.com',
      password: 'password123',
      firstName: 'Fatima',
      lastName: 'Abubakar',
      role: 'VENDOR',
      profile: {
        businessName: "Fatima's Catering",
        category: 'Caterer',
        description: 'Over 10 years of experience in catering for weddings, corporate events, and private parties.',
        location: 'Kano, Nigeria',
        priceRange: '₦200,000 - ₦1,000,000',
        isPublished: true,
      },
      portfolio: [
        { url: 'https://res.cloudinary.com/demo/image/upload/v3/sample.jpg', caption: 'Buffet setup', priceRange: '500k-1M', sortOrder: 0 },
      ],
    },
    {
      email: 'chidi.events@example.com',
      password: 'password123',
      firstName: 'Chidi',
      lastName: 'Okonkwo',
      role: 'VENDOR',
      profile: {
        businessName: 'Chidi Events & Decor',
        category: 'Decorator',
        description: 'Specializing in wedding decorations, corporate events, and party setups.',
        location: 'Abuja, Nigeria',
        priceRange: '₦100,000 - ₦400,000',
        isPublished: true,
      },
      portfolio: [
        { url: 'https://res.cloudinary.com/demo/image/upload/v4/sample.jpg', caption: 'Wedding decor', priceRange: '200k-400k', sortOrder: 0 },
      ],
    },
  ];

  const planners = [
    {
      email: 'amaka.planner@example.com',
      password: 'password123',
      firstName: 'Amaka',
      lastName: 'Nwosu',
      role: 'PLANNER',
    },
    {
      email: 'david.hr@example.com',
      password: 'password123',
      firstName: 'David',
      lastName: 'Johnson',
      role: 'PLANNER',
    },
  ];

  for (const vendor of vendors) {
    const hashedPassword = await bcrypt.hash(vendor.password, 10);

    const user = await prisma.user.upsert({
      where: { email: vendor.email },
      update: {},
      create: {
        email: vendor.email,
        password: hashedPassword,
        firstName: vendor.firstName,
        lastName: vendor.lastName,
        role: vendor.role,
        isVerified: true,
      },
    });

    const profile = await prisma.vendorProfile.upsert({
      where: { userId: user.id },
      update: vendor.profile,
      create: {
        userId: user.id,
        ...vendor.profile,
      },
    });

    for (const item of vendor.portfolio) {
      await prisma.portfolioItem.upsert({
        where: { id: `${profile.id}-${item.sortOrder}` },
        update: item,
        create: {
          id: `${profile.id}-${item.sortOrder}`,
          vendorProfileId: profile.id,
          ...item,
        },
      });
    }

    console.log(`✅ Seeded vendor: ${vendor.email}`);
  }

  for (const planner of planners) {
    const hashedPassword = await bcrypt.hash(planner.password, 10);

    const user = await prisma.user.upsert({
      where: { email: planner.email },
      update: {},
      create: {
        email: planner.email,
        password: hashedPassword,
        firstName: planner.firstName,
        lastName: planner.lastName,
        role: planner.role,
        isVerified: true,
      },
    });

    await prisma.plannerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    console.log(`✅ Seeded planner: ${planner.email}`);
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
