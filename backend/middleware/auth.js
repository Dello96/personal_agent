const jwt = require("jsonwebtoken");
const prisma = require("../db/prisma");

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "인증 필요" });
    }

    // JWT 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Prisma로 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true, teamName: true },
    });

    if (!user) {
      return res.status(401).json({ error: "사용자를 찾을 수 없습니다" });
    }

    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      teamName: user.teamName,
    };

    next();
  } catch (error) {
    console.error("인증 오류:", error);
    res.status(401).json({ error: "인증 실패" });
  }
  console.log("Token received:", token ? "exists" : "missing");
  console.log("Decoded userId:", decoded?.userId);
  console.log("User found:", user ? "yes" : "no");
};

module.exports = authenticate;
