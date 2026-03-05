const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth"); // 추가
const { Octokit } = require("@octokit/rest");
const crypto = require("crypto");
const { getOpenAIApiKey, getOpenAIClient } = require("../lib/openaiClient");

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate);

// GitHub 레포지토리 연결 헬퍼 함수
async function connectTaskGitHubRepository(
  taskId,
  owner,
  repo,
  accessToken,
  prismaClient
) {
  // GitHub API로 레포지토리 접근 권한 확인
  const octokit = new Octokit({ auth: accessToken });
  try {
    await octokit.repos.get({ owner, repo });
  } catch (error) {
    if (error.status === 404) {
      throw new Error("레포지토리를 찾을 수 없거나 접근 권한이 없습니다.");
    }
    throw error;
  }

  // Webhook secret 생성
  const webhookSecret = crypto.randomBytes(32).toString("hex");
  console.log(
    `🔐 Webhook Secret 생성: ${webhookSecret.substring(0, 10)}... (길이: ${webhookSecret.length})`
  );

  // Webhook URL (팀 레포지토리와 동일한 엔드포인트 사용)
  const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";
  const webhookUrl = `${BACKEND_URL}/api/github/webhook`;

  // GitHub에 Webhook 생성
  let webhookId = null;
  try {
    console.log(`📤 Webhook 생성 시도: ${owner}/${repo} -> ${webhookUrl}`);
    console.log(
      `🔐 사용할 Secret: ${webhookSecret.substring(0, 10)}... (길이: ${webhookSecret.length})`
    );

    // 기존 webhook이 있는지 확인
    try {
      const existingWebhooks = await octokit.repos.listWebhooks({
        owner,
        repo,
      });
      if (existingWebhooks.data && existingWebhooks.data.length > 0) {
        console.log(`⚠️ 기존 Webhook 발견: ${existingWebhooks.data.length}개`);
        // 기존 webhook 삭제
        for (const hook of existingWebhooks.data) {
          if (hook.config.url === webhookUrl) {
            console.log(`🗑️ 기존 Webhook 삭제: ID=${hook.id}`);
            await octokit.repos.deleteWebhook({
              owner,
              repo,
              hook_id: hook.id,
            });
          }
        }
      }
    } catch (listError) {
      console.log(`ℹ️ 기존 Webhook 확인 실패 (무시): ${listError.message}`);
    }

    const webhookResponse = await octokit.repos.createWebhook({
      owner,
      repo,
      name: "web",
      active: true,
      events: ["push", "pull_request"],
      config: {
        url: webhookUrl,
        content_type: "json",
        secret: webhookSecret,
        insecure_ssl: process.env.NODE_ENV === "development" ? "1" : "0",
      },
    });
    webhookId = webhookResponse.data.id;
    console.log(`✅ Webhook 생성 성공: ID=${webhookId}`);
    console.log(
      `🔐 GitHub에 전달된 Secret: ${webhookSecret.substring(0, 10)}... (길이: ${webhookSecret.length})`
    );
    console.log(
      `💾 DB에 저장할 Secret: ${webhookSecret.substring(0, 10)}... (길이: ${webhookSecret.length})`
    );
  } catch (webhookError) {
    console.error("❌ Webhook 생성 오류:", {
      message: webhookError.message,
      status: webhookError.status,
      response: webhookError.response?.data,
      owner,
      repo,
      webhookUrl,
      secretLength: webhookSecret.length,
    });
    // Webhook 생성 실패해도 레포지토리 연결은 계속 진행
    // 사용자에게는 나중에 수동으로 Webhook을 생성하도록 안내할 수 있음
  }

  // TaskGitHubRepository 생성
  // Webhook 생성이 실패한 경우 경고
  if (!webhookId) {
    console.warn(`⚠️ Webhook 생성 실패: webhookId가 null입니다.`);
    console.warn(
      `⚠️ GitHub 레포지토리에 webhook이 생성되지 않았을 수 있습니다.`
    );
    console.warn(
      `⚠️ 수동으로 webhook을 생성하거나, 레포지토리를 다시 연결해야 합니다.`
    );
  }

  const repository = await prismaClient.taskGitHubRepository.create({
    data: {
      taskId,
      owner,
      repo,
      accessToken, // 실제로는 암호화해서 저장해야 함
      webhookSecret,
      webhookId,
      isActive: true,
    },
  });

  console.log(`💾 레포지토리 정보 저장 완료:`, {
    repositoryId: repository.id,
    webhookId: repository.webhookId,
    hasSecret: !!repository.webhookSecret,
    secretLength: repository.webhookSecret?.length,
  });

  return repository;
}

