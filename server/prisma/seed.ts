import { PrismaClient, Role, Branch } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      username: 'owner',
      password: 'owner123',
      role: Role.Owner,
      branches: [Branch.Kathmandu1, Branch.Kathmandu2, Branch.Pokhara, Branch.Bhairawaha], // all 4
    },
    {
      username: 'manager1',
      password: 'manager123',
      role: Role.Manager,
      branches: [Branch.Kathmandu1],
    },
    {
      username: 'manager2',
      password: 'manager123',
      role: Role.Manager,
      branches: [Branch.Kathmandu2],
    },
    {
      username: 'manager3',
      password: 'manager123',
      role: Role.Manager,
      branches: [Branch.Pokhara],
    },
    {
      username: 'manager4',
      password: 'manager123',
      role: Role.Manager,
      branches: [Branch.Bhairawaha],
    },
    {
      username: 'viewer',
      password: 'viewer123',
      role: Role.Viewer,
      branches: [Branch.Kathmandu1],
    },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        password: hash,
        role: u.role,
        branches: u.branches,
      },
    });
  }

  console.log('✅ Seeded demo users with branches.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
