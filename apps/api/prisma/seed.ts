import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create users
  const adminPassword = await argon2.hash('Admin@123');
  const salesPassword = await argon2.hash('Sales@123');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fundroom.com' },
    update: {},
    create: {
      email: 'admin@fundroom.com',
      password: adminPassword,
      name: 'Admin User',
      role: UserRole.ADMIN,
    },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@fundroom.com' },
    update: {},
    create: {
      email: 'sales@fundroom.com',
      password: salesPassword,
      name: 'Sales User',
      role: UserRole.SALES_USER,
    },
  });

  console.log('Created users:', { admin: admin.email, sales: salesUser.email });

  // Create products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'IND-001' },
      update: {},
      create: {
        sku: 'IND-001',
        name: 'Industrial Motor 5HP',
        description: 'Heavy duty industrial motor for manufacturing',
        category: 'Motors',
        unit: 'PCS',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'IND-002' },
      update: {},
      create: {
        sku: 'IND-002',
        name: 'Gear Box Assembly',
        description: 'Precision gear box for industrial machinery',
        category: 'Transmission',
        unit: 'PCS',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'IND-003' },
      update: {},
      create: {
        sku: 'IND-003',
        name: 'Stainless Steel Pipe 4inch',
        description: 'SS304 seamless pipe for industrial use',
        category: 'Piping',
        unit: 'MTR',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'IND-004' },
      update: {},
      create: {
        sku: 'IND-004',
        name: 'Hydraulic Cylinder',
        description: 'Double acting hydraulic cylinder 100mm bore',
        category: 'Hydraulics',
        unit: 'PCS',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'IND-005' },
      update: {},
      create: {
        sku: 'IND-005',
        name: 'Conveyor Belt 500mm',
        description: 'Heavy duty rubber conveyor belt',
        category: 'Material Handling',
        unit: 'MTR',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'IND-006' },
      update: {},
      create: {
        sku: 'IND-006',
        name: 'Bearing SKF 6205',
        description: 'Deep groove ball bearing',
        category: 'Bearings',
        unit: 'PCS',
      },
    }),
  ]);

  console.log(`Created ${products.length} products`);

  // Create inventory for products
  for (const product of products) {
    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {},
      create: {
        productId: product.id,
        physicalQuantity: Math.floor(Math.random() * 200) + 50,
        reservedQuantity: 0,
      },
    });
  }

  console.log('Created inventory records');

  // Create customers
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { email: 'info@steelcorp.com' },
      update: {},
      create: {
        name: 'Steel Corp Industries',
        email: 'info@steelcorp.com',
        phone: '+91-9876543210',
        address: 'Industrial Area, Phase 2',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        gstNumber: '27AABCS1234A1Z5',
        contactPerson: 'Rajesh Kumar',
      },
    }),
    prisma.customer.upsert({
      where: { email: 'purchase@textilehub.in' },
      update: {},
      create: {
        name: 'Textile Hub Pvt Ltd',
        email: 'purchase@textilehub.in',
        phone: '+91-9876543211',
        address: 'Textile Park, MIDC',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395003',
        gstNumber: '24AABCT5678B1Z2',
        contactPerson: 'Priya Sharma',
      },
    }),
    prisma.customer.upsert({
      where: { email: 'orders@automotivetech.com' },
      update: {},
      create: {
        name: 'Automotive Tech Solutions',
        email: 'orders@automotivetech.com',
        phone: '+91-9876543212',
        address: 'Auto Nagar, Phase 1',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600001',
        gstNumber: '33AABCA9012C1Z8',
        contactPerson: 'Suresh Venkat',
      },
    }),
  ]);

  console.log(`Created ${customers.length} customers`);

  // Create sample enquiry
  const enquiry = await prisma.enquiry.upsert({
    where: { enquiryNumber: 'ENQ-2026-000001' },
    update: {},
    create: {
      enquiryNumber: 'ENQ-2026-000001',
      customerId: customers[0].id,
      notes: 'Urgent requirement for new production line',
      createdBy: salesUser.id,
      items: {
        create: [
          { productId: products[0].id, quantity: 5 },
          { productId: products[1].id, quantity: 3 },
        ],
      },
    },
  });

  console.log('Created sample enquiry');

  // Create sample quotation
  await prisma.quotation.upsert({
    where: { quotationNumber: 'QUO-2026-000001' },
    update: {},
    create: {
      quotationNumber: 'QUO-2026-000001',
      enquiryId: enquiry.id,
      customerId: customers[0].id,
      status: 'SENT',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      terms: 'Payment within 30 days of delivery',
      createdBy: salesUser.id,
      subtotal: 525000,
      totalDiscount: 26250,
      totalGst: 89850,
      grandTotal: 588600,
      items: {
        create: [
          {
            productId: products[0].id,
            quantity: 5,
            unitPrice: 75000,
            discountPercent: 5,
            gstPercent: 18,
            baseAmount: 375000,
            discountAmount: 18750,
            taxableAmount: 356250,
            gstAmount: 64125,
            lineTotal: 420375,
          },
          {
            productId: products[1].id,
            quantity: 3,
            unitPrice: 50000,
            discountPercent: 5,
            gstPercent: 18,
            baseAmount: 150000,
            discountAmount: 7500,
            taxableAmount: 142500,
            gstAmount: 25650,
            lineTotal: 168150,
          },
        ],
      },
    },
  });

  console.log('Created sample quotation');

  console.log('\n=== Seed completed successfully ===');
  console.log('\nTest Credentials:');
  console.log('Admin: admin@fundroom.com / Admin@123');
  console.log('Sales: sales@fundroom.com / Sales@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