// 상태 전이 검증 함수
const isValidStatusTransition = (
  currentStatus,
  newStatus,
  userRole,
  taskAssigneeId,
  userId
) => {
  // 허용된 상태 전이 정의 (PENDING 제거 - 업무는 생성 시 바로 NOW로 시작)
  const validTransitions = {
    NOW: ["COMPLETED", "REVIEW", "CANCELLED"],
    IN_PROGRESS: ["NOW", "COMPLETED", "CANCELLED"],
    COMPLETED: ["REVIEW", "ENDING", "CANCELLED"],
    REVIEW: ["ENDING", "NOW", "CANCELLED"], // 승인→ENDING, 반려→NOW
    CANCELLED: [], // 취소된 업무는 변경 불가
    ENDING: [], // 종료된 업무는 변경 불가
  };

  // 권한 확인: REVIEW, ENDING 상태 변경은 팀장 이상만 가능
  // 단, 담당자 또는 참여자가 자신의 업무를 REVIEW로 변경하는 경우는 허용
  // 하지만 팀장급 이상은 검토 요청 불가 (참여자만 검토 요청 가능)
  if (newStatus === "REVIEW") {
    // 팀장급 이상은 검토 요청 불가
    if (["TEAM_LEAD"].includes(userRole)) {
      return false;
    }
    // 담당자 또는 참여자는 허용 (실제 참여자 확인은 API 엔드포인트에서 수행)
    // 여기서는 상태 전이 검증으로 진행
  } else if (newStatus === "ENDING") {
    // ENDING은 항상 팀장 이상만 가능 (담당자 예외 없음)
    if (!["TEAM_LEAD"].includes(userRole)) {
      return false;
    }
  }

  // 현재 상태에서 새 상태로의 전이가 유효한지 확인
  return validTransitions[currentStatus]?.includes(newStatus) || false;
};

const getAccessibleTaskForUser = async (taskId, user) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      participants: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!task) {
    return { task: null, error: "업무를 찾을 수 없습니다.", status: 404 };
  }

  const isSameTeam = task.teamId === user.teamName;
  const isAssignee = task.assigneeId === user.userId;
  const isAssigner = task.assignerId === user.userId;
  const isParticipant = task.participants?.some((p) => p.userId === user.userId);
  const isTeamLeadOrAbove = ["TEAM_LEAD"].includes(user.role);

  const canAccess =
    isAssignee || isAssigner || isParticipant || (isTeamLeadOrAbove && isSameTeam);

  if (!canAccess) {
    return { task: null, error: "권한이 없습니다.", status: 403 };
  }

  return { task, error: null, status: 200 };
};

const ACTIVE_TASK_STATUSES = ["NOW", "IN_PROGRESS", "REVIEW"];
const PRIORITY_SCORE_MAP = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

