// prisma/seed.ts
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
  
  try { await prisma.bookingRoom.deleteMany({}); } catch (e) { }
  try { await prisma.roomAvailability.deleteMany({}); } catch (e) { }
  try { await prisma.room.deleteMany({}); } catch (e) { }
  try { await prisma.feedback.deleteMany({}); } catch (e) { }
  try { await prisma.pricingHistory.deleteMany({}); } catch (e) { }
  try { await prisma.roomPricing.deleteMany({}); } catch (e) { }
  try { await prisma.branchRoomPricing.deleteMany({}); } catch (e) { }
  try { await prisma.roomTypeModel.deleteMany({}); } catch (e) { }
  try { await prisma.booking.deleteMany({}); } catch (e) { }
  try { await prisma.userBranch.deleteMany({}); } catch (e) { }
  try { await prisma.user.deleteMany({}); } catch (e) { }
  try { await prisma.branchCapacity.deleteMany({}); } catch (e) { }
  try { await prisma.seasonalPricingRule.deleteMany({}); } catch (e) { }
  try { await prisma.roomTypeCapacity.deleteMany({}); } catch (e) { }
  try { await prisma.auditLog.deleteMany({}); } catch (e) { }
  try { await prisma.notification.deleteMany({}); } catch (e) { }
  try { await prisma.emailLog.deleteMany({}); } catch (e) { }
  try { await prisma.automationLog.deleteMany({}); } catch (e) { }

  console.log('✅ Database cleared');

  // ==================== CREATE USERS ====================
  console.log('👤 Creating users...');

  const users = [
    { username: 'owner', password: ownerPassword, role: Role.OWNER, canViewAllBranches: true, canCreateBookings: false },
    { username: 'manager', password: managerPassword, role: Role.MANAGER, canViewAllBranches: false, canCreateBookings: true },
    { username: 'manager2', password: managerPassword, role: Role.MANAGER, canViewAllBranches: false, canCreateBookings: true },
    { username: 'manager3', password: managerPassword, role: Role.MANAGER, canViewAllBranches: false, canCreateBookings: true },
    { username: 'manager4', password: managerPassword, role: Role.MANAGER, canViewAllBranches: false, canCreateBookings: true },
    { username: 'viewer', password: viewerPassword, role: Role.VIEWER, canViewAllBranches: true, canCreateBookings: true },
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

  const branchMap: Record<string, Branch[]> = {
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
        data: { user_id: user.id, branch_name: branch },
      });
    }
    console.log(`✅ Created branches for: ${user.username}`);
  }

  // ==================== CREATE ROOM TYPES ====================
  console.log('🏠 Creating room types...');

  const roomTypes = [
    { name: 'Single', description: 'Standard single room with basic amenities', maxOccupancy: 1, basePrice: 5000 },
    { name: 'Double', description: 'Standard double room with comfortable bedding', maxOccupancy: 2, basePrice: 8000 },
    { name: 'Triple', description: 'Triple room with three separate beds', maxOccupancy: 3, basePrice: 10000 },
    { name: 'Quard', description: 'Quadruple room with four beds', maxOccupancy: 4, basePrice: 12000 },
    { name: 'Suite', description: 'Luxury suite with premium amenities', maxOccupancy: 4, basePrice: 15000 },
  ];

  const createdRoomTypes = [];
  for (const rt of roomTypes) {
    const created = await prisma.roomTypeModel.create({ data: rt });
    createdRoomTypes.push(created);
    console.log(`✅ Created room type: ${rt.name}`);
  }

  // ==================== CREATE BRANCH ROOM PRICING ====================
  console.log('💰 Creating branch room pricing...');

  const branches = [Branch.Pokhara, Branch.Kathmandu1, Branch.Kathmandu2, Branch.Bhairawaha];

  for (const branch of branches) {
    await prisma.branchRoomPricing.upsert({
      where: { branch },
      update: {},
      create: {
        branch,
        singlePrice: 2000,
        doublePrice: 3000,
        triplePrice: 4500,
        quardPrice: 5500,
        suitePrice: 8000,
        extraPersonPrice: 500,
      },
    });
    console.log(`✅ Created branch pricing for: ${branch}`);
  }

  // ==================== CREATE ROOM PRICING (Detailed) ====================
  console.log('📊 Creating detailed room pricing...');

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
    console.log(`✅ Created detailed pricing for: ${branch}`);
  }

  // ==================== CREATE ROOMS ====================
  console.log('🏨 Creating rooms...');

  const roomConfigs = [
    { type: RoomTypeEnum.Single, count: 10, capacity: 1 },
    { type: RoomTypeEnum.Double, count: 15, capacity: 2 },
    { type: RoomTypeEnum.Triple, count: 8, capacity: 3 },
    { type: RoomTypeEnum.Quard, count: 8, capacity: 4 },
    { type: RoomTypeEnum.Suite, count: 4, capacity: 4 },
  ];

  const createdRooms = [];
  let roomCounter = 1;
  
  for (const branch of branches) {
    let branchPrefix = '';
    switch(branch) {
      case Branch.Pokhara: branchPrefix = 'POK'; break;
      case Branch.Kathmandu1: branchPrefix = 'KTM1'; break;
      case Branch.Kathmandu2: branchPrefix = 'KTM2'; break;
      case Branch.Bhairawaha: branchPrefix = 'BHA'; break;
      default: branchPrefix = String(branch).substring(0, 3).toUpperCase();
    }
    
    for (const config of roomConfigs) {
      let typePrefix = '';
      switch(config.type) {
        case RoomTypeEnum.Single: typePrefix = 'SGL'; break;
        case RoomTypeEnum.Double: typePrefix = 'DBL'; break;
        case RoomTypeEnum.Triple: typePrefix = 'TPL'; break;
        case RoomTypeEnum.Quard: typePrefix = 'QRD'; break;
        case RoomTypeEnum.Suite: typePrefix = 'STE'; break;
        default: typePrefix = 'XXX'; break;
      }
      
      for (let i = 1; i <= config.count; i++) {
        const roomNumber = `${branchPrefix}-${typePrefix}-${String(roomCounter++).padStart(3, '0')}`;
        try {
          const room = await prisma.room.create({
            data: {
              roomNumber,
              branch,
              roomType: config.type,
              capacity: config.capacity,
              status: 'available',
              floor: String(Math.floor(Math.random() * 5) + 1),
              description: `${config.type} room on floor ${Math.floor(Math.random() * 5) + 1}`,
            },
          });
          createdRooms.push(room);
        } catch (error) {
          console.error(`❌ Failed to create room ${roomNumber}:`, error);
          throw error;
        }
      }
    }
    console.log(`✅ Created rooms for: ${branch}`);
  }

  console.log(`✅ Total rooms created: ${createdRooms.length}`);

  // ==================== CREATE ROOM AVAILABILITY ====================
  console.log('📅 Creating room availability...');

  const today = new Date();
  let availabilityCount = 0;
  
  for (let d = 0; d < 30; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    if (date < today) continue;
    
    for (const room of createdRooms) {
      try {
        await prisma.roomAvailability.create({
          data: { roomId: room.id, date: date, isAvailable: true },
        });
        availabilityCount++;
      } catch (error) {
        console.error(`❌ Failed to create availability for room ${room.roomNumber}:`, error);
      }
    }
  }
  console.log(`✅ Created room availability for 30 days (${availabilityCount} entries)`);

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
    await prisma.seasonalPricingRule.create({ data: rule });
    console.log(`✅ Created seasonal rule: ${rule.name}`);
  }

  // ==================== CREATE BRANCH CAPACITIES ====================
  console.log('🏨 Creating branch capacities...');

  const branchCapacities = [
    { branch: Branch.Pokhara, singleCap: 10, doubleCap: 15, tripleCap: 8, quardCap: 8, suiteCap: 4 },
    { branch: Branch.Kathmandu1, singleCap: 10, doubleCap: 15, tripleCap: 8, quardCap: 8, suiteCap: 4 },
    { branch: Branch.Kathmandu2, singleCap: 10, doubleCap: 15, tripleCap: 8, quardCap: 8, suiteCap: 4 },
    { branch: Branch.Bhairawaha, singleCap: 10, doubleCap: 15, tripleCap: 8, quardCap: 8, suiteCap: 4 },
  ];

  for (const cap of branchCapacities) {
    await prisma.branchCapacity.create({ data: cap });
    console.log(`✅ Created branch capacity: ${cap.branch}`);
  }

  // ==================== CREATE ROOM TYPE CAPACITIES ====================
  console.log('📊 Creating room type capacities...');

  const roomTypeCapacities = [];
  for (const branch of branches) {
    const caps = [
      { roomType: 'Single', totalRooms: 10 },
      { roomType: 'Double', totalRooms: 15 },
      { roomType: 'Triple', totalRooms: 8 },
      { roomType: 'Quard', totalRooms: 8 },
      { roomType: 'Suite', totalRooms: 4 },
    ];
    for (const cap of caps) {
      roomTypeCapacities.push({
        branch: branch,
        roomType: cap.roomType,
        totalRooms: cap.totalRooms,
        occupiedRooms: 0,
        availableRooms: cap.totalRooms,
      });
    }
  }

  for (const cap of roomTypeCapacities) {
    await prisma.roomTypeCapacity.create({ data: cap });
  }
  console.log('✅ Created room type capacities');

  // ==================== CREATE PRICING HISTORY ====================
  console.log('📊 Creating pricing history...');

  for (const branch of branches) {
    for (const roomType of createdRoomTypes) {
      await prisma.pricingHistory.create({
        data: {
          branch: branch,
          roomType: roomType.name,
          season: 'Regular',
          oldPrice: roomType.basePrice * 0.8,
          newPrice: roomType.basePrice,
          changedBy: 'system',
          reason: 'Initial price setup',
        },
      });
    }
  }
  console.log('✅ Created pricing history');

  // ==================== CREATE AUDIT LOG ====================
  console.log('📝 Creating audit logs...');

  const auditLogs = [
    { username: 'owner', branch: Branch.Pokhara, action: 'LOGIN', entity: 'User', details: { message: 'User logged in' } },
    { username: 'owner', branch: Branch.Pokhara, action: 'UPDATE', entity: 'RoomPricing', details: { message: 'Updated pricing for Single room' } },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({ data: log });
  }
  console.log('✅ Created audit logs');

  // ==================== CREATE SAMPLE BOOKINGS ====================
  console.log('📋 Creating sample bookings...');

  // Try to create bookings without the facility field
  try {
    await prisma.booking.create({
      data: {
        bookingNo: 'BKG-SAMPLE-001',
        agentName: 'John Doe',
        agentContact: '+977 9800000000',
        email: 'john@example.com',
        branch: Branch.Pokhara,
        roomType: RoomTypeEnum.Single,
        roomsCount: 1,
        heads: 1,
        childrenBelow10: 0,
        mealPlan: MealPlan.EP,
        checkIn: new Date(),
        checkOut: new Date(Date.now() + 24 * 60 * 60 * 1000),
        nights: 1,
        bookingStatus: BookingStatus.Confirm,
        roomCharges: 2000,
        totalCost: 2260,
        currency: 'NPR',
        roomCapacity: 1,
        totalCapacity: 1,
        createdBy: 'system',
        createdByRole: 'ADMIN',
      },
    });
    console.log('✅ Created sample booking 1');
  } catch (error) {
    console.log('⚠️ Could not create booking 1, skipping...');
  }

  try {
    await prisma.booking.create({
      data: {
        bookingNo: 'BKG-SAMPLE-002',
        agentName: 'Jane Smith',
        agentContact: '+977 9800000001',
        email: 'jane@example.com',
        branch: Branch.Pokhara,
        roomType: RoomTypeEnum.Double,
        roomsCount: 1,
        heads: 2,
        childrenBelow10: 0,
        mealPlan: MealPlan.MAP,
        checkIn: new Date(),
        checkOut: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        nights: 2,
        bookingStatus: BookingStatus.Confirm,
        roomCharges: 3000,
        totalCost: 3390,
        currency: 'NPR',
        roomCapacity: 2,
        totalCapacity: 2,
        createdBy: 'system',
        createdByRole: 'ADMIN',
      },
    });
    console.log('✅ Created sample booking 2');
  } catch (error) {
    console.log('⚠️ Could not create booking 2, skipping...');
  }

  // ==================== SUMMARY ====================
  console.log('\n📊 Seeding Summary:');
  console.log(`✅ ${createdUsers.length} users created`);
  console.log(`✅ ${createdRoomTypes.length} room types created`);
  console.log(`✅ ${branches.length} branch pricing entries created`);
  console.log(`✅ ${createdRooms.length} rooms created`);
  console.log(`✅ ${availabilityCount} room availability entries created`);
  console.log(`✅ ${seasonalRules.length} seasonal rules created`);
  console.log(`✅ ${branchCapacities.length} branch capacities created`);
  console.log('✅ Seeding complete!');

  console.log('\n🔑 Login Credentials:');
  console.log('  Owner:   owner / owner123');
  console.log('  Manager: manager / manager123 (Pokhara only)');
  console.log('  Viewer:  viewer / viewer123');

  console.log('\n🏨 Room Types Available:');
  console.log('  - Single (Capacity: 1) - Rs. 2,000/night');
  console.log('  - Double (Capacity: 2) - Rs. 3,000/night');
  console.log('  - Triple (Capacity: 3) - Rs. 4,500/night');
  console.log('  - Quard (Capacity: 4) - Rs. 5,500/night');
  console.log('  - Suite (Capacity: 4) - Rs. 8,000/night');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });