import { PrismaClient, Role, Branch, RoomTypeEnum, BookingStatus, MealPlan } from '@prisma/client';
// @ts-ignore
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const salt = await bcrypt.genSalt(10);
  const ownerPassword = await bcrypt.hash('owner123', salt);
  const managerPassword = await bcrypt.hash('manager123', salt);
  const viewerPassword = await bcrypt.hash('viewer123', salt);

  // Clear existing data
  console.log('🧹 Clearing existing data...');
  
  // Delete in correct order (child tables first)
  try { await prisma.feedback.deleteMany({}); } catch (e) { /* table might not exist yet */ }
  try { await prisma.pricingHistory.deleteMany({}); } catch (e) { /* table might not exist yet */ }
  try { await prisma.roomPricing.deleteMany({}); } catch (e) { /* table might not exist yet */ }
  try { await prisma.roomTypeModel.deleteMany({}); } catch (e) { /* table might not exist yet */ }
  try { await prisma.booking.deleteMany({}); } catch (e) { /* table might not exist yet */ }
  try { await prisma.userBranch.deleteMany({}); } catch (e) { /* table might not exist yet */ }
  try { await prisma.user.deleteMany({}); } catch (e) { /* table might not exist yet */ }
  try { await prisma.branchCapacity.deleteMany({}); } catch (e) { /* table might not exist yet */ }
  try { await prisma.seasonalPricingRule.deleteMany({}); } catch (e) { /* table might not exist yet */ }
  try { await prisma.roomTypeCapacity.deleteMany({}); } catch (e) { /* table might not exist yet */ }
  try { await prisma.auditLog.deleteMany({}); } catch (e) { /* table might not exist yet */ }

  console.log('✅ Database cleared');

  // ==================== CREATE USERS ====================
  console.log('👤 Creating users...');

  const users = [
    {
      username: 'owner',
      password: ownerPassword,
      role: Role.OWNER,
      canViewAllBranches: true,
      canCreateBookings: false,
    },
    {
      username: 'manager',
      password: managerPassword,
      role: Role.MANAGER,
      canViewAllBranches: false,
      canCreateBookings: true,
    },
    {
      username: 'manager2',
      password: managerPassword,
      role: Role.MANAGER,
      canViewAllBranches: false,
      canCreateBookings: true,
    },
    {
      username: 'manager3',
      password: managerPassword,
      role: Role.MANAGER,
      canViewAllBranches: false,
      canCreateBookings: true,
    },
    {
      username: 'manager4',
      password: managerPassword,
      role: Role.MANAGER,
      canViewAllBranches: false,
      canCreateBookings: true,
    },
    {
      username: 'viewer',
      password: viewerPassword,
      role: Role.VIEWER,
      canViewAllBranches: true,
      canCreateBookings: true,
    },
  ];

  const createdUsers = [];
  for (const userData of users) {
    const user = await prisma.user.create({
      data: {
        username: userData.username,
        password_hash: userData.password,
        role: userData.role,
        canViewAllBranches: userData.canViewAllBranches,
        canCreateBookings: userData.canCreateBookings,
      },
    });
    createdUsers.push(user);
    console.log(`✅ Created user: ${userData.username}`);
  }

  // ==================== CREATE USER BRANCHES ====================
  console.log('🏢 Creating user branches...');

  const branchMap = {
    'owner': [Branch.Pokhara, Branch.Kathmandu1, Branch.Kathmandu2, Branch.Bhairawaha],
    'manager': [Branch.Pokhara],
    'manager2': [Branch.Kathmandu1],
    'manager3': [Branch.Kathmandu2],
    'manager4': [Branch.Bhairawaha],
    'viewer': [Branch.Pokhara, Branch.Kathmandu1, Branch.Kathmandu2, Branch.Bhairawaha],
  };

  for (const user of createdUsers) {
    const branches = branchMap[user.username] || [Branch.Pokhara];
    for (const branch of branches) {
      await prisma.userBranch.create({
        data: {
          user_id: user.id,
          branch_name: branch,
        },
      });
    }
    console.log(`✅ Created branches for: ${user.username}`);
  }

  // ==================== CREATE ROOM TYPES ====================
  console.log('🏠 Creating room types...');

  const roomTypes = [
    { name: 'Single', description: 'Standard single room with basic amenities', maxOccupancy: 1, basePrice: 5000 },
    { name: 'Double', description: 'Standard double room with comfortable bedding', maxOccupancy: 2, basePrice: 8000 },
    { name: 'Suite', description: 'Luxury suite with premium amenities', maxOccupancy: 4, basePrice: 15000 },
    { name: 'Deluxe', description: 'Deluxe room with executive amenities', maxOccupancy: 2, basePrice: 12000 },
    { name: 'Premium', description: 'Premium room with luxury amenities', maxOccupancy: 3, basePrice: 18000 },
  ];

  const createdRoomTypes = [];
  for (const rt of roomTypes) {
    const created = await prisma.roomTypeModel.create({
      data: rt,
    });
    createdRoomTypes.push(created);
    console.log(`✅ Created room type: ${rt.name}`);
  }

  // ==================== CREATE ROOM PRICING ====================
  console.log('💰 Creating room pricing...');

  const branches = [Branch.Pokhara, Branch.Kathmandu1, Branch.Kathmandu2, Branch.Bhairawaha];
  const seasons = ['Regular', 'Peak', 'Off-Peak', 'Festival', 'Weekend'];

  for (const branch of branches) {
    for (const roomType of createdRoomTypes) {
      for (const season of seasons) {
        const multiplier = 
          season === 'Peak' ? 1.4 : 
          season === 'Festival' ? 1.6 : 
          season === 'Weekend' ? 1.2 : 
          season === 'Off-Peak' ? 0.85 : 1.0;
        const currentPrice = Math.round(roomType.basePrice * multiplier);
        
        await prisma.roomPricing.create({
          data: {
            branch: branch,
            roomType: roomType.name,
            season: season,
            basePrice: roomType.basePrice,
            currentPrice: currentPrice,
            isActive: true,
            createdBy: 'system',
            startDate: new Date(),
            endDate: season === 'Peak' ? new Date('2026-03-01') : 
                     season === 'Festival' ? new Date('2026-07-31') : null,
          },
        });
      }
    }
    console.log(`✅ Created pricing for: ${branch}`);
  }

  // ==================== CREATE SEASONAL PRICING RULES ====================
  console.log('📅 Creating seasonal pricing rules...');

  const seasonalRules = [
    { name: 'Peak Season', season: 'Peak', multiplier: 1.4, startMonth: 11, endMonth: 2, isActive: true },
    { name: 'Festival Season', season: 'Festival', multiplier: 1.6, startMonth: 6, endMonth: 7, isActive: true },
    { name: 'Weekend', season: 'Weekend', multiplier: 1.2, startMonth: 1, endMonth: 12, isActive: true },
    { name: 'Regular Season', season: 'Regular', multiplier: 1.0, startMonth: 8, endMonth: 10, isActive: true },
    { name: 'Off-Peak Season', season: 'Off-Peak', multiplier: 0.85, startMonth: 3, endMonth: 5, isActive: true },
  ];

  for (const rule of seasonalRules) {
    await prisma.seasonalPricingRule.create({
      data: rule,
    });
    console.log(`✅ Created seasonal rule: ${rule.name}`);
  }

  // ==================== CREATE BRANCH CAPACITIES ====================
  console.log('🏨 Creating branch capacities...');

  const branchCapacities = [
    { branch: Branch.Pokhara, singleCap: 20, doubleCap: 30, tripleCap: 10, quardCap: 5 },
    { branch: Branch.Kathmandu1, singleCap: 20, doubleCap: 30, tripleCap: 10, quardCap: 5 },
    { branch: Branch.Kathmandu2, singleCap: 20, doubleCap: 30, tripleCap: 10, quardCap: 5 },
    { branch: Branch.Bhairawaha, singleCap: 20, doubleCap: 30, tripleCap: 10, quardCap: 5 },
  ];

  for (const cap of branchCapacities) {
    await prisma.branchCapacity.create({
      data: cap,
    });
    console.log(`✅ Created branch capacity: ${cap.branch}`);
  }

  // ==================== CREATE ROOM TYPE CAPACITIES ====================
  console.log('📊 Creating room type capacities...');

  const roomTypeCapacities = [
    // Pokhara
    { branch: Branch.Pokhara, roomType: 'Single', totalRooms: 20, occupiedRooms: 0, availableRooms: 20 },
    { branch: Branch.Pokhara, roomType: 'Double', totalRooms: 30, occupiedRooms: 0, availableRooms: 30 },
    { branch: Branch.Pokhara, roomType: 'Suite', totalRooms: 10, occupiedRooms: 0, availableRooms: 10 },
    { branch: Branch.Pokhara, roomType: 'Deluxe', totalRooms: 15, occupiedRooms: 0, availableRooms: 15 },
    { branch: Branch.Pokhara, roomType: 'Premium', totalRooms: 5, occupiedRooms: 0, availableRooms: 5 },
    // Kathmandu1
    { branch: Branch.Kathmandu1, roomType: 'Single', totalRooms: 20, occupiedRooms: 0, availableRooms: 20 },
    { branch: Branch.Kathmandu1, roomType: 'Double', totalRooms: 30, occupiedRooms: 0, availableRooms: 30 },
    { branch: Branch.Kathmandu1, roomType: 'Suite', totalRooms: 10, occupiedRooms: 0, availableRooms: 10 },
    { branch: Branch.Kathmandu1, roomType: 'Deluxe', totalRooms: 15, occupiedRooms: 0, availableRooms: 15 },
    { branch: Branch.Kathmandu1, roomType: 'Premium', totalRooms: 5, occupiedRooms: 0, availableRooms: 5 },
    // Kathmandu2
    { branch: Branch.Kathmandu2, roomType: 'Single', totalRooms: 20, occupiedRooms: 0, availableRooms: 20 },
    { branch: Branch.Kathmandu2, roomType: 'Double', totalRooms: 30, occupiedRooms: 0, availableRooms: 30 },
    { branch: Branch.Kathmandu2, roomType: 'Suite', totalRooms: 10, occupiedRooms: 0, availableRooms: 10 },
    { branch: Branch.Kathmandu2, roomType: 'Deluxe', totalRooms: 15, occupiedRooms: 0, availableRooms: 15 },
    { branch: Branch.Kathmandu2, roomType: 'Premium', totalRooms: 5, occupiedRooms: 0, availableRooms: 5 },
    // Bhairawaha
    { branch: Branch.Bhairawaha, roomType: 'Single', totalRooms: 20, occupiedRooms: 0, availableRooms: 20 },
    { branch: Branch.Bhairawaha, roomType: 'Double', totalRooms: 30, occupiedRooms: 0, availableRooms: 30 },
    { branch: Branch.Bhairawaha, roomType: 'Suite', totalRooms: 10, occupiedRooms: 0, availableRooms: 10 },
    { branch: Branch.Bhairawaha, roomType: 'Deluxe', totalRooms: 15, occupiedRooms: 0, availableRooms: 15 },
    { branch: Branch.Bhairawaha, roomType: 'Premium', totalRooms: 5, occupiedRooms: 0, availableRooms: 5 },
  ];

  for (const cap of roomTypeCapacities) {
    await prisma.roomTypeCapacity.create({
      data: cap,
    });
  }
  console.log('✅ Created room type capacities');

  // ==================== CREATE SAMPLE BOOKINGS ====================
  console.log('📋 Creating sample bookings...');

  const sampleBookings = [
    {
      bookingNo: 'BK-2026-001',
      agentName: 'John Doe',
      agentContact: '9841234567',
      email: 'john.doe@email.com',
      roomsCount: 2,
      roomType: RoomTypeEnum.Single,
      mealPlan: MealPlan.CP,
      checkIn: new Date('2026-07-01'),
      checkOut: new Date('2026-07-05'),
      nights: 4,
      branch: Branch.Pokhara,
      bookingStatus: BookingStatus.Confirmed,
      roomCharges: 20000,
      totalCost: 20000,
      heads: 2,
      childrenCount: 0,
      extraPersonCharges: 0,
      price: 20000,
    },
    {
      bookingNo: 'BK-2026-002',
      agentName: 'Jane Smith',
      agentContact: '9847654321',
      email: 'jane.smith@email.com',
      roomsCount: 1,
      roomType: RoomTypeEnum.Double,
      mealPlan: MealPlan.MAP,
      checkIn: new Date('2026-07-02'),
      checkOut: new Date('2026-07-06'),
      nights: 4,
      branch: Branch.Kathmandu1,
      bookingStatus: BookingStatus.CheckedIn,
      roomCharges: 30000,
      totalCost: 30000,
      heads: 2,
      childrenCount: 1,
      childrenBelow10: 1,
      extraPersonCharges: 0,
      price: 30000,
    },
    {
      bookingNo: 'BK-2026-003',
      agentName: 'Bob Johnson',
      agentContact: '9849876543',
      email: 'bob.johnson@email.com',
      roomsCount: 1,
      roomType: RoomTypeEnum.Suite,
      mealPlan: MealPlan.AP,
      checkIn: new Date('2026-07-03'),
      checkOut: new Date('2026-07-07'),
      nights: 4,
      branch: Branch.Pokhara,
      bookingStatus: BookingStatus.Pending,
      roomCharges: 60000,
      totalCost: 60000,
      heads: 2,
      childrenCount: 0,
      extraPersonCharges: 0,
      price: 60000,
    },
  ];

  const createdBookings = [];
  for (const booking of sampleBookings) {
    const created = await prisma.booking.create({
      data: booking,
    });
    createdBookings.push(created);
    console.log(`✅ Created booking: ${booking.bookingNo}`);
  }

  // ==================== CREATE FEEDBACK ====================
  console.log('⭐ Creating feedback...');

  if (createdBookings.length > 0) {
    const feedbacks = [
      {
        bookingId: createdBookings[0].id,
        bookingNo: createdBookings[0].bookingNo,
        guestName: 'John Doe',
        guestEmail: 'john.doe@email.com',
        rating: 4,
        review: 'Great stay! The room was clean and comfortable.',
        stayDate: new Date('2026-07-05'),
        branch: Branch.Pokhara,
        status: 'reviewed',
      },
      {
        bookingId: createdBookings[1]?.id || createdBookings[0].id,
        bookingNo: createdBookings[1]?.bookingNo || createdBookings[0].bookingNo,
        guestName: 'Jane Smith',
        guestEmail: 'jane.smith@email.com',
        rating: 5,
        review: 'Excellent service and beautiful hotel. Highly recommended!',
        stayDate: new Date('2026-07-06'),
        branch: Branch.Kathmandu1,
        status: 'reviewed',
      },
    ];

    for (const feedback of feedbacks) {
      await prisma.feedback.create({
        data: feedback,
      });
      console.log(`✅ Created feedback for: ${feedback.guestName}`);
    }
  }

  // ==================== CREATE PRICING HISTORY ====================
  console.log('📊 Creating pricing history...');

  for (const branch of branches) {
    for (const roomType of createdRoomTypes) {
      const historyEntries = [
        {
          branch: branch,
          roomType: roomType.name,
          season: 'Regular',
          oldPrice: roomType.basePrice * 0.8,
          newPrice: roomType.basePrice,
          changedBy: 'system',
          reason: 'Initial price setup',
        },
        {
          branch: branch,
          roomType: roomType.name,
          season: 'Peak',
          oldPrice: roomType.basePrice,
          newPrice: roomType.basePrice * 1.4,
          changedBy: 'owner',
          reason: 'Peak season price adjustment',
        },
      ];

      for (const history of historyEntries) {
        await prisma.pricingHistory.create({
          data: history,
        });
      }
    }
  }
  console.log('✅ Created pricing history');

  // ==================== CREATE AUDIT LOG ====================
  console.log('📝 Creating audit logs...');

  const auditLogs = [
    {
      username: 'owner',
      branch: Branch.Pokhara,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'User logged in' },
    },
    {
      username: 'owner',
      branch: Branch.Pokhara,
      action: 'UPDATE',
      entity: 'RoomPricing',
      details: { message: 'Updated pricing for Single room' },
    },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({
      data: log,
    });
  }
  console.log('✅ Created audit logs');

  // ==================== SUMMARY ====================
  console.log('\n📊 Seeding Summary:');
  console.log(`✅ ${createdUsers.length} users created`);
  console.log(`✅ ${createdRoomTypes.length} room types created`);
  console.log(`✅ ${branches.length * createdRoomTypes.length * seasons.length} room pricing entries created`);
  console.log(`✅ ${seasonalRules.length} seasonal rules created`);
  console.log(`✅ ${branchCapacities.length} branch capacities created`);
  console.log(`✅ ${createdBookings.length} bookings created`);
  console.log('\n✅ Seeding complete!');

  console.log('\n🔑 Login Credentials:');
  console.log('  Owner:   owner / owner123 (Can view all branches)');
  console.log('  Manager: manager / manager123 (Pokhara only)');
  console.log('  Manager2: manager2 / manager123 (Kathmandu1 only)');
  console.log('  Manager3: manager3 / manager123 (Kathmandu2 only)');
  console.log('  Manager4: manager4 / manager123 (Bhairawaha only)');
  console.log('  Viewer:  viewer / viewer123 (View only)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });