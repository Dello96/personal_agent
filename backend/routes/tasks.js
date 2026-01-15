const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth"); // 추가

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate);

// 상태 전이 검증 함수
const isValidStatusTransition = (
  currentStatus,
  newStatus,
  userRole,
  taskAssigneeId,
  userId
) => {
  // 허용된 상태 전이 정의
  const validTransitions = {
    PENDING: ["NOW", "CANCELLED"],
    NOW: ["COMPLETED", "REVIEW", "CANCELLED"],
    IN_PROGRESS: ["NOW", "COMPLETED", "CANCELLED"],
    COMPLETED: ["REVIEW", "ENDING", "CANCELLED"],
    REVIEW: ["ENDING", "NOW", "CANCELLED"], // 승인→ENDING, 반려→NOW
    CANCELLED: [], // 취소된 업무는 변경 불가
    ENDING: [], // 종료된 업무는 변경 불가
  };

  // 권한 확인: REVIEW, ENDING 상태 변경은 팀장 이상만 가능
  // 단, 담당자가 자신의 업무를 REVIEW로 변경하는 경우는 허용
  if (newStatus === "REVIEW") {
    // 담당자가 자신의 업무를 REVIEW로 변경하는 경우 → 권한 체크 건너뛰고 상태 전이 검증으로 진행
    if (taskAssigneeId && userId && taskAssigneeId === userId) {
      // 권한 체크를 건너뛰고 바로 상태 전이 검증으로 넘어감 (아무것도 return하지 않음)
    } else {
      // 담당자가 아닌 경우, 팀장 이상 권한 필요
      if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(userRole)) {
        return false;
      }
    }
  } else if (newStatus === "ENDING") {
    // ENDING은 항상 팀장 이상만 가능 (담당자 예외 없음)
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(userRole)) {
      return false;
    }
  }

  // 현재 상태에서 새 상태로의 전이가 유효한지 확인
  return validTransitions[currentStatus]?.includes(newStatus) || false;
};

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
          status: "PENDING",
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

// 업무 상태 변경
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body; // status와 comment(선택사항) 받기
    const { userId, role } = req.user;

    // 1. 업무 조회
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        assigner: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: "업무를 찾을 수 없습니다." });
    }

    // 2. 상태 전이 검증 (담당자 정보 포함)
    if (
      !isValidStatusTransition(
        task.status,
        status,
        role,
        task.assigneeId,
        userId
      )
    ) {
      return res.status(400).json({
        error: "유효하지 않은 상태 전이입니다.",
        currentStatus: task.status,
        requestedStatus: status,
      });
    }

    // 3. 권한 확인 (추가 검증)
    // 담당자가 자신의 업무를 REVIEW로 변경하는 경우는 허용
    if (status === "REVIEW") {
      // 담당자가 자신의 업무를 REVIEW로 변경하는 경우 → 허용
      if (task.assigneeId && userId && task.assigneeId !== userId) {
        // 담당자가 아닌 경우, 팀장 이상 권한 필요
        if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role)) {
          return res.status(403).json({
            error: "리뷰 권한이 없습니다.",
          });
        }
      }
    } else if (status === "ENDING") {
      // ENDING은 항상 팀장 이상만 가능
      if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role)) {
        return res.status(403).json({
          error: "종료 권한이 없습니다.",
        });
      }
    }

    // 4. 상태 변경 (트랜잭션)
    const result = await prisma.$transaction(async (tx) => {
      // 4-1. 상태 업데이트 데이터 준비
      const updateData = {
        status: status,
      };

      // 4-2. COMPLETED일 때 completedAt 설정
      if (status === "COMPLETED" && !task.completedAt) {
        updateData.completedAt = new Date();
      }

      // 4-3. Task 상태 업데이트
      const updatedTask = await tx.task.update({
        where: { id },
        data: updateData,
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

      // 4-4. 상태 이력 저장 (TaskStatusHistory)
      await tx.taskStatusHistory.create({
        data: {
          taskId: id,
          status: status,
          changedBy: userId,
          comment: comment || null, // 리뷰 반려 시 코멘트 저장
        },
      });

      return updatedTask;
    });

    // 5. 성공 응답
    res.json(result);
  } catch (error) {
    console.error("상태 변경 오류:", error);
    res.status(500).json({
      error: "서버 오류",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.put("/:id/status", async (req, res) => {});

module.exports = router;
