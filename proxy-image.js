function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "不支持的请求方法。" });
    return;
  }

  try {
    const rawUrl = Array.isArray(req.query?.url) ? req.query.url[0] : req.query?.url;
    const imageUrl = String(rawUrl || "");
    let parsed;
    try {
      parsed = new URL(imageUrl);
    } catch {
      sendJson(res, 400, { error: "图片地址不正确。" });
      return;
    }

    if (!/^https?:$/.test(parsed.protocol)) {
      sendJson(res, 400, { error: "只支持 http 或 https 图片地址。" });
      return;
    }

    const response = await fetch(parsed.href, {
      headers: { "User-Agent": "Mozilla/5.0 image-ip-risk-tool/1.0" },
    });
    if (!response.ok) {
      sendJson(res, 502, { error: "结果图片来源暂时无法读取，请打开来源页后下载。" });
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      sendJson(res, 415, { error: "该结果不是可读取的图片。" });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
      sendJson(res, 413, { error: "结果图片超过 10MB，无法直接对比。" });
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", contentType.split(";")[0]);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(buffer);
  } catch (error) {
    sendJson(res, 502, { error: error.message || "结果图片读取失败。" });
  }
};
