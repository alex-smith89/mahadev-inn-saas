const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Attempting to connect to database...');
    await prisma.$connect();
    console.log('✅ Database connected successfully!');
    console.log('Database URL:', process.env.DATABASE_URL);
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error message:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();