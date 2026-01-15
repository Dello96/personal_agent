const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

/**
 * S3에 파일 업로드
 * @param {Object} file - multer 파일 객체 { buffer, originalname, mimetype }
 * @param {string} folder - S3 폴더 경로 (기본값: 'tasks')
 * @param {string} taskId - 업무 ID (선택사항, 폴더 구조화용)
 * @returns {Promise<string>} - 업로드된 파일의 Public URL
 */
const uploadToS3 = async (file, folder = "tasks", taskId = null) => {
  try {
    // 1. 파일 확장자 추출
    const fileExtension = path.extname(file.originalname).toLowerCase();

    // 2. 고유 파일명 생성 (UUID + 확장자)
    const uniqueFileName = `${uuidv4()}${fileExtension}`;

    // 3. S3 키 생성 (경로 구조)
    // 예: tasks/task-123/abc-123.jpg 또는 tasks/abc-123.jpg
    const s3Key = taskId
      ? `${folder}/${taskId}/${uniqueFileName}`
      : `${folder}/${uniqueFileName}`;

    // 4. 파일 업로드 명령 생성
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: file.buffer, // multer가 메모리에 저장한 파일 버퍼
      ContentType: file.mimetype, // 이미지 타입 (image/jpeg, image/png 등)
    });

    // 5. S3에 업로드 실행
    await s3Client.send(uploadCommand);

    // 6. Public URL 생성
    const publicUrl = `${process.env.S3_BUCKET_URL}/${s3Key}`;
    // 또는
    // const publicUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    return publicUrl;
  } catch (error) {
    console.error("S3 업로드 오류:", error);
    throw new Error(`파일 업로드 실패: ${error.message}`);
  }
};

module.exports = { uploadToS3 };
