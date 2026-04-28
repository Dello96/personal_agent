const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const dotenv = require("dotenv");
// 프로젝트 루트 .env.local (실행 cwd와 무관하게 로드)
dotenv.config({ path: path.join(__dirname, "../../.env.local") });

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Prisma adapter 생성
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter: adapter,
  log: ["query", "info", "warn", "error"],
});

// 연결 종료 처리
process.on("beforeExit", async () => {
  await prisma.$disconnect();
  await pool.end();
});

module.exports = prisma;
