import { prisma } from '../src/config/database.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Starting seed...');

  // Create sample vendor categories
  const categories = [
    'Caterer',
    'Photographer',
    'Videographer',
    'DJ',
    'Makeup Artist',
    'Decorator',
    'Event Planner',
    'Cake Maker',
    'Drink Supplier',
    'Hall Owner'
  ];

  // Create sample vendors
  const vendors = [
    {
      email: 'tunde.photo@example.com',
      password: 'password123',
      firstName: 'Tunde',
      lastName: 'Ogunlesi',
      role: 'VENDOR',
      vendorProfile: {
        businessName: 'Tunde Photography',
        category: 'Photographer',
        description: 'Professional photographer with 8 years of experience in weddings, corporate events, and portraits.',
        location: 'Lagos, Nigeria',
        priceRange: '₦150,000 - ₦500,000',
        isPublished: true,
        portfolioImages: [
          'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
          'https://res.cloudinary.com/demo/image/upload/v2/sample.jpg'
        ]
      }
    },
    {
      email: 'fatima.catering@example.com',
      password: 'password123',
      firstName: 'Fatima',
      lastName: 'Abubakar',
      role: 'VENDOR',
      vendorProfile: {
        businessName: 'Fatima\'s Catering',
        category: 'Caterer',
        description: 'Over 10 years of experience in catering for weddings, corporate events, and private parties.',
        location: 'Kano, Nigeria',
        priceRange: '₦200,000 - ₦1,000,000',
        isPublished: true,
        portfolioImages: [
          'https://res.cloudinary.com/demo/image/upload/v3/sample.jpg'
        ]
      }
    },
    {
      email: 'chidi.events@example.com',
      password: 'password123',
      firstName: 'Chidi',
      lastName: 'Okonkwo',
      role: 'VENDOR',
      vendorProfile: {
        businessName: 'Chidi Events & Decor',
        category: 'Decorator',
        description: 'Specializing in wedding decorations, corporate events, and party setups.',
        location: 'Abuja, Nigeria',
        priceRange: '₦100,000 - ₦400,000',
        isPublished: true,
        portfolioImages: [
          'https://res.cloudinary.com/demo/image/upload/v4/sample.jpg'
        ]
      }
    }
  ];

  // Create sample planners
  const planners = [
    {
      email: 'amaka.planner@example.com',
      password: 'password123',
      firstName: 'Amaka',
      lastName: 'Nwosu',
      role: 'PLANNER'
    },
    {
      email: 'david.hr@example.com',
      password: 'password123',
      firstName: 'David',
      lastName: 'Johnson',
      role: 'PLANNER'
    }
  ];

  // Hash passwords and create users with profiles
  for (const vendor of vendors) {
    const hashedPassword = await bcrypt.hash(vendor.password, 10);
    
    const user = await prisma.user.create({
      data: {
        email: vendor.email,
        password: hashedPassword,
        firstName: vendor.firstName,
        lastName: vendor.lastName,
        role: vendor.role,
        isVerified: true
      }
    });

    await prisma.vendorProfile.create({
      data: {
        userId: user.id,
        ...vendor.vendorProfile
      }
    });

    console.log(`✅ Created vendor: ${vendor.email}`);
  }

  for (const planner of planners) {
    const hashedPassword = await bcrypt.hash(planner.password, 10);
    
    await prisma.user.create({
      data: {
        email: planner.email,
        password: hashedPassword,
        firstName: planner.firstName,
        lastName: planner.lastName,
        role: planner.role,
        isVerified: true
      }
    });

    console.log(`✅ Created planner: ${planner.email}`);
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