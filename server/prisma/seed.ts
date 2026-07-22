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
  
  // ✅ Clear meal plan tables
  try { await prisma.mealPlanHistory.deleteMany({}); } catch (e) { }
  try { await prisma.mealPlanPricing.deleteMany({}); } catch (e) { }

  console.log('✅ Database cleared');

  // ==================== CREATE USERS ====================
  console.log('👤 Creating users...');

  const users = [
    { username: 'owner', password: ownerPassword, role: Role.OWNER, canViewAllBranches: true, canCreateBookings: true },
    { username: 'manager1', password: managerPassword, role: Role.MANAGER, canViewAllBranches: false, canCreateBookings: true },
    { username: 'manager2', password: managerPassword, role: Role.MANAGER, canViewAllBranches: false, canCreateBookings: true },
    { username: 'manager3', password: managerPassword, role: Role.MANAGER, canViewAllBranches: false, canCreateBookings: true },
    { username: 'manager4', password: managerPassword, role: Role.MANAGER, canViewAllBranches: false, canCreateBookings: true },
    { username: 'viewer', password: viewerPassword, role: Role.VIEWER, canViewAllBranches: true, canCreateBookings: false },
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
    'manager1': [Branch.Pokhara],
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

  // ==================== 🍽️ CREATE MEAL PLAN PRICING ====================
  console.log('🍽️ Creating meal plan pricing...');

  for (const branch of branches) {
    // Create meal plan pricing with default values
    const pricing = await prisma.mealPlanPricing.upsert({
      where: { branch },
      update: {
        kitchenCharges: 0,
        diningCharges: 0,
        breakfastCharges: 0,
        updatedBy: 'system',
        updatedAt: new Date(),
      },
      create: {
        branch,
        kitchenCharges: 0,
        diningCharges: 0,
        breakfastCharges: 0,
        createdBy: 'system',
        updatedBy: 'system',
      },
    });
    console.log(`✅ Created meal plan pricing for: ${branch}`);

    // Create initial history entries for each charge type
    const historyTypes = [
      { type: 'Kitchen Charges', value: 0 },
      { type: 'Dining Charges', value: 0 },
      { type: 'Breakfast Charges', value: 0 },
    ];

    for (const historyType of historyTypes) {
      await prisma.mealPlanHistory.create({
        data: {
          branch,
          type: historyType.type,
          oldValue: 0,
          newValue: historyType.value,
          changedBy: 'system',
          reason: 'Initial setup',
          pricingId: pricing.id,
        },
      });
    }
    console.log(`✅ Created meal plan history for: ${branch}`);
  }

  // ==================== CREATE COMPREHENSIVE AUDIT LOGS ====================
  console.log('📝 Creating comprehensive audit logs...');

  const now = new Date();
  
  // Helper to create time offsets
  const timeOffset = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

  // IP addresses for different users
  const ips = {
    owner: '192.168.1.100',
    manager1: '192.168.1.101',
    manager2: '192.168.1.102',
    manager3: '192.168.1.103',
    manager4: '192.168.1.104',
    viewer: '192.168.1.105',
  };

  const userAgents = {
    owner: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    manager1: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    manager2: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0.0.0',
    manager3: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    manager4: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) Chrome/120.0.0.0',
    viewer: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/120.0',
  };

  const auditLogs = [];

  // ==================== OWNER LOGS (All Branches) ====================
  console.log('  👑 Creating Owner audit logs...');
  
  // Owner LOGIN to all branches (multiple sessions)
  auditLogs.push(
    {
      username: 'owner',
      branch: Branch.Pokhara,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Owner logged in to Pokhara branch', sessionId: 'sess-001' },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(120),
    },
    {
      username: 'owner',
      branch: Branch.Kathmandu1,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Owner logged in to Kathmandu1 branch', sessionId: 'sess-002' },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(115),
    },
    {
      username: 'owner',
      branch: Branch.Kathmandu2,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Owner logged in to Kathmandu2 branch', sessionId: 'sess-003' },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(110),
    },
    {
      username: 'owner',
      branch: Branch.Bhairawaha,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Owner logged in to Bhairawaha branch', sessionId: 'sess-004' },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(105),
    }
  );

  // Owner CREATE operations (all branches)
  auditLogs.push(
    {
      username: 'owner',
      branch: Branch.Pokhara,
      action: 'CREATE',
      entity: 'Booking',
      details: { message: 'Created booking BKG-1001 for John Doe', bookingId: 'BKG-1001', customerName: 'John Doe' },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(90),
    },
    {
      username: 'owner',
      branch: Branch.Kathmandu1,
      action: 'CREATE',
      entity: 'Booking',
      details: { message: 'Created booking BKG-1002 for Jane Smith', bookingId: 'BKG-1002', customerName: 'Jane Smith' },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(85),
    },
    {
      username: 'owner',
      branch: Branch.Kathmandu2,
      action: 'CREATE',
      entity: 'RoomType',
      details: { message: 'Created new Deluxe Suite room type', roomType: 'Deluxe Suite', capacity: 4 },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(80),
    },
    {
      username: 'owner',
      branch: Branch.Bhairawaha,
      action: 'CREATE',
      entity: 'Booking',
      details: { message: 'Created booking BKG-1003 for Robert Johnson', bookingId: 'BKG-1003', customerName: 'Robert Johnson' },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(75),
    }
  );

  // Owner UPDATE operations (all branches)
  auditLogs.push(
    {
      username: 'owner',
      branch: Branch.Pokhara,
      action: 'UPDATE',
      entity: 'RoomPricing',
      details: { message: 'Updated Single room price from Rs. 2000 to Rs. 2200', oldPrice: 2000, newPrice: 2200 },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(70),
    },
    {
      username: 'owner',
      branch: Branch.Kathmandu1,
      action: 'UPDATE',
      entity: 'RoomPricing',
      details: { message: 'Updated Double room price from Rs. 3000 to Rs. 3200', oldPrice: 3000, newPrice: 3200 },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(65),
    },
    {
      username: 'owner',
      branch: Branch.Kathmandu2,
      action: 'UPDATE',
      entity: 'Booking',
      details: { message: 'Updated booking BKG-1002 status from Pending to Confirmed', bookingId: 'BKG-1002', oldStatus: 'Pending', newStatus: 'Confirmed' },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(60),
    },
    {
      username: 'owner',
      branch: Branch.Bhairawaha,
      action: 'UPDATE',
      entity: 'RoomPricing',
      details: { message: 'Updated Suite price from Rs. 8000 to Rs. 8500', oldPrice: 8000, newPrice: 8500 },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(55),
    }
  );

  // Owner DELETE operations (all branches)
  auditLogs.push(
    {
      username: 'owner',
      branch: Branch.Pokhara,
      action: 'DELETE',
      entity: 'Booking',
      details: { message: 'Cancelled booking BKG-1001', bookingId: 'BKG-1001', reason: 'Customer requested cancellation' },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(50),
    },
    {
      username: 'owner',
      branch: Branch.Kathmandu1,
      action: 'DELETE',
      entity: 'RoomType',
      details: { message: 'Removed outdated Standard Single room type', roomType: 'Standard Single' },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(45),
    },
    {
      username: 'owner',
      branch: Branch.Kathmandu2,
      action: 'DELETE',
      entity: 'Booking',
      details: { message: 'Cancelled booking BKG-1003', bookingId: 'BKG-1003', reason: 'No show' },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(40),
    }
  );

  // Owner CAPACITY UPDATE operations
  auditLogs.push(
    {
      username: 'owner',
      branch: Branch.Pokhara,
      action: 'UPDATE',
      entity: 'BranchCapacity',
      details: { message: 'Increased Single room capacity from 10 to 12', roomType: 'Single', oldCapacity: 10, newCapacity: 12 },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(35),
    },
    {
      username: 'owner',
      branch: Branch.Kathmandu1,
      action: 'UPDATE',
      entity: 'BranchCapacity',
      details: { message: 'Increased Double room capacity from 15 to 18', roomType: 'Double', oldCapacity: 15, newCapacity: 18 },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(30),
    },
    {
      username: 'owner',
      branch: Branch.Kathmandu2,
      action: 'UPDATE',
      entity: 'BranchCapacity',
      details: { message: 'Increased Suite room capacity from 4 to 6', roomType: 'Suite', oldCapacity: 4, newCapacity: 6 },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(25),
    },
    {
      username: 'owner',
      branch: Branch.Bhairawaha,
      action: 'UPDATE',
      entity: 'BranchCapacity',
      details: { message: 'Increased Triple room capacity from 8 to 10', roomType: 'Triple', oldCapacity: 8, newCapacity: 10 },
      ip: ips.owner,
      userAgent: userAgents.owner,
      createdAt: timeOffset(20),
    }
  );

  // ==================== MANAGER LOGS (Their respective branches only) ====================
  console.log('  🏢 Creating Manager audit logs...');

  // Manager1 - Pokhara
  auditLogs.push(
    {
      username: 'manager1',
      branch: Branch.Pokhara,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Manager1 logged in to Pokhara branch', sessionId: 'sess-101' },
      ip: ips.manager1,
      userAgent: userAgents.manager1,
      createdAt: timeOffset(95),
    },
    {
      username: 'manager1',
      branch: Branch.Pokhara,
      action: 'CHECK_IN',
      entity: 'Booking',
      details: { message: 'Checked in guest Sarah Wilson (BKG-1005)', bookingId: 'BKG-1005', guestName: 'Sarah Wilson' },
      ip: ips.manager1,
      userAgent: userAgents.manager1,
      createdAt: timeOffset(88),
    },
    {
      username: 'manager1',
      branch: Branch.Pokhara,
      action: 'CREATE',
      entity: 'Booking',
      details: { message: 'Created booking BKG-1006 for Michael Brown', bookingId: 'BKG-1006', customerName: 'Michael Brown' },
      ip: ips.manager1,
      userAgent: userAgents.manager1,
      createdAt: timeOffset(78),
    },
    {
      username: 'manager1',
      branch: Branch.Pokhara,
      action: 'UPDATE',
      entity: 'Booking',
      details: { message: 'Updated booking BKG-1006 from Pending to Confirmed', bookingId: 'BKG-1006', oldStatus: 'Pending', newStatus: 'Confirmed' },
      ip: ips.manager1,
      userAgent: userAgents.manager1,
      createdAt: timeOffset(72),
    },
    {
      username: 'manager1',
      branch: Branch.Pokhara,
      action: 'CHECK_OUT',
      entity: 'Booking',
      details: { message: 'Checked out guest Sarah Wilson (BKG-1005)', bookingId: 'BKG-1005', guestName: 'Sarah Wilson' },
      ip: ips.manager1,
      userAgent: userAgents.manager1,
      createdAt: timeOffset(62),
    }
  );

  // Manager2 - Kathmandu1
  auditLogs.push(
    {
      username: 'manager2',
      branch: Branch.Kathmandu1,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Manager2 logged in to Kathmandu1 branch', sessionId: 'sess-102' },
      ip: ips.manager2,
      userAgent: userAgents.manager2,
      createdAt: timeOffset(92),
    },
    {
      username: 'manager2',
      branch: Branch.Kathmandu1,
      action: 'CREATE',
      entity: 'Booking',
      details: { message: 'Created booking BKG-1007 for Emma Davis', bookingId: 'BKG-1007', customerName: 'Emma Davis' },
      ip: ips.manager2,
      userAgent: userAgents.manager2,
      createdAt: timeOffset(82),
    },
    {
      username: 'manager2',
      branch: Branch.Kathmandu1,
      action: 'CHECK_IN',
      entity: 'Booking',
      details: { message: 'Checked in guest Emma Davis (BKG-1007)', bookingId: 'BKG-1007', guestName: 'Emma Davis' },
      ip: ips.manager2,
      userAgent: userAgents.manager2,
      createdAt: timeOffset(68),
    },
    {
      username: 'manager2',
      branch: Branch.Kathmandu1,
      action: 'UPDATE',
      entity: 'Booking',
      details: { message: 'Updated booking BKG-1007 with special requests', bookingId: 'BKG-1007', specialRequests: 'Extra pillows, late checkout' },
      ip: ips.manager2,
      userAgent: userAgents.manager2,
      createdAt: timeOffset(58),
    }
  );

  // Manager3 - Kathmandu2
  auditLogs.push(
    {
      username: 'manager3',
      branch: Branch.Kathmandu2,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Manager3 logged in to Kathmandu2 branch', sessionId: 'sess-103' },
      ip: ips.manager3,
      userAgent: userAgents.manager3,
      createdAt: timeOffset(89),
    },
    {
      username: 'manager3',
      branch: Branch.Kathmandu2,
      action: 'CREATE',
      entity: 'Booking',
      details: { message: 'Created booking BKG-1008 for James Wilson', bookingId: 'BKG-1008', customerName: 'James Wilson' },
      ip: ips.manager3,
      userAgent: userAgents.manager3,
      createdAt: timeOffset(79),
    },
    {
      username: 'manager3',
      branch: Branch.Kathmandu2,
      action: 'CHECK_IN',
      entity: 'Booking',
      details: { message: 'Checked in guest James Wilson (BKG-1008)', bookingId: 'BKG-1008', guestName: 'James Wilson' },
      ip: ips.manager3,
      userAgent: userAgents.manager3,
      createdAt: timeOffset(66),
    },
    {
      username: 'manager3',
      branch: Branch.Kathmandu2,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Manager3 logged in again for evening shift', sessionId: 'sess-104' },
      ip: ips.manager3,
      userAgent: userAgents.manager3,
      createdAt: timeOffset(15),
    }
  );

  // Manager4 - Bhairawaha
  auditLogs.push(
    {
      username: 'manager4',
      branch: Branch.Bhairawaha,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Manager4 logged in to Bhairawaha branch', sessionId: 'sess-105' },
      ip: ips.manager4,
      userAgent: userAgents.manager4,
      createdAt: timeOffset(87),
    },
    {
      username: 'manager4',
      branch: Branch.Bhairawaha,
      action: 'CREATE',
      entity: 'Booking',
      details: { message: 'Created booking BKG-1009 for Lisa Anderson', bookingId: 'BKG-1009', customerName: 'Lisa Anderson' },
      ip: ips.manager4,
      userAgent: userAgents.manager4,
      createdAt: timeOffset(77),
    },
    {
      username: 'manager4',
      branch: Branch.Bhairawaha,
      action: 'UPDATE',
      entity: 'Booking',
      details: { message: 'Updated booking BKG-1009 - changed room type from Single to Double', bookingId: 'BKG-1009', oldRoomType: 'Single', newRoomType: 'Double' },
      ip: ips.manager4,
      userAgent: userAgents.manager4,
      createdAt: timeOffset(67),
    },
    {
      username: 'manager4',
      branch: Branch.Bhairawaha,
      action: 'CHECK_IN',
      entity: 'Booking',
      details: { message: 'Checked in guest Lisa Anderson (BKG-1009)', bookingId: 'BKG-1009', guestName: 'Lisa Anderson' },
      ip: ips.manager4,
      userAgent: userAgents.manager4,
      createdAt: timeOffset(57),
    }
  );

  // ==================== VIEWER LOGS (View only - No CHECK_IN/CHECK_OUT) ====================
  console.log('  👀 Creating Viewer audit logs...');

  // Viewer can log in to all branches
  auditLogs.push(
    {
      username: 'viewer',
      branch: Branch.Pokhara,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Viewer logged in to Pokhara branch', sessionId: 'sess-201' },
      ip: ips.viewer,
      userAgent: userAgents.viewer,
      createdAt: timeOffset(100),
    },
    {
      username: 'viewer',
      branch: Branch.Kathmandu1,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Viewer logged in to Kathmandu1 branch', sessionId: 'sess-202' },
      ip: ips.viewer,
      userAgent: userAgents.viewer,
      createdAt: timeOffset(96),
    },
    {
      username: 'viewer',
      branch: Branch.Kathmandu2,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Viewer logged in to Kathmandu2 branch', sessionId: 'sess-203' },
      ip: ips.viewer,
      userAgent: userAgents.viewer,
      createdAt: timeOffset(92),
    },
    {
      username: 'viewer',
      branch: Branch.Bhairawaha,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Viewer logged in to Bhairawaha branch', sessionId: 'sess-204' },
      ip: ips.viewer,
      userAgent: userAgents.viewer,
      createdAt: timeOffset(88),
    }
  );

  // Viewer VIEW operations (all branches)
  auditLogs.push(
    {
      username: 'viewer',
      branch: Branch.Pokhara,
      action: 'VIEW',
      entity: 'Booking',
      details: { message: 'Viewed booking list for Pokhara branch', filter: 'last 7 days' },
      ip: ips.viewer,
      userAgent: userAgents.viewer,
      createdAt: timeOffset(80),
    },
    {
      username: 'viewer',
      branch: Branch.Kathmandu1,
      action: 'VIEW',
      entity: 'Booking',
      details: { message: 'Viewed booking BKG-1002 details', bookingId: 'BKG-1002' },
      ip: ips.viewer,
      userAgent: userAgents.viewer,
      createdAt: timeOffset(75),
    },
    {
      username: 'viewer',
      branch: Branch.Kathmandu2,
      action: 'VIEW',
      entity: 'RoomPricing',
      details: { message: 'Viewed pricing for all room types', branch: 'Kathmandu2' },
      ip: ips.viewer,
      userAgent: userAgents.viewer,
      createdAt: timeOffset(70),
    },
    {
      username: 'viewer',
      branch: Branch.Pokhara,
      action: 'VIEW',
      entity: 'AuditLog',
      details: { message: 'Viewed audit logs', filter: 'last 24 hours' },
      ip: ips.viewer,
      userAgent: userAgents.viewer,
      createdAt: timeOffset(65),
    },
    {
      username: 'viewer',
      branch: Branch.Bhairawaha,
      action: 'VIEW',
      entity: 'Booking',
      details: { message: 'Viewed booking BKG-1009 details', bookingId: 'BKG-1009' },
      ip: ips.viewer,
      userAgent: userAgents.viewer,
      createdAt: timeOffset(60),
    },
    {
      username: 'viewer',
      branch: Branch.Kathmandu1,
      action: 'VIEW',
      entity: 'RoomPricing',
      details: { message: 'Viewed room availability for next 30 days' },
      ip: ips.viewer,
      userAgent: userAgents.viewer,
      createdAt: timeOffset(55),
    },
    {
      username: 'viewer',
      branch: Branch.Pokhara,
      action: 'VIEW',
      entity: 'AuditLog',
      details: { message: 'Viewed audit log summary', summaryType: 'daily' },
      ip: ips.viewer,
      userAgent: userAgents.viewer,
      createdAt: timeOffset(50),
    },
    {
      username: 'viewer',
      branch: Branch.Bhairawaha,
      action: 'VIEW',
      entity: 'BranchCapacity',
      details: { message: 'Viewed branch capacity and occupancy rates' },
      ip: ips.viewer,
      userAgent: userAgents.viewer,
      createdAt: timeOffset(45),
    }
  );

  // ==================== ADDITIONAL MANAGER LOGS (Multiple sessions) ====================
  console.log('  📋 Creating additional manager activity logs...');

  // Additional Manager1 activity (Pokhara)
  auditLogs.push(
    {
      username: 'manager1',
      branch: Branch.Pokhara,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Manager1 logged in for morning shift', sessionId: 'sess-106' },
      ip: ips.manager1,
      userAgent: userAgents.manager1,
      createdAt: timeOffset(150),
    },
    {
      username: 'manager1',
      branch: Branch.Pokhara,
      action: 'VIEW',
      entity: 'Booking',
      details: { message: 'Viewed daily occupancy report' },
      ip: ips.manager1,
      userAgent: userAgents.manager1,
      createdAt: timeOffset(140),
    },
    {
      username: 'manager1',
      branch: Branch.Pokhara,
      action: 'UPDATE',
      entity: 'Booking',
      details: { message: 'Updated booking BKG-1005 with early check-in request', bookingId: 'BKG-1005' },
      ip: ips.manager1,
      userAgent: userAgents.manager1,
      createdAt: timeOffset(130),
    }
  );

  // Additional Manager2 activity (Kathmandu1)
  auditLogs.push(
    {
      username: 'manager2',
      branch: Branch.Kathmandu1,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Manager2 logged in for afternoon shift', sessionId: 'sess-107' },
      ip: ips.manager2,
      userAgent: userAgents.manager2,
      createdAt: timeOffset(145),
    },
    {
      username: 'manager2',
      branch: Branch.Kathmandu1,
      action: 'CHECK_IN',
      entity: 'Booking',
      details: { message: 'Checked in guest Thomas Moore (BKG-1010)', bookingId: 'BKG-1010', guestName: 'Thomas Moore' },
      ip: ips.manager2,
      userAgent: userAgents.manager2,
      createdAt: timeOffset(125),
    },
    {
      username: 'manager2',
      branch: Branch.Kathmandu1,
      action: 'VIEW',
      entity: 'Booking',
      details: { message: 'Viewed upcoming bookings for next 14 days' },
      ip: ips.manager2,
      userAgent: userAgents.manager2,
      createdAt: timeOffset(115),
    }
  );

  // Additional Manager3 activity (Kathmandu2)
  auditLogs.push(
    {
      username: 'manager3',
      branch: Branch.Kathmandu2,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Manager3 logged in for night shift', sessionId: 'sess-108' },
      ip: ips.manager3,
      userAgent: userAgents.manager3,
      createdAt: timeOffset(135),
    },
    {
      username: 'manager3',
      branch: Branch.Kathmandu2,
      action: 'CHECK_OUT',
      entity: 'Booking',
      details: { message: 'Checked out guest James Wilson (BKG-1008)', bookingId: 'BKG-1008', guestName: 'James Wilson' },
      ip: ips.manager3,
      userAgent: userAgents.manager3,
      createdAt: timeOffset(120),
    },
    {
      username: 'manager3',
      branch: Branch.Kathmandu2,
      action: 'CREATE',
      entity: 'Booking',
      details: { message: 'Created booking BKG-1011 for Jennifer Lee', bookingId: 'BKG-1011', customerName: 'Jennifer Lee' },
      ip: ips.manager3,
      userAgent: userAgents.manager3,
      createdAt: timeOffset(105),
    }
  );

  // Additional Manager4 activity (Bhairawaha)
  auditLogs.push(
    {
      username: 'manager4',
      branch: Branch.Bhairawaha,
      action: 'LOGIN',
      entity: 'User',
      details: { message: 'Manager4 logged in for weekend shift', sessionId: 'sess-109' },
      ip: ips.manager4,
      userAgent: userAgents.manager4,
      createdAt: timeOffset(138),
    },
    {
      username: 'manager4',
      branch: Branch.Bhairawaha,
      action: 'UPDATE',
      entity: 'Booking',
      details: { message: 'Updated booking BKG-1009 with room upgrade', bookingId: 'BKG-1009', upgrade: 'Double to Suite' },
      ip: ips.manager4,
      userAgent: userAgents.manager4,
      createdAt: timeOffset(122),
    },
    {
      username: 'manager4',
      branch: Branch.Bhairawaha,
      action: 'CHECK_OUT',
      entity: 'Booking',
      details: { message: 'Checked out guest Lisa Anderson (BKG-1009)', bookingId: 'BKG-1009', guestName: 'Lisa Anderson' },
      ip: ips.manager4,
      userAgent: userAgents.manager4,
      createdAt: timeOffset(108),
    }
  );

  // ==================== INSERT ALL AUDIT LOGS ====================
  console.log(`  📝 Inserting ${auditLogs.length} audit logs...`);
  
  for (const log of auditLogs) {
    await prisma.auditLog.create({
      data: log,
    });
  }
  console.log(`✅ Created ${auditLogs.length} audit logs`);

  // ==================== SUMMARY ====================
  console.log('\n📊 Seeding Summary:');
  console.log(`✅ ${createdUsers.length} users created`);
  console.log(`✅ ${createdRoomTypes.length} room types created`);
  console.log(`✅ ${branches.length} branch pricing entries created`);
  console.log(`✅ ${createdRooms.length} rooms created`);
  console.log(`✅ ${availabilityCount} room availability entries created`);
  console.log(`✅ ${seasonalRules.length} seasonal rules created`);
  console.log(`✅ ${branchCapacities.length} branch capacities created`);
  console.log(`✅ ${branches.length} meal plan pricing entries created`);
  console.log(`✅ ${branches.length * 3} meal plan history entries created`);
  console.log(`✅ ${auditLogs.length} audit logs created`);
  console.log('✅ 0 bookings created (sample bookings removed)');
  console.log('✅ Seeding complete!');

  console.log('\n🔑 Login Credentials:');
  console.log('  👑 Owner:    owner / owner123 (All branches - Full access)');
  console.log('  🏢 Manager1: manager1 / manager123 (Pokhara only)');
  console.log('  🏢 Manager2: manager2 / manager123 (Kathmandu1 only)');
  console.log('  🏢 Manager3: manager3 / manager123 (Kathmandu2 only)');
  console.log('  🏢 Manager4: manager4 / manager123 (Bhairawaha only)');
  console.log('  👀 Viewer:   viewer / viewer123 (All branches - View only)');

  console.log('\n🍽️ Meal Plan Pricing (Default values):');
  console.log('  - Kitchen Charges: Rs. 0 per booking');
  console.log('  - Dining Charges: Rs. 0 per booking');
  console.log('  - Breakfast Charges: Rs. 0 per person');
  console.log('  ℹ️  Update these from the Room Pricing page');

  console.log('\n📋 Audit Log Summary:');
  console.log('  👑 Owner Actions:');
  console.log('     - LOGIN: All 4 branches');
  console.log('     - CREATE: Bookings and room types (all branches)');
  console.log('     - UPDATE: Pricing, bookings, and capacities (all branches)');
  console.log('     - DELETE: Bookings and room types (all branches)');
  console.log('  🏢 Manager Actions (their assigned branches only):');
  console.log('     - LOGIN: Their assigned branch');
  console.log('     - CREATE: Bookings');
  console.log('     - UPDATE: Bookings');
  console.log('     - CHECK_IN: Guest check-ins');
  console.log('     - CHECK_OUT: Guest check-outs');
  console.log('  👀 Viewer Actions (All branches - View only):');
  console.log('     - LOGIN: All branches');
  console.log('     - VIEW: Bookings, pricing, audit logs, capacities');
  console.log('     - ❌ No CHECK_IN, CHECK_OUT, CREATE, UPDATE, or DELETE');

  console.log('\n🏨 Room Types Available:');
  console.log('  - Single (Capacity: 1) - Rs. 2,000/night');
  console.log('  - Double (Capacity: 2) - Rs. 3,000/night');
  console.log('  - Triple (Capacity: 3) - Rs. 4,500/night');
  console.log('  - Quard (Capacity: 4) - Rs. 5,500/night');
  console.log('  - Suite (Capacity: 4) - Rs. 8,000/night');

  console.log('\n✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });