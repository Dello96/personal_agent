const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth"); // 추가

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate);

// 업무 목록 조회
router.get("/", async (req, res) => {
  try {
    const { userId, role, teamName } = req.user;
    if (role === "TEAM_LEAD" || role === "MANAGER" || role === "DIRECTOR") {
      if (!teamName) {
        return res.status(400).json({
          error: "팀에 속해있지 않습니다. 먼저 팀에 가입해주세요.",
        });
      }
      where = { teamName };
    } else {
      where = { assigneeId: userId };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        assigner: {
          select: { id: true, name: true, email: true },
        },
        team: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(tasks);
  } catch (error) {
    console.error("업무 목록 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 업무 생성
router.post("/", async (req, res) => {
  try {
    const { title, description, assigneeId, priority, dueDate } = req.body;
    const { userId, teamName } = req.user;

    if (!teamName) {
      return res.status(400).json({
        error: "팀에 속해있지 않습니다. 먼저 팀에 가입해주세요.",
      });
    }
    const task = await prisma.task.create({
      data: {
        title,
        description,
        assigneeId,
        assignerId: userId,
        teamId: teamName,
        priority: priority || "MEDIUM",
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        assignee: true,
        assigner: true,
      },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error("업무 생성 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

module.exports = router;
