const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  try {
    const count = await prisma.user.count();
    console.log("TOTAL USERS IN DB:", count);
    
    const users = await prisma.user.findMany({
      select: { email: true, role: true, isActive: true, firstName: true, lastName: true }
    });
    
    if (users.length === 0) {
      console.log("NO USERS FOUND - Database needs seeding!");
    } else {
      console.log("\nUSERS IN DATABASE:");
      users.forEach(u => {
        console.log(`  ${u.email} | ${u.role} | Active: ${u.isActive}`);
      });
    }
  } catch (error) {
    console.log("DATABASE ERROR:", error.message);
    console.log("\nFull error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
