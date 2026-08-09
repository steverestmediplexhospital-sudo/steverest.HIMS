const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  try {
    const count = await prisma.user.count();
    console.log("TOTAL USERS:", count);
    const users = await prisma.user.findMany({
      select: { email: true, role: true, isActive: true }
    });
    if (count === 0) {
      console.log("❌ NO USERS - Run: node prisma/seed.js");
    } else {
      users.forEach(u => console.log(" -", u.email, "|", u.role, "| Active:", u.isActive));
    }
  } catch (e) {
    console.log("❌ DB Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
check();