const getUrgencyAnalysis = (task) => {
  const now = Date.now();
  const priorityWeight = PRIORITY_SCORE_MAP[task.priority] || 1;
  const priorityScore = priorityWeight * 20;

  if (!task.dueDate) {
    return {
      score: Math.round(priorityScore),
      dueInHours: null,
      isOverdue: false,
    };
  }

  const dueAt = new Date(task.dueDate).getTime();
  const dueInHours = (dueAt - now) / (1000 * 60 * 60);
  const isOverdue = dueInHours < 0;

  let dueScore = 0;
  if (isOverdue) {
    const overdueHours = Math.abs(dueInHours);
    dueScore = 120 + Math.min(80, overdueHours * 2);
  } else {
    dueScore = Math.max(0, 100 - Math.min(100, dueInHours * 2));
  }

  return {
    score: Math.round(dueScore * 0.7 + priorityScore * 0.3),
    dueInHours: Math.round(dueInHours * 10) / 10,
    isOverdue,
  };
};

const buildFallbackReason = (task, analysis) => {
  const priorityText =
    task.priority === "URGENT"
      ? "긴급"
      : task.priority === "HIGH"
        ? "높음"
        : task.priority === "MEDIUM"
          ? "보통"
          : "낮음";

  if (!task.dueDate) {
    return `마감일은 없지만 중요도가 ${priorityText}로 설정되어 우선 확인이 필요합니다.`;
  }

  if (analysis.isOverdue) {
    return `마감일이 지났고 중요도가 ${priorityText}라 즉시 대응이 필요합니다.`;
  }

  if (typeof analysis.dueInHours === "number") {
    if (analysis.dueInHours <= 24) {
      return `마감이 24시간 이내이며 중요도가 ${priorityText}라 최우선 처리 대상입니다.`;
    }
    return `마감까지 약 ${Math.round(analysis.dueInHours)}시간 남았고 중요도가 ${priorityText}라 우선 순위가 높습니다.`;
  }

  return `마감일과 중요도를 기준으로 가장 우선도가 높은 업무입니다.`;
};

const generateUrgentTaskReason = async (task, analysis) => {
  const fallbackReason = buildFallbackReason(task, analysis);

  if (!getOpenAIApiKey()) {
    return {
      reason: fallbackReason,
      generatedByAI: false,
    };
  }

  try {
    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const completion = await client.responses.create({
      model,
      temperature: 0.2,
      max_output_tokens: 120,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "너는 업무 우선순위 판단 이유를 한 줄로 정리하는 한국어 비서다. 50자 내외로 자연스럽게 작성해라.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `업무 제목: ${task.title}\n` +
                `중요도: ${task.priority}\n` +
                `마감일: ${task.dueDate ? new Date(task.dueDate).toISOString() : "없음"}\n` +
                `마감까지 시간(시간): ${analysis.dueInHours ?? "없음"}\n` +
                `연체 여부: ${analysis.isOverdue ? "예" : "아니오"}`,
            },
          ],
        },
      ],
    });

    const reason =
      typeof completion?.output_text === "string"
        ? completion.output_text.trim()
        : "";

    if (!reason) {
      return {
        reason: fallbackReason,
        generatedByAI: false,
      };
    }

    return {
      reason,
      generatedByAI: true,
    };
  } catch (error) {
    console.error("긴급 업무 사유 생성 실패:", error?.message || error);
    return {
      reason: fallbackReason,
      generatedByAI: false,
    };
  }
};

