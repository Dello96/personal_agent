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
    let where = {};

    if (role === "TEAM_LEAD" || role === "MANAGER" || role === "DIRECTOR") {
      where = { teamId: teamName };
    } else {
      // ✅ 일반 팀원: 담당자이거나 참여자인 업무 모두 조회
      where = {
        OR: [
          { assigneeId: userId },
          { participants: { some: { userId: userId } } },
        ],
      };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        assigner: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, teamName: true } },
        // ✅ 참여자 정보 포함
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
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

// 단일 업무 조회
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        assigner: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, teamName: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: "업무를 찾을 수 없습니다." });
    }

    res.json(task);
  } catch (error) {
    console.error("업무 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 업무 생성
router.post("/", async (req, res) => {
  try {
    const {
      title,
      description,
      assigneeId,
      priority,
      dueDate,
      participantIds,
      referenceImageUrls,
    } = req.body;
    const { userId, teamName } = req.user;

    // 트랜잭션으로 업무 + 참여자 함께 생성
    const result = await prisma.$transaction(async (tx) => {
      // 1. 업무 생성
      const task = await tx.task.create({
        data: {
          title,
          description,
          assigneeId,
          assignerId: userId,
          teamId: teamName,
          priority: priority || "MEDIUM",
          dueDate: dueDate ? new Date(dueDate) : null,
          status: "IN_PROGRESS",
          referenceImageUrls: referenceImageUrls || [],
        },
      });

      // 2. 주담당자를 참여자로 추가 (OWNER 역할)
      await tx.taskParticipant.create({
        data: {
          taskId: task.id,
          userId: assigneeId,
          role: "OWNER",
        },
      });

      // 3. 추가 참여자들 생성 (PARTICIPANT 역할)
      if (participantIds && participantIds.length > 0) {
        const participantData = participantIds
          .filter((id) => id !== assigneeId) // 주담당자 제외
          .map((userId) => ({
            taskId: task.id,
            userId,
            role: "PARTICIPANT",
          }));

        await tx.taskParticipant.createMany({
          data: participantData,
        });
      }

      // 4. 참여자 정보 포함하여 반환
      return tx.task.findUnique({
        where: { id: task.id },
        include: {
          assignee: true,
          assigner: true,
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("업무 생성 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

router.put("/:id/status", async (req, res) => {});

module.exports = router;
