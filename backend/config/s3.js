// S3 클라이언트 초기화 및 설정
const { S3Client } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
dotenv.config({ path: "../.env.local" });

const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

// ECS에서는 Task Role(기본 자격증명 체인)을 우선 사용하고,
// 로컬 환경에서는 .env 자격증명을 사용한다.
const clientConfig = { region };
if (accessKeyId && secretAccessKey) {
  clientConfig.credentials = { accessKeyId, secretAccessKey };
}

const s3Client = new S3Client(clientConfig);

module.exports = { s3Client };
