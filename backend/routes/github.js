const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");
const { Octokit } = require("@octokit/rest");
const crypto = require("crypto");

// Prisma 클라이언트 확인
if (!prisma) {
  console.error("❌ Prisma 클라이언트를 로드할 수 없습니다!");
  throw new Error("Prisma 클라이언트 초기화 실패");
}

// Webhook 엔드포인트는 인증 미들웨어 제외 (GitHub에서 직접 호출)
// express.raw()는 server.js에서 이미 적용됨
router.post("/webhook", async (req, res) => {
  let requestId = null;
  try {
    // 요청 추적을 위한 ID 생성
    requestId = Date.now().toString();
    console.log(`[${requestId}] 📥 GitHub Webhook 수신 시작`);

    const signature = req.headers["x-hub-signature-256"];
    const event = req.headers["x-github-event"];
    const deliveryId = req.headers["x-github-delivery"];

    console.log(`[${requestId}] 헤더 정보:`, {
      event,
      deliveryId,
      hasSignature: !!signature,
      contentType: req.headers["content-type"],
    });

    if (!event) {
      console.error(`[${requestId}] ❌ 필수 헤더 누락: event=${!!event}`);
      return res.status(400).json({ error: "유효하지 않은 요청입니다. x-github-event 헤더가 필요합니다." });
    }

    // ping 이벤트는 서명 검증 없이 처리
    if (event === "ping") {
      console.log(`[${requestId}] ✅ Ping 이벤트 수신 (서명 검증 생략)`);
      res.status(200).json({ message: "Webhook is active" });
      return;
    }

    if (!signature) {
      console.error(`[${requestId}] ❌ 서명 헤더 누락: signature=${!!signature}`);
      return res.status(400).json({ error: "유효하지 않은 요청입니다. x-hub-signature-256 헤더가 필요합니다." });
    }

    // 요청 본문 파싱 (express.raw()로 Buffer 형태로 받음)
    let payload;
    let rawBody;
    try {
      // req.body는 express.raw()로 인해 Buffer 형태
      if (!Buffer.isBuffer(req.body)) {
        console.error(`[${requestId}] ❌ Body가 Buffer가 아님:`, typeof req.body);
        return res.status(400).json({ error: "요청 본문 형식이 올바르지 않습니다." });
      }
      
      rawBody = req.body; // 서명 검증을 위해 원본 보존
      const bodyString = req.body.toString('utf8');
      payload = JSON.parse(bodyString);
      console.log(`[${requestId}] ✅ 페이로드 파싱 성공`);
    } catch (parseError) {
      console.error(`[${requestId}] ❌ 페이로드 파싱 실패:`, {
        message: parseError.message,
        bodyType: typeof req.body,
        isBuffer: Buffer.isBuffer(req.body),
        bodyLength: req.body?.length,
        bodyPreview: Buffer.isBuffer(req.body) 
          ? req.body.toString('utf8').substring(0, 200) 
          : String(req.body).substring(0, 200),
      });
      return res.status(400).json({ error: "유효하지 않은 JSON 형식입니다." });
    }

    // 레포지토리 정보 찾기
    const fullName = payload.repository?.full_name;
    if (!fullName) {
      // ping 이벤트는 repository 정보가 없을 수 있음
      if (event === "ping") {
        console.log(`[${requestId}] ⚠️ Ping 이벤트: 레포지토리 정보 없음 (정상)`);
        res.status(200).json({ message: "Webhook is active" });
        return;
      }
      
      console.error(`[${requestId}] ❌ 레포지토리 정보 없음:`, {
        event,
        hasRepository: !!payload.repository,
        repositoryKeys: payload.repository ? Object.keys(payload.repository) : [],
        payloadKeys: Object.keys(payload),
      });
      return res.status(400).json({ error: "레포지토리 정보가 없습니다." });
    }

    const [owner, repo] = fullName.split("/");
    console.log(`[${requestId}] 🔍 레포지토리 검색: ${owner}/${repo}`);
    
    // 먼저 팀 레포지토리에서 찾기
    let repository = await prisma.gitHubRepository.findFirst({
      where: { owner, repo },
    });
    let isTaskRepository = false;

    // 팀 레포지토리가 없으면 업무별 레포지토리에서 찾기
    if (!repository) {
      console.log(`[${requestId}] 팀 레포지토리 없음, 업무별 레포지토리 검색 중...`);
      repository = await prisma.taskGitHubRepository.findFirst({
        where: { owner, repo },
      });
      isTaskRepository = !!repository;
    }

    if (!repository) {
      console.error(`[${requestId}] ❌ 레포지토리를 찾을 수 없음: ${owner}/${repo}`);
      // 레포지토리를 찾을 수 없어도 200을 반환 (GitHub이 재시도하지 않도록)
      // 하지만 로그는 남김
      console.log(`[${requestId}] ⚠️ 레포지토리를 찾을 수 없지만 성공으로 처리 (재시도 방지)`);
      res.status(200).json({ message: "Webhook received but repository not found" });
      return;
    }

    if (!repository.webhookSecret) {
      console.error(`[${requestId}] ❌ Webhook secret이 없음: repositoryId=${repository.id}`);
      // webhook secret이 없어도 200을 반환 (GitHub이 재시도하지 않도록)
      console.log(`[${requestId}] ⚠️ Webhook secret이 없지만 성공으로 처리 (재시도 방지)`);
      res.status(200).json({ message: "Webhook received but secret not configured" });
      return;
    }

    console.log(`[${requestId}] ✅ 레포지토리 찾음: ${isTaskRepository ? "업무별" : "팀"} 레포지토리`);
    
    // webhookId가 null인 경우 - webhook 생성이 실패했거나 수동으로 생성된 webhook
    if (!repository.webhookId) {
      console.warn(`[${requestId}] ⚠️ Webhook ID가 null입니다.`);
      console.warn(`[${requestId}] ⚠️ 이는 webhook 생성이 실패했거나 수동으로 생성된 webhook일 수 있습니다.`);
      console.warn(`[${requestId}] ⚠️ 서명 검증을 스킵하고 계속 진행합니다.`);
      // webhookId가 null인 경우 서명 검증 스킵 (webhook이 자동 생성되지 않았을 수 있음)
      // 개발 환경에서는 계속 진행, 프로덕션에서는 경고만 표시
    } else {
      // Webhook 서명 검증 (webhookId가 있는 경우만)
      console.log(`[${requestId}] 🔐 서명 검증 시작:`, {
        webhookId: repository.webhookId,
        secretFromDB: repository.webhookSecret?.substring(0, 10) + "...",
        secretLength: repository.webhookSecret?.length,
        rawBodyLength: rawBody?.length,
        signatureFromGitHub: signature?.substring(0, 30) + "...",
        signatureLength: signature?.length,
      });
      
      const hmac = crypto.createHmac("sha256", repository.webhookSecret);
      const digest = "sha256=" + hmac.update(rawBody).digest("hex");

      console.log(`[${requestId}] 🔐 서명 비교:`, {
        expected: digest,
        received: signature,
        match: signature === digest,
      });

      if (signature !== digest) {
        console.error(`[${requestId}] ❌ 서명 검증 실패:`, {
          expected: digest,
          received: signature,
          secretFromDB: repository.webhookSecret?.substring(0, 20) + "...",
          secretLength: repository.webhookSecret?.length,
          rawBodyLength: rawBody?.length,
          rawBodyPreview: rawBody.toString('utf8').substring(0, 100),
          signatureLength: signature?.length,
          repositoryId: repository.id,
          owner: repository.owner,
          repo: repository.repo,
          webhookId: repository.webhookId,
        });
        
        // 개발 환경에서는 경고만 하고 통과 (프로덕션에서는 엄격하게 검증)
        if (process.env.NODE_ENV === "development") {
          console.warn(`[${requestId}] ⚠️ 개발 환경: 서명 검증 실패했지만 계속 진행합니다.`);
          console.warn(`[${requestId}] ⚠️ 원인: GitHub webhook 설정의 secret과 DB의 secret이 일치하지 않습니다.`);
          console.warn(`[${requestId}] ⚠️ 해결: GitHub 레포지토리에서 webhook을 삭제하고 업무를 다시 생성하거나,`);
          console.warn(`[${requestId}] ⚠️      webhook 설정의 secret을 DB의 secret과 일치시켜야 합니다.`);
        } else {
          // 프로덕션 환경에서는 엄격하게 검증
          return res.status(401).json({ error: "서명이 일치하지 않습니다." });
        }
      } else {
        console.log(`[${requestId}] ✅ 서명 검증 성공`);
      }
    }

    // 이벤트 처리
    console.log(`[${requestId}] 🔄 이벤트 처리 시작: ${event}`);
    if (event === "ping") {
      // GitHub webhook ping 이벤트 (webhook 생성 시 테스트)
      console.log(`[${requestId}] ✅ Ping 이벤트 수신 (webhook 테스트)`);
      res.status(200).json({ message: "Webhook is active" });
      return;
    } else if (event === "push") {
      try {
        await handlePushEvent(payload, repository, isTaskRepository, requestId);
        console.log(`[${requestId}] ✅ Push 이벤트 처리 완료`);
      } catch (pushError) {
        console.error(`[${requestId}] ❌ Push 이벤트 처리 중 오류:`, {
          message: pushError.message,
          stack: pushError.stack,
          name: pushError.name,
          code: pushError.code,
        });
        // 에러가 발생해도 200 응답 (GitHub이 재시도하지 않도록)
        // 하지만 로그는 남김
      }
    } else if (event === "pull_request") {
      try {
        await handlePullRequestEvent(payload, repository, isTaskRepository, requestId);
        console.log(`[${requestId}] ✅ Pull Request 이벤트 처리 완료`);
      } catch (prError) {
        console.error(`[${requestId}] ❌ Pull Request 이벤트 처리 중 오류:`, {
          message: prError.message,
          stack: prError.stack,
          name: prError.name,
          code: prError.code,
        });
        // 에러가 발생해도 200 응답 (GitHub이 재시도하지 않도록)
        // 하지만 로그는 남김
      }
    } else {
      console.log(`[${requestId}] ⚠️ 알 수 없는 이벤트 타입: ${event}`);
      // 알 수 없는 이벤트는 성공으로 처리 (GitHub이 재시도하지 않도록)
    }

    console.log(`[${requestId}] ✅ Webhook 처리 완료`);
    res.status(200).send("OK");
  } catch (error) {
    console.error(`[${requestId || "UNKNOWN"}] ❌ Webhook 처리 오류:`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });

    // 이미 응답을 보냈는지 확인
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "서버 오류",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } else {
      console.error(`[${requestId || "UNKNOWN"}] ⚠️ 응답이 이미 전송됨`);
    }
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
    const repository = await prisma.gitHubRepository.upsert({
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

    const repository = await prisma.gitHubRepository.findUnique({
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

    const repository = await prisma.gitHubRepository.findUnique({
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
    await prisma.gitHubRepository.delete({
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
    if (!prisma) {
      console.error("❌ Prisma 클라이언트가 없습니다!");
      return res.status(500).json({ error: "데이터베이스 연결 오류" });
    }

    const { teamName } = req.user;
    const { limit = 20, type } = req.query;

    const repository = await prisma.gitHubRepository.findUnique({
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

    const activities = await prisma.gitHubActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
    });

    res.json(activities);
  } catch (error) {
    console.error("활동 조회 오류:", error);
    console.error("에러 상세:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      prismaType: typeof prisma,
    });
    res.status(500).json({ 
      error: "서버 오류",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 업무별 GitHub 활동 조회
router.get("/task-activities/:taskId", async (req, res) => {
  try {
    if (!prisma) {
      console.error("❌ Prisma 클라이언트가 없습니다!");
      return res.status(500).json({ error: "데이터베이스 연결 오류" });
    }

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
    console.error("에러 상세:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      prismaType: typeof prisma,
    });
    res.status(500).json({ 
      error: "서버 오류",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Push 이벤트 처리
async function handlePushEvent(payload, repository, isTaskRepository = false, requestId = null) {
  try {
    const commits = payload.commits || [];
    console.log(`[${requestId || "PUSH"}] 📝 커밋 처리 시작: ${commits.length}개`);
    
    if (commits.length === 0) {
      console.log(`[${requestId || "PUSH"}] ⚠️ 커밋이 없습니다. (force push 또는 태그일 수 있음)`);
      // 커밋이 없어도 push 이벤트는 정상 처리
      return;
    }
    
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      try {
        const author = commit.author?.name || commit.author?.username || commit.committer?.name || commit.committer?.username || "Unknown";
        const message = commit.message || "";
        const sha = commit.id || commit.sha || "";
        const branch = payload.ref ? payload.ref.replace("refs/heads/", "") : "main";
        const url = commit.url || "";
        
        if (isTaskRepository) {
          // 업무별 레포지토리
          await prisma.taskGitHubActivity.create({
            data: {
              repositoryId: repository.id,
              type: "commit",
              author: author,
              message: message,
              sha: sha,
              branch: branch,
              url: url,
            },
          });
        } else {
          // 팀 레포지토리
          await prisma.gitHubActivity.create({
            data: {
              repositoryId: repository.id,
              type: "commit",
              author: author,
              message: message,
              sha: sha,
              branch: branch,
              url: url,
            },
          });
        }
        console.log(`[${requestId || "PUSH"}] ✅ 커밋 ${i + 1}/${commits.length} 저장 완료: ${sha.substring(0, 7)}`);
      } catch (commitError) {
        console.error(`[${requestId || "PUSH"}] ❌ 커밋 ${i + 1}/${commits.length} 저장 실패:`, {
          message: commitError.message,
          commit: {
            id: commit.id,
            author: commit.author,
            message: commit.message?.substring(0, 50),
          },
        });
        // 개별 커밋 저장 실패해도 계속 진행
      }
    }

    // WebSocket으로 알림 전송
    try {
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
                  branch: payload.ref ? payload.ref.replace("refs/heads/", "") : "main",
                  commits: commits.length,
                  taskId: taskRepo.taskId,
                },
              });
              console.log(`[${requestId || "PUSH"}] 📡 WebSocket 알림 전송: 팀 ${task.teamId}`);
            } else {
              console.warn(`[${requestId || "PUSH"}] ⚠️ 업무를 찾을 수 없음: taskId=${taskRepo.taskId}`);
            }
          } else {
            console.warn(`[${requestId || "PUSH"}] ⚠️ TaskGitHubRepository를 찾을 수 없음: repositoryId=${repository.id}`);
          }
        } else {
          // 팀 레포지토리
          chatWSS.broadcastToTeam(repository.teamId, {
            type: "github_activity",
            data: {
              type: "push",
              repository: `${repository.owner}/${repository.repo}`,
              branch: payload.ref ? payload.ref.replace("refs/heads/", "") : "main",
              commits: commits.length,
            },
          });
          console.log(`[${requestId || "PUSH"}] 📡 WebSocket 알림 전송: 팀 ${repository.teamId}`);
        }
      } else {
        console.warn(`[${requestId || "PUSH"}] ⚠️ WebSocket 서버를 찾을 수 없음`);
      }
    } catch (wsError) {
      console.error(`[${requestId || "PUSH"}] ❌ WebSocket 알림 전송 실패:`, {
        message: wsError.message,
        stack: wsError.stack,
      });
      // WebSocket 실패해도 계속 진행
    }
  } catch (error) {
    console.error(`[${requestId || "PUSH"}] ❌ Push 이벤트 처리 오류:`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    throw error; // 상위로 에러 전달
  }
}

// Pull Request 이벤트 처리
async function handlePullRequestEvent(payload, repository, isTaskRepository = false, requestId = null) {
  try {
    const pr = payload.pull_request;
    const action = payload.action;

    if (!pr) {
      console.error(`[${requestId || "PR"}] ❌ Pull Request 정보가 없습니다.`);
      throw new Error("Pull Request 정보가 없습니다.");
    }

    const author = pr.user?.login || pr.head?.user?.login || "Unknown";
    const title = pr.title || "";
    const branch = pr.head?.ref || pr.base?.ref || "main";
    const url = pr.html_url || pr.url || "";

    console.log(`[${requestId || "PR"}] 📝 Pull Request 처리 시작: ${action} by ${author}`);

    if (isTaskRepository) {
      // 업무별 레포지토리
      await prisma.taskGitHubActivity.create({
        data: {
          repositoryId: repository.id,
          type: "pull_request",
          action: action,
          author: author,
          message: title,
          branch: branch,
          url: url,
        },
      });
    } else {
      // 팀 레포지토리
      await prisma.gitHubActivity.create({
        data: {
          repositoryId: repository.id,
          type: "pull_request",
          action: action,
          author: author,
          message: title,
          branch: branch,
          url: url,
        },
      });
    }
    console.log(`[${requestId || "PR"}] ✅ Pull Request 저장 완료: ${action}`);

    // WebSocket으로 알림 전송
    try {
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
                  type: "pull_request",
                  action: action,
                  repository: `${repository.owner}/${repository.repo}`,
                  title: title,
                  author: author,
                  url: url,
                  taskId: taskRepo.taskId,
                },
              });
              console.log(`[${requestId || "PR"}] 📡 WebSocket 알림 전송: 팀 ${task.teamId}`);
            } else {
              console.warn(`[${requestId || "PR"}] ⚠️ 업무를 찾을 수 없음: taskId=${taskRepo.taskId}`);
            }
          } else {
            console.warn(`[${requestId || "PR"}] ⚠️ TaskGitHubRepository를 찾을 수 없음: repositoryId=${repository.id}`);
          }
        } else {
          // 팀 레포지토리
          chatWSS.broadcastToTeam(repository.teamId, {
            type: "github_activity",
            data: {
              type: "pull_request",
              action: action,
              repository: `${repository.owner}/${repository.repo}`,
              title: title,
              author: author,
              url: url,
            },
          });
          console.log(`[${requestId || "PR"}] 📡 WebSocket 알림 전송: 팀 ${repository.teamId}`);
        }
      } else {
        console.warn(`[${requestId || "PR"}] ⚠️ WebSocket 서버를 찾을 수 없음`);
      }
    } catch (wsError) {
      console.error(`[${requestId || "PR"}] ❌ WebSocket 알림 전송 실패:`, {
        message: wsError.message,
        stack: wsError.stack,
      });
      // WebSocket 실패해도 계속 진행
    }
  } catch (error) {
    console.error(`[${requestId || "PR"}] ❌ Pull Request 이벤트 처리 오류:`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    throw error; // 상위로 에러 전달
  }
}

module.exports = router;