// 업무 목록 조회
router.get("/", async (req, res) => {
  try {
    const { userId, role, teamName } = req.user;
    let where = {};

    if (role === "TEAM_LEAD") {
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
          select: {
            id: true,
            userId: true,
            role: true,
            note: true,
            updatedAt: true,
            startedAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        githubRepository: {
          select: {
            id: true,
            owner: true,
            repo: true,
            isActive: true,
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

// 가장 긴급한 업무 조회 (마감 임박 + 중요도 기준)
router.get("/most-urgent", async (req, res) => {
  try {
    const { userId, role, teamName } = req.user;

    const where =
      role === "TEAM_LEAD"
        ? { teamId: teamName }
        : {
            OR: [
              { assigneeId: userId },
              { participants: { some: { userId: userId } } },
            ],
          };

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        assigner: { select: { id: true, name: true, email: true } },
        participants: {
          select: {
            id: true,
            userId: true,
            role: true,
            note: true,
            updatedAt: true,
            startedAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const candidates = tasks.filter((task) =>
      ACTIVE_TASK_STATUSES.includes(task.status)
    );

    if (candidates.length === 0) {
      return res.json({
        ok: true,
        task: null,
        highlight: null,
      });
    }

    const ranked = candidates
      .map((task) => {
        const analysis = getUrgencyAnalysis(task);
        return { task, analysis };
      })
      .sort((a, b) => {
        if (b.analysis.score !== a.analysis.score) {
          return b.analysis.score - a.analysis.score;
        }

        if (a.task.dueDate && b.task.dueDate) {
          return (
            new Date(a.task.dueDate).getTime() - new Date(b.task.dueDate).getTime()
          );
        }
        if (a.task.dueDate && !b.task.dueDate) return -1;
        if (!a.task.dueDate && b.task.dueDate) return 1;

        const aPriority = PRIORITY_SCORE_MAP[a.task.priority] || 1;
        const bPriority = PRIORITY_SCORE_MAP[b.task.priority] || 1;
        if (bPriority !== aPriority) return bPriority - aPriority;

        return (
          new Date(a.task.createdAt).getTime() - new Date(b.task.createdAt).getTime()
        );
      });

    const top = ranked[0];
    const reasonResult = await generateUrgentTaskReason(top.task, top.analysis);

    return res.json({
      ok: true,
      task: top.task,
      highlight: {
        score: top.analysis.score,
        dueInHours: top.analysis.dueInHours,
        isOverdue: top.analysis.isOverdue,
        reason: reasonResult.reason,
        generatedByAI: reasonResult.generatedByAI,
      },
    });
  } catch (error) {
    console.error("가장 긴급한 업무 조회 오류:", error);
    return res.status(500).json({ error: "가장 긴급한 업무 조회에 실패했습니다." });
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
          select: {
            id: true,
            userId: true,
            role: true,
            note: true,
            updatedAt: true,
            startedAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        githubRepository: {
          select: {
            id: true,
            owner: true,
            repo: true,
            isActive: true,
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

// 댓글/논의 조회 (로그인한 사용자 기준)
router.get("/:id/discussion", async (req, res) => {
  try {
    const { id: taskId } = req.params;
    const { userId } = req.user;

    const accessibleTask = await getAccessibleTaskForUser(taskId, req.user);
    if (accessibleTask.error) {
      return res
        .status(accessibleTask.status)
        .json({ error: accessibleTask.error });
    }

    const note = await prisma.taskDiscussionNote.findUnique({
      where: {
        taskId_authorId: {
          taskId,
          authorId: userId,
        },
      },
      select: {
        id: true,
        taskId: true,
        authorId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const notes = await prisma.taskDiscussionNote.findMany({
      where: { taskId },
      select: {
        id: true,
        taskId: true,
        authorId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            picture: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ note: note || null, notes });
  } catch (error) {
    console.error("댓글/논의 조회 오류:", error);
    return res.status(500).json({ error: "댓글/논의 조회에 실패했습니다." });
  }
});

// 댓글/논의 저장 (로그인한 사용자 기준)
router.put("/:id/discussion", async (req, res) => {
  try {
    const { id: taskId } = req.params;
    const { userId } = req.user;
    const { content } = req.body || {};

    if (typeof content !== "string") {
      return res.status(400).json({ error: "content는 문자열이어야 합니다." });
    }

    const accessibleTask = await getAccessibleTaskForUser(taskId, req.user);
    if (accessibleTask.error) {
      return res
        .status(accessibleTask.status)
        .json({ error: accessibleTask.error });
    }

    const saved = await prisma.taskDiscussionNote.upsert({
      where: {
        taskId_authorId: {
          taskId,
          authorId: userId,
        },
      },
      update: {
        content,
      },
      create: {
        taskId,
        authorId: userId,
        content,
      },
      select: {
        id: true,
        taskId: true,
        authorId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ note: saved });
  } catch (error) {
    console.error("댓글/논의 저장 오류:", error);
    return res.status(500).json({ error: "댓글/논의 저장에 실패했습니다." });
  }
});

// 댓글/논의 삭제 (로그인한 사용자 기준)
router.delete("/:id/discussion", async (req, res) => {
  try {
    const { id: taskId } = req.params;
    const { userId } = req.user;

    const accessibleTask = await getAccessibleTaskForUser(taskId, req.user);
    if (accessibleTask.error) {
      return res
        .status(accessibleTask.status)
        .json({ error: accessibleTask.error });
    }

    const existing = await prisma.taskDiscussionNote.findUnique({
      where: {
        taskId_authorId: {
          taskId,
          authorId: userId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "삭제할 댓글/논의가 없습니다." });
    }

    await prisma.taskDiscussionNote.delete({
      where: {
        taskId_authorId: {
          taskId,
          authorId: userId,
        },
      },
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error("댓글/논의 삭제 오류:", error);
    return res.status(500).json({ error: "댓글/논의 삭제에 실패했습니다." });
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
      isDevelopmentTask,
      githubOwner,
      githubRepo,
      githubAccessToken,
    } = req.body;
    const { userId, teamName } = req.user;

    // 트랜잭션으로 업무 + 참여자 함께 생성
    const result = await prisma.$transaction(async (tx) => {
      // 1. 업무 생성 (생성 시 바로 NOW 상태로 시작)
      const task = await tx.task.create({
        data: {
          title,
          description,
          assigneeId,
          assignerId: userId,
          teamId: teamName,
          priority: priority || "MEDIUM",
          dueDate: dueDate ? new Date(dueDate) : null,
          status: "NOW", // 업무 생성 시 바로 시작
          referenceImageUrls: referenceImageUrls || [],
          isDevelopmentTask: isDevelopmentTask || false,
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
          assignee: { select: { id: true, name: true, email: true } },
          assigner: { select: { id: true, name: true, email: true } },
          participants: {
            select: {
              id: true,
              userId: true,
              role: true,
              note: true,
              updatedAt: true,
              startedAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          githubRepository: {
            select: {
              id: true,
              owner: true,
              repo: true,
              isActive: true,
            },
          },
        },
      });
    });

    // 5. 개발팀 업무이고 GitHub 정보가 제공된 경우 레포지토리 연결 (트랜잭션 외부에서 처리)
    if (isDevelopmentTask && githubOwner && githubRepo && githubAccessToken) {
      // 트랜잭션 외부에서 GitHub 연결 시도 (실패해도 업무는 이미 생성됨)
      connectTaskGitHubRepository(
        result.id,
        githubOwner,
        githubRepo,
        githubAccessToken,
        prisma
      ).catch((githubError) => {
        console.error("GitHub 레포지토리 연결 오류 (비동기):", githubError);
        console.error("에러 상세:", {
          message: githubError.message,
          stack: githubError.stack,
          status: githubError.status,
        });
        // GitHub 연결 실패해도 업무는 이미 생성되었으므로 계속 진행
      });
    }

    res.status(201).json(result);
  } catch (error) {
    console.error("업무 생성 오류:", error);
    console.error("에러 상세:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name,
    });
    res.status(500).json({
      error: "서버 오류",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 업무 상태 변경
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body; // status와 comment(선택사항) 받기
    const { userId, role } = req.user;

    // 1. 업무 조회 (참여자 정보 포함)
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        assigner: true,
        participants: {
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: "업무를 찾을 수 없습니다." });
    }

    // 1-1. 참여자 확인 (PENDING → NOW 전이 시 참여자 권한 확인)
    const isParticipant = task.participants?.some((p) => p.userId === userId);
    const isAssignee = task.assigneeId === userId;

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
    // 담당자 또는 참여자가 자신의 업무를 REVIEW로 변경하는 경우는 허용
    if (status === "REVIEW") {
      // 담당자 또는 참여자가 자신의 업무를 REVIEW로 변경하는 경우 → 허용
      const isAssignee =
        task.assigneeId && userId && task.assigneeId === userId;
      const isParticipant = task.participants?.some((p) => p.userId === userId);

      if (!isAssignee && !isParticipant) {
        // 담당자도 참여자도 아닌 경우, 팀장 이상 권한 필요
        if (!["TEAM_LEAD"].includes(role)) {
          return res.status(403).json({
            error:
              "검토 요청 권한이 없습니다. 담당자 또는 참여자만 검토를 요청할 수 있습니다.",
          });
        }
      }

      // 팀장급 이상은 검토 요청 불가 (참여자만 검토 요청 가능)
      if (["TEAM_LEAD"].includes(role)) {
        return res.status(403).json({
          error: "팀장급 이상은 검토 요청을 할 수 없습니다.",
        });
      }
    } else if (status === "ENDING") {
      // ENDING은 항상 팀장 이상만 가능
      if (!["TEAM_LEAD"].includes(role)) {
        return res.status(403).json({
          error: "종료 권한이 없습니다.",
        });
      }
    } else if (status === "CANCELLED") {
      // CANCELLED는 팀장 이상만 가능
      if (!["TEAM_LEAD"].includes(role)) {
        return res.status(403).json({
          error:
            "취소 권한이 없습니다. 팀장급 이상만 업무를 취소할 수 있습니다.",
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

      // 4-4. PENDING → NOW 전이 시 참여자의 startedAt 업데이트
      if (task.status === "PENDING" && status === "NOW") {
        // 현재 사용자가 참여자인지 확인 (이미 조회한 task.participants 사용)
        const participant = task.participants?.find((p) => p.userId === userId);

        if (participant) {
          try {
            // 참여자의 업무 시작 시간 기록 (이미 시작하지 않은 경우만)
            const existingParticipant = await tx.taskParticipant.findUnique({
              where: { id: participant.id },
              select: { startedAt: true },
            });

            if (existingParticipant && !existingParticipant.startedAt) {
              await tx.taskParticipant.update({
                where: { id: participant.id },
                data: { startedAt: new Date() },
              });
            }
          } catch (participantError) {
            // 참여자 업데이트 실패해도 상태 변경은 계속 진행
            console.error("참여자 startedAt 업데이트 오류:", participantError);
          }
        }
      }

      // 4-5. 상태 이력 저장 (TaskStatusHistory)
      await tx.taskStatusHistory.create({
        data: {
          taskId: id,
          status: status,
          changedBy: userId,
          comment: comment || null, // 리뷰 반려 시 코멘트 저장
        },
      });

      // 4-6. 업데이트된 참여자 정보를 포함하여 반환
      const finalTask = await tx.task.findUnique({
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

      return finalTask;
    });

    // 5. 성공 응답
    res.json(result);
  } catch (error) {
    console.error("상태 변경 오류:", error);
    console.error("오류 상세:", {
      message: error.message,
      stack: error.stack,
      taskId: req.params.id,
      status: req.body.status,
      userId: req.user?.userId,
    });
    res.status(500).json({
      error: "서버 오류",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.put("/:id/status", async (req, res) => {});

// 참여자 업무 시작 상태 업데이트
router.put("/:id/participants/:participantId/start", async (req, res) => {
  try {
    const { id, participantId } = req.params;
    const { userId } = req.user;
    const { started } = req.body; // true: 시작, false: 중지

    // 업무 조회
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: "업무를 찾을 수 없습니다." });
    }

    // 참여자 확인
    const participant = task.participants.find(
      (p) => p.id === participantId && p.userId === userId
    );

    if (!participant) {
      return res.status(403).json({
        error: "권한이 없습니다. 본인이 참여한 업무만 시작할 수 있습니다.",
      });
    }

    // 업무 시작 상태 업데이트
    const updatedParticipant = await prisma.taskParticipant.update({
      where: { id: participantId },
      data: { startedAt: started ? new Date() : null },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json(updatedParticipant);
  } catch (error) {
    console.error("참여자 업무 시작 상태 업데이트 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 참여자 노트 저장/수정
router.put("/:id/participants/:participantId/note", async (req, res) => {
  try {
    const { id, participantId } = req.params;
    const { note } = req.body;
    const { userId } = req.user;

    // 업무 조회
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: "업무를 찾을 수 없습니다." });
    }

    // 참여자 확인
    const participant = task.participants.find(
      (p) => p.id === participantId && p.userId === userId
    );

    if (!participant) {
      return res.status(403).json({
        error: "권한이 없습니다. 본인이 참여한 업무만 작성할 수 있습니다.",
      });
    }

    // 노트 업데이트
    const updatedParticipant = await prisma.taskParticipant.update({
      where: { id: participantId },
      data: { note: note || null },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json(updatedParticipant);
  } catch (error) {
    console.error("참여자 노트 저장 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 참여자 노트 조회
router.get("/:id/participants/notes", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    // 업무 조회
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: "업무를 찾을 수 없습니다." });
    }

    // 참여자 확인 (본인이 참여한 업무인지)
    const isParticipant = task.participants.some((p) => p.userId === userId);
    const isAssignee = task.assigneeId === userId;
    const isAssigner = task.assignerId === userId;

    if (!isParticipant && !isAssignee && !isAssigner) {
      return res.status(403).json({
        error: "권한이 없습니다.",
      });
    }

    // 참여자별 노트 반환 (본인 노트만 또는 모든 노트)
    const notes = task.participants
      .filter((p) => p.note) // 노트가 있는 것만
      .map((p) => ({
        id: p.id,
        userId: p.userId,
        userName: p.user.name,
        note: p.note,
        updatedAt: p.updatedAt,
        isOwn: p.userId === userId, // 본인 노트인지
      }));

    res.json(notes);
  } catch (error) {
    console.error("참여자 노트 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 참고 링크 업데이트
router.put("/:id/links", async (req, res) => {
  try {
    const { id } = req.params;
    const { links } = req.body; // links: string[]
    const { userId, role } = req.user;

    // 업무 조회
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        assigner: true,
        participants: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: "업무를 찾을 수 없습니다." });
    }

    // 권한 확인: 담당자, 참여자, 또는 팀장 이상만 링크 수정 가능
    const isParticipant = task.participants?.some((p) => p.userId === userId);
    const isAssignee = task.assigneeId === userId;
    const isTeamLeadOrAbove = ["TEAM_LEAD"].includes(role);

    if (!isAssignee && !isParticipant && !isTeamLeadOrAbove) {
      return res.status(403).json({
        error:
          "권한이 없습니다. 담당자, 참여자 또는 팀장급 이상만 링크를 수정할 수 있습니다.",
      });
    }

    // 링크 유효성 검사
    if (!Array.isArray(links)) {
      return res.status(400).json({ error: "links는 배열이어야 합니다." });
    }

    // 각 링크가 유효한 URL인지 확인
    const urlPattern = /^https?:\/\/.+/;
    for (const link of links) {
      if (typeof link !== "string" || !urlPattern.test(link)) {
        return res.status(400).json({
          error: `유효하지 않은 링크 형식입니다: ${link}`,
        });
      }
    }

    // 링크 업데이트
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        referenceLinks: links,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        assigner: { select: { id: true, name: true, email: true } },
        participants: {
          select: {
            id: true,
            userId: true,
            role: true,
            note: true,
            updatedAt: true,
            startedAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        githubRepository: {
          select: {
            id: true,
            owner: true,
            repo: true,
            isActive: true,
          },
        },
      },
    });

    res.json(updatedTask);
  } catch (error) {
    console.error("링크 업데이트 오류:", error);
    console.error("에러 상세:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name,
    });
    res.status(500).json({
      error: "서버 오류",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
