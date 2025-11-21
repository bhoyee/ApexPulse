require("dotenv").config({ path: ".env" });
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "founder@apexpulse.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "apexpulse123!";
  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Apex Founder",
      passwordHash: hashed,
      role: "admin",
      apiSetting: {
        create: {}
      }
    }
  });

  await prisma.holding.createMany({
    data: [
      {
        userId: user.id,
        asset: "BTC",
        amount: 0.42,
        avgBuyPrice: 52000,
        tags: ["core"]
      },
      {
        userId: user.id,
        asset: "ETH",
        amount: 6.5,
        avgBuyPrice: 2900,
        tags: ["defi", "long"]
      },
      {
        userId: user.id,
        asset: "SOL",
        amount: 120,
        avgBuyPrice: 160,
        tags: ["momentum"]
      }
    ]
  });

  console.log(`Seeded ApexPulse admin: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
