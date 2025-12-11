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

    if (res.headersSent) {
      console.error("인증 미들웨어: 응답이 이미 전송되었습니다.");
      return;
    }

    res.status(401).json({ error: "인증 실패" });
  }
};

module.exports = authenticate;
