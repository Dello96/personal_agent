const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");
const { Octokit } = require("@octokit/rest");
const crypto = require("crypto");

// Webhook 엔드포인트는 인증 미들웨어 제외 (GitHub에서 직접 호출)
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const signature = req.headers["x-hub-signature-256"];
    const event = req.headers["x-github-event"];
    const payload = JSON.parse(req.body.toString());

    if (!signature || !event) {
      return res.status(400).json({ error: "유효하지 않은 요청입니다." });
    }

    // 레포지토리 정보 찾기
    const fullName = payload.repository?.full_name;
    if (!fullName) {
      return res.status(400).json({ error: "레포지토리 정보가 없습니다." });
    }

    const [owner, repo] = fullName.split("/");
    
    // 먼저 팀 레포지토리에서 찾기
    let repository = await prisma.githubRepository.findFirst({
      where: { owner, repo },
    });
    let isTaskRepository = false;

    // 팀 레포지토리가 없으면 업무별 레포지토리에서 찾기
    if (!repository) {
      repository = await prisma.taskGitHubRepository.findFirst({
        where: { owner, repo },
      });
      isTaskRepository = !!repository;
    }

    if (!repository || !repository.webhookSecret) {
      return res.status(404).json({ error: "레포지토리를 찾을 수 없습니다." });
    }

    // Webhook 서명 검증
    const hmac = crypto.createHmac("sha256", repository.webhookSecret);
    const digest = "sha256=" + hmac.update(req.body).digest("hex");

    if (signature !== digest) {
      return res.status(401).json({ error: "서명이 일치하지 않습니다." });
    }

    // 이벤트 처리
    if (event === "push") {
      await handlePushEvent(payload, repository, isTaskRepository);
    } else if (event === "pull_request") {
      await handlePullRequestEvent(payload, repository, isTaskRepository);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook 처리 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 나머지 라우트는 인증 미들웨어 적용
router.use(authenticate);

// GitHub 레포지토리 연결
router.post("/repositories", async (req, res) => {
  try {
    const { owner, repo, accessToken } = req.body;
    const { userId, teamName, role } = req.user;

    // 팀장 이상만 레포지토리 연결 가능
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role)) {
      return res.status(403).json({
        error: "권한이 없습니다. 팀장급 이상만 레포지토리를 연결할 수 있습니다.",
      });
    }

    if (!owner || !repo || !accessToken) {
      return res.status(400).json({
        error: "owner, repo, accessToken은 필수입니다.",
      });
    }

    // GitHub API로 레포지토리 접근 권한 확인
    const octokit = new Octokit({ auth: accessToken });
    try {
      await octokit.repos.get({ owner, repo });
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).json({
          error: "레포지토리를 찾을 수 없거나 접근 권한이 없습니다.",
        });
      }
      throw error;
    }

    // Webhook secret 생성
    const webhookSecret = crypto.randomBytes(32).toString("hex");

    // Webhook URL (환경 변수에서 가져오거나 기본값 사용)
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";
    const webhookUrl = `${BACKEND_URL}/api/github/webhook`;

    // GitHub에 Webhook 생성
    let webhookId = null;
    try {
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
    } catch (webhookError) {
      console.error("Webhook 생성 오류:", webhookError);
      // Webhook 생성 실패해도 레포지토리 연결은 계속 진행
    }

    // 데이터베이스에 저장 (기존 레포지토리가 있으면 업데이트)
    const repository = await prisma.githubRepository.upsert({
      where: { teamId: teamName },
      update: {
        owner,
        repo,
        accessToken, // 실제로는 암호화해서 저장해야 함
        webhookSecret,
        webhookId,
        isActive: true,
      },
      create: {
        teamId: teamName,
        owner,
        repo,
        accessToken, // 실제로는 암호화해서 저장해야 함
        webhookSecret,
        webhookId,
        isActive: true,
      },
    });

    res.status(201).json({
      id: repository.id,
      owner: repository.owner,
      repo: repository.repo,
      isActive: repository.isActive,
      webhookId: repository.webhookId,
    });
  } catch (error) {
    console.error("레포지토리 연결 오류:", error);
    res.status(500).json({
      error: "서버 오류",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 연결된 레포지토리 조회
router.get("/repositories", async (req, res) => {
  try {
    const { teamName } = req.user;

    const repository = await prisma.githubRepository.findUnique({
      where: { teamId: teamName },
      include: {
        activities: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!repository) {
      return res.status(404).json({ error: "연결된 레포지토리가 없습니다." });
    }

    // accessToken은 보안상 반환하지 않음
    res.json({
      id: repository.id,
      owner: repository.owner,
      repo: repository.repo,
      isActive: repository.isActive,
      webhookId: repository.webhookId,
      activities: repository.activities,
    });
  } catch (error) {
    console.error("레포지토리 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 레포지토리 연결 해제
router.delete("/repositories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, teamName, role } = req.user;

    // 팀장 이상만 연결 해제 가능
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role)) {
      return res.status(403).json({
        error: "권한이 없습니다.",
      });
    }

    const repository = await prisma.githubRepository.findUnique({
      where: { id },
    });

    if (!repository || repository.teamId !== teamName) {
      return res.status(404).json({ error: "레포지토리를 찾을 수 없습니다." });
    }

    // GitHub에서 Webhook 삭제
    if (repository.webhookId && repository.accessToken) {
      try {
        const octokit = new Octokit({ auth: repository.accessToken });
        await octokit.repos.deleteWebhook({
          owner: repository.owner,
          repo: repository.repo,
          hook_id: repository.webhookId,
        });
      } catch (webhookError) {
        console.error("Webhook 삭제 오류:", webhookError);
        // Webhook 삭제 실패해도 레포지토리 삭제는 계속 진행
      }
    }

    // 데이터베이스에서 삭제
    await prisma.githubRepository.delete({
      where: { id },
    });

    res.json({ message: "레포지토리 연결이 해제되었습니다." });
  } catch (error) {
    console.error("레포지토리 연결 해제 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// GitHub 활동 조회 (팀 레포지토리)
router.get("/activities", async (req, res) => {
  try {
    const { teamName } = req.user;
    const { limit = 20, type } = req.query;

    const repository = await prisma.githubRepository.findUnique({
      where: { teamId: teamName },
    });

    if (!repository) {
      return res.status(404).json({ error: "연결된 레포지토리가 없습니다." });
    }

    const where = {
      repositoryId: repository.id,
    };

    if (type) {
      where.type = type;
    }

    const activities = await prisma.githubActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
    });

    res.json(activities);
  } catch (error) {
    console.error("활동 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 업무별 GitHub 활동 조회
router.get("/task-activities/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { limit = 20, type } = req.query;

    // 업무 조회 및 권한 확인
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        githubRepository: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: "업무를 찾을 수 없습니다." });
    }

    if (!task.githubRepository) {
      return res.status(404).json({ error: "연결된 레포지토리가 없습니다." });
    }

    const where = {
      repositoryId: task.githubRepository.id,
    };

    if (type) {
      where.type = type;
    }

    const activities = await prisma.taskGitHubActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
    });

    res.json(activities);
  } catch (error) {
    console.error("업무별 활동 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// Push 이벤트 처리
async function handlePushEvent(payload, repository, isTaskRepository = false) {
  try {
    const commits = payload.commits || [];
    
    for (const commit of commits) {
      if (isTaskRepository) {
        // 업무별 레포지토리
        await prisma.taskGitHubActivity.create({
          data: {
            repositoryId: repository.id,
            type: "commit",
            author: commit.author.name || commit.author.username,
            message: commit.message,
            sha: commit.id,
            branch: payload.ref.replace("refs/heads/", ""),
            url: commit.url,
          },
        });
      } else {
        // 팀 레포지토리
        await prisma.githubActivity.create({
          data: {
            repositoryId: repository.id,
            type: "commit",
            author: commit.author.name || commit.author.username,
            message: commit.message,
            sha: commit.id,
            branch: payload.ref.replace("refs/heads/", ""),
            url: commit.url,
          },
        });
      }
    }

    // WebSocket으로 알림 전송
    const { chatWSS } = require("../server");
    if (chatWSS) {
      if (isTaskRepository) {
        // 업무별 레포지토리: 해당 업무의 팀에 알림
        const taskRepo = await prisma.taskGitHubRepository.findUnique({
          where: { id: repository.id },
          select: { taskId: true },
        });
        if (taskRepo) {
          const task = await prisma.task.findUnique({
            where: { id: taskRepo.taskId },
            select: { teamId: true },
          });
          if (task) {
            chatWSS.broadcastToTeam(task.teamId, {
              type: "github_activity",
              data: {
                type: "push",
                repository: `${repository.owner}/${repository.repo}`,
                branch: payload.ref.replace("refs/heads/", ""),
                commits: commits.length,
                taskId: taskRepo.taskId,
              },
            });
          }
        }
      } else {
        // 팀 레포지토리
        chatWSS.broadcastToTeam(repository.teamId, {
          type: "github_activity",
          data: {
            type: "push",
            repository: `${repository.owner}/${repository.repo}`,
            branch: payload.ref.replace("refs/heads/", ""),
            commits: commits.length,
          },
        });
      }
    }
  } catch (error) {
    console.error("Push 이벤트 처리 오류:", error);
  }
}

// Pull Request 이벤트 처리
async function handlePullRequestEvent(payload, repository, isTaskRepository = false) {
  try {
    const pr = payload.pull_request;
    const action = payload.action;

    if (isTaskRepository) {
      // 업무별 레포지토리
      await prisma.taskGitHubActivity.create({
        data: {
          repositoryId: repository.id,
          type: "pull_request",
          action: action,
          author: pr.user.login,
          message: pr.title,
          branch: pr.head.ref,
          url: pr.html_url,
        },
      });
    } else {
      // 팀 레포지토리
      await prisma.githubActivity.create({
        data: {
          repositoryId: repository.id,
          type: "pull_request",
          action: action,
          author: pr.user.login,
          message: pr.title,
          branch: pr.head.ref,
          url: pr.html_url,
        },
      });
    }

    // WebSocket으로 알림 전송
    const { chatWSS } = require("../server");
    if (chatWSS) {
      if (isTaskRepository) {
        // 업무별 레포지토리: 해당 업무의 팀에 알림
        const taskRepo = await prisma.taskGitHubRepository.findUnique({
          where: { id: repository.id },
          select: { taskId: true },
        });
        const task = taskRepo ? await prisma.task.findUnique({
          where: { id: taskRepo.taskId },
          select: { teamId: true },
        }) : null;
        if (task) {
          chatWSS.broadcastToTeam(task.teamId, {
            type: "github_activity",
            data: {
              type: "pull_request",
              action: action,
              repository: `${repository.owner}/${repository.repo}`,
              title: pr.title,
              author: pr.user.login,
              url: pr.html_url,
              taskId: taskRepo.taskId,
            },
          });
        }
      } else {
        // 팀 레포지토리
        chatWSS.broadcastToTeam(repository.teamId, {
          type: "github_activity",
          data: {
            type: "pull_request",
            action: action,
            repository: `${repository.owner}/${repository.repo}`,
            title: pr.title,
            author: pr.user.login,
            url: pr.html_url,
          },
        });
      }
    }
  } catch (error) {
    console.error("Pull Request 이벤트 처리 오류:", error);
  }
}

module.exports = router;
