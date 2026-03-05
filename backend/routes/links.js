const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");

router.use(authenticate);

const extractMeta = (html) => {
  const getMeta = (property) => {
    const regex = new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    const match = html.match(regex);
    return match ? match[1] : null;
  };
  const getName = (name) => {
    const regex = new RegExp(
      `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    const match = html.match(regex);
    return match ? match[1] : null;
  };
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  return {
    title:
      getMeta("og:title") ||
      getName("title") ||
      (titleMatch ? titleMatch[1] : null),
    description: getMeta("og:description") || getName("description") || null,
    image: getMeta("og:image") || null,
  };
};

router.get("/preview", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url 파라미터가 필요합니다." });
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      return res.status(400).json({ error: "유효한 URL이 아닙니다." });
    }

    const response = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "TaskFlow Link Preview",
      },
    });

    if (!response.ok) {
      return res
        .status(400)
        .json({ error: "링크 정보를 가져오지 못했습니다." });
    }

    const html = await response.text();
    const meta = extractMeta(html);

    return res.json({
      url: targetUrl,
      ...meta,
    });
  } catch (error) {
    console.error("링크 미리보기 오류:", error);
    return res.status(500).json({ error: "서버 오류" });
  }
});

module.exports = router;
