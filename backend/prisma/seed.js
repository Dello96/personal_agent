// 앱과 동일한 Prisma 인스턴스 사용 (Prisma 7 + @prisma/adapter-pg).
// seed만 new PrismaClient() 하면 어댑터 없이 생성되어 __internal 등 런타임 오류가 날 수 있음.
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "../../.env.local"),
});

const prisma = require("../db/prisma");

async function main() {
  const teams = ["개발팀", "기획팀", "디자인팀"];

  for (const teamName of teams) {
    await prisma.team.upsert({
      where: { teamName },
      update: {},
      create: { teamName },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
