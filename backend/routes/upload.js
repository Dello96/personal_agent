const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const authenticate = require("../middleware/auth");
const { uploadToS3 } = require("../utils/uploadToS3");

// 인증 미들웨어 적용
router.use(authenticate);

// Multer 설정 (메모리 스토리지 사용 - S3로 바로 전송)
const storage = multer.memoryStorage();

// 파일 필터: 이미지만 허용
const imageFileFilter = (req, file, cb) => {
  // 허용할 이미지 MIME 타입
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true); // 허용
  } else {
    cb(
      new Error("이미지 파일만 업로드 가능합니다. (JPEG, PNG, GIF, WebP)"),
      false
    );
  }
};

const chatFileFilter = (req, file, cb) => {
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "이미지/영상만 업로드 가능합니다. (JPEG, PNG, GIF, WebP, MP4, WebM, MOV)"
      ),
      false
    );
  }
};

// Multer 미들웨어 설정
const upload = multer({
  storage: storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB 제한
  },
});

const chatUpload = multer({
  storage: storage,
  fileFilter: chatFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB 제한
  },
});

const normalizeFilename = (name) => {
  if (!name || typeof name !== "string") return "attachment";
  try {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    if (decoded && decoded !== name) return decoded;
  } catch (error) {
    // fall through
  }
  return name;
};

const sanitizeFilename = (name) => {
  const base = normalizeFilename(name).trim();
  if (!base) return "attachment";
  return base.replace(/[\\/:*?"<>|]/g, "_");
};

/**
 * POST /api/upload
 * 단일 이미지 업로드
 */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    // 1. 파일 존재 확인
    if (!req.file) {
      return res.status(400).json({ error: "이미지 파일이 필요합니다." });
    }

    // 2. 파일 크기 재확인 (추가 검증)
    if (req.file.size > 5 * 1024 * 1024) {
      return res
        .status(400)
        .json({ error: "파일 크기는 5MB를 초과할 수 없습니다." });
    }

    // 3. taskId가 쿼리 파라미터로 전달되면 사용 (선택사항)
    const taskId = req.query.taskId || null;

    // 4. S3에 업로드
    const imageUrl = await uploadToS3(req.file, "tasks", taskId);

    // 5. 성공 응답
    res.status(200).json({
      success: true,
      imageUrl: imageUrl,
      message: "이미지가 성공적으로 업로드되었습니다.",
    });
  } catch (error) {
    console.error("이미지 업로드 오류:", error);

    // Multer 에러 처리
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: "파일 크기는 5MB를 초과할 수 없습니다." });
      }
      return res
        .status(400)
        .json({ error: `파일 업로드 오류: ${error.message}` });
    }

    res.status(500).json({
      error: "이미지 업로드에 실패했습니다.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * POST /api/upload/profile
 * 프로필 이미지 업로드
 */
router.post("/profile", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "이미지 파일이 필요합니다." });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res
        .status(400)
        .json({ error: "파일 크기는 5MB를 초과할 수 없습니다." });
    }

    const imageUrl = await uploadToS3(req.file, "profiles", null);

    res.status(200).json({
      success: true,
      imageUrl: imageUrl,
      message: "프로필 이미지가 성공적으로 업로드되었습니다.",
    });
  } catch (error) {
    console.error("프로필 이미지 업로드 오류:", error);

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: "파일 크기는 5MB를 초과할 수 없습니다." });
      }
      return res
        .status(400)
        .json({ error: `파일 업로드 오류: ${error.message}` });
    }

    res.status(500).json({
      error: "이미지 업로드에 실패했습니다.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * POST /api/upload/chat
 * 채팅 이미지/영상 업로드
 */
router.post("/chat", chatUpload.array("files", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "파일이 필요합니다." });
    }

    const uploadResults = await Promise.all(
      req.files.map(async (file) => {
        const fileUrl = await uploadToS3(file, "chat", null);
        return {
          url: fileUrl,
          type: file.mimetype.startsWith("video") ? "video" : "image",
          name: sanitizeFilename(file.originalname),
          size: file.size,
        };
      })
    );

    res.status(200).json({
      success: true,
      files: uploadResults,
      count: uploadResults.length,
      message: "첨부파일이 업로드되었습니다.",
    });
  } catch (error) {
    console.error("채팅 파일 업로드 오류:", error);
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: "파일 크기는 20MB를 초과할 수 없습니다." });
      }
      return res
        .status(400)
        .json({ error: `파일 업로드 오류: ${error.message}` });
    }

    res.status(500).json({
      error: "파일 업로드에 실패했습니다.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * GET /api/upload/download
 * S3 파일 다운로드 프록시
 */
router.get("/download", async (req, res) => {
  try {
    const { url, name } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url 파라미터가 필요합니다." });
    }

    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (error) {
      return res.status(400).json({ error: "유효한 URL이 아닙니다." });
    }

    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return res.status(400).json({ error: "지원하지 않는 URL입니다." });
    }

    const allowedHosts = new Set();
    if (process.env.S3_BUCKET_URL) {
      try {
        allowedHosts.add(new URL(process.env.S3_BUCKET_URL).hostname);
      } catch (error) {
        // ignore
      }
    }
    if (process.env.S3_BUCKET_NAME && process.env.AWS_REGION) {
      allowedHosts.add(
        `${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`
      );
    }

    if (allowedHosts.size > 0 && !allowedHosts.has(targetUrl.hostname)) {
      return res.status(400).json({ error: "허용되지 않은 파일 주소입니다." });
    }

    const response = await fetch(targetUrl.toString(), { redirect: "follow" });
    if (!response.ok) {
      return res.status(400).json({ error: "파일을 불러오지 못했습니다." });
    }

    const filename = sanitizeFilename(
      typeof name === "string" && name
        ? name
        : path.basename(targetUrl.pathname)
    );
    const encodedFilename = encodeURIComponent(filename)
      .replace(/'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29");

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodedFilename}`
    );

    const buffer = Buffer.from(await response.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("파일 다운로드 오류:", error);
    return res.status(500).json({ error: "서버 오류" });
  }
});

/**
 * POST /api/upload/multiple
 * 여러 이미지 일괄 업로드
 */
router.post("/multiple", upload.array("images", 5), async (req, res) => {
  try {
    // 1. 파일 존재 확인
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "이미지 파일이 필요합니다." });
    }

    // 2. 파일 개수 제한 확인
    if (req.files.length > 5) {
      return res
        .status(400)
        .json({ error: "최대 5개의 이미지만 업로드할 수 있습니다." });
    }

    // 3. taskId가 쿼리 파라미터로 전달되면 사용
    const taskId = req.query.taskId || null;

    // 4. 모든 파일을 S3에 업로드 (병렬 처리)
    const uploadPromises = req.files.map((file) =>
      uploadToS3(file, "tasks", taskId)
    );

    const imageUrls = await Promise.all(uploadPromises);

    // 5. 성공 응답
    res.status(200).json({
      success: true,
      imageUrls: imageUrls,
      count: imageUrls.length,
      message: `${imageUrls.length}개의 이미지가 성공적으로 업로드되었습니다.`,
    });
  } catch (error) {
    console.error("다중 이미지 업로드 오류:", error);
    res.status(500).json({
      error: "이미지 업로드에 실패했습니다.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
