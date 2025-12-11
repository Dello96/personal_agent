// backend/prisma/seed.js 파일 생성
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
  .catch(console.error)
  .finally(() => prisma.$disconnect());
