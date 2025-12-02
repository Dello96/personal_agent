const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");

router.use(authenticate);

// 팀 대시보드 (팀장만)
router.get("/dashboard", async (req, res) => {
  try {
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(req.user.role)) {
      return res.status(403).json({ error: "권한이 없습니다" });
    }

    // 팀 통계 조회
    const stats = await prisma.task.groupBy({
      by: ["status"],
      where: { teamId: req.user.teamId },
      _count: true,
    });

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: "서버 오류" });
  }
});

module.exports = router;
