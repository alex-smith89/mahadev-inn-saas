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

  // ==================== CREATE AUDIT LOGS ====================
  console.log('📝 Creating audit logs...');

  const auditLogs = [
    // Owner actions
    {
      username: 'owner',
      branch: Branch.Pokhara,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'User logged in successfully' },
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    },
    {
      username: 'owner',
      branch: Branch.Pokhara,
      action: 'UPDATE',
      entity: 'RoomPricing',
      details: { message: 'Updated Single room price to Rs. 2500' },
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1.5), // 1.5 hours ago
    },
    {
      username: 'owner',
      branch: Branch.Kathmandu1,
      action: 'CREATE',
      entity: 'Booking',
      details: { message: 'Created booking BKG-12345 for John Doe' },
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0',
      createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    },
    {
      username: 'owner',
      branch: Branch.Pokhara,
      action: 'DELETE',
      entity: 'Booking',
      details: { message: 'Cancelled booking BKG-12346' },
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0',
      createdAt: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    },
    // Manager actions
    {
      username: 'manager',
      branch: Branch.Pokhara,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'User logged in successfully' },
      ip: '192.168.1.2',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
      createdAt: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
    },
    {
      username: 'manager',
      branch: Branch.Pokhara,
      action: 'CHECK_IN',
      entity: 'Booking',
      details: { message: 'Checked in guest John Doe (BKG-12345)' },
      ip: '192.168.1.2',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
      createdAt: new Date(Date.now() - 1000 * 60 * 20), // 20 minutes ago
    },
    {
      username: 'manager',
      branch: Branch.Pokhara,
      action: 'UPDATE',
      entity: 'Booking',
      details: { message: 'Updated booking status to Confirmed' },
      ip: '192.168.1.2',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
      createdAt: new Date(Date.now() - 1000 * 60 * 10), // 10 minutes ago
    },
    // Manager2 actions
    {
      username: 'manager2',
      branch: Branch.Kathmandu1,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'User logged in successfully' },
      ip: '192.168.1.3',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/114.0.1823.51',
      createdAt: new Date(Date.now() - 1000 * 60 * 35), // 35 minutes ago
    },
    {
      username: 'manager2',
      branch: Branch.Kathmandu1,
      action: 'CHECK_OUT',
      entity: 'Booking',
      details: { message: 'Checked out guest Jane Smith (BKG-12347)' },
      ip: '192.168.1.3',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/114.0.1823.51',
      createdAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    },
    // Manager3 actions
    {
      username: 'manager3',
      branch: Branch.Kathmandu2,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'User logged in successfully' },
      ip: '192.168.1.4',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      createdAt: new Date(Date.now() - 1000 * 60 * 50), // 50 minutes ago
    },
    {
      username: 'manager3',
      branch: Branch.Kathmandu2,
      action: 'CREATE',
      entity: 'Booking',
      details: { message: 'Created booking BKG-12348 for Robert Johnson' },
      ip: '192.168.1.4',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      createdAt: new Date(Date.now() - 1000 * 60 * 25), // 25 minutes ago
    },
    // Manager4 actions
    {
      username: 'manager4',
      branch: Branch.Bhairawaha,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'User logged in successfully' },
      ip: '192.168.1.5',
      userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) Chrome/114.0.5735.196',
      createdAt: new Date(Date.now() - 1000 * 60 * 55), // 55 minutes ago
    },
    {
      username: 'manager4',
      branch: Branch.Bhairawaha,
      action: 'UPDATE',
      entity: 'RoomPricing',
      details: { message: 'Updated Suite price to Rs. 10000' },
      ip: '192.168.1.5',
      userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) Chrome/114.0.5735.196',
      createdAt: new Date(Date.now() - 1000 * 60 * 8), // 8 minutes ago
    },
    // Viewer actions
    {
      username: 'viewer',
      branch: Branch.Pokhara,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'User logged in successfully' },
      ip: '192.168.1.6',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/114.0',
      createdAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    },
    {
      username: 'viewer',
      branch: Branch.Pokhara,
      action: 'VIEW',
      entity: 'Booking',
      details: { message: 'Viewed booking list' },
      ip: '192.168.1.6',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/114.0',
      createdAt: new Date(Date.now() - 1000 * 60 * 2), // 2 minutes ago
    },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({
      data: log,
    });
  }
  console.log(`✅ Created ${auditLogs.length} audit logs`);

  // ==================== CREATE AUDIT LOG ====================
  // (Legacy - keeping for backward compatibility)
  console.log('📝 Creating additional audit logs...');

  const legacyAuditLogs = [
    { username: 'owner', branch: Branch.Pokhara, action: 'LOGIN', entity: 'User', details: { message: 'User logged in' } },
    { username: 'owner', branch: Branch.Pokhara, action: 'UPDATE', entity: 'RoomPricing', details: { message: 'Updated pricing for Single room' } },
  ];

  for (const log of legacyAuditLogs) {
    await prisma.auditLog.create({
      data: log,
    });
  }
  console.log('✅ Created legacy audit logs');

  // ==================== SUMMARY ====================
  console.log('\n📊 Seeding Summary:');
  console.log(`✅ ${createdUsers.length} users created`);
  console.log(`✅ ${createdRoomTypes.length} room types created`);
  console.log(`✅ ${branches.length} branch pricing entries created`);
  console.log(`✅ ${createdRooms.length} rooms created`);
  console.log(`✅ ${availabilityCount} room availability entries created`);
  console.log(`✅ ${seasonalRules.length} seasonal rules created`);
  console.log(`✅ ${branchCapacities.length} branch capacities created`);
  console.log(`✅ ${auditLogs.length + legacyAuditLogs.length} audit logs created`);
  console.log('✅ 0 bookings created (sample bookings removed)');
  console.log('✅ Seeding complete!');

  console.log('\n🔑 Login Credentials:');
  console.log('  Owner:   owner / owner123');
  console.log('  Manager: manager / manager123 (Pokhara only)');
  console.log('  Manager2: manager2 / manager123 (Kathmandu1 only)');
  console.log('  Manager3: manager3 / manager123 (Kathmandu2 only)');
  console.log('  Manager4: manager4 / manager123 (Bhairawaha only)');
  console.log('  Viewer:  viewer / viewer123 (View only)');

  console.log('\n🏨 Room Types Available:');
  console.log('  - Single (Capacity: 1) - Rs. 2,000/night');
  console.log('  - Double (Capacity: 2) - Rs. 3,000/night');
  console.log('  - Triple (Capacity: 3) - Rs. 4,500/night');
  console.log('  - Quard (Capacity: 4) - Rs. 5,500/night');
  console.log('  - Suite (Capacity: 4) - Rs. 8,000/night');

  console.log('\n📋 Audit Log Entries Created:');
  console.log('  - LOGIN: User login events');
  console.log('  - CREATE: New booking creation');
  console.log('  - UPDATE: Updates to bookings and pricing');
  console.log('  - DELETE: Booking cancellations');
  console.log('  - CHECK_IN: Guest check-ins');
  console.log('  - CHECK_OUT: Guest check-outs');
  console.log('  - VIEW: Viewing activities');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });