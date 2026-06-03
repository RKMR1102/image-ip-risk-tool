const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { URL } = require("url");
const { DEFAULT_LIBRARY_ROOT, STORE_FILE } = require("./api/_lib/store");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3100);
const ROOT_DIR = __dirname;

const apiHandlers = {
  "/api/library": require("./api/library"),
  "/api/analyze": require("./api/analyze"),
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(requestUrl.pathname);

    if (apiHandlers[pathname]) {
      await apiHandlers[pathname](req, res);
      return;
    }

    await serveStaticFile(pathname, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(`服务启动后处理请求失败：${error.message}`);
  }
});

server.listen(PORT, HOST, () => {
  const lanUrls = getLanUrls(PORT);
  console.log("");
  console.log("图像侵权风险系统已启动");
  console.log(`本地访问: http://localhost:${PORT}`);
  lanUrls.forEach((url) => console.log(`局域网访问: ${url}`));
  console.log(`图库根目录: ${DEFAULT_LIBRARY_ROOT}`);
  console.log(`图库数据文件: ${STORE_FILE}`);
  console.log("");
  console.log("页面入口：");
  console.log(`- 首页: http://localhost:${PORT}/index.html`);
  console.log(`- 管理端: http://localhost:${PORT}/admin.html`);
  console.log(`- 分析端: http://localhost:${PORT}/check.html`);
  console.log("");
});

async function serveStaticFile(pathname, res) {
  const targetPath = resolveStaticPath(pathname);
  if (!targetPath) {
    sendNotFound(res);
    return;
  }

  const safeRoot = path.resolve(ROOT_DIR);
  const safeTarget = path.resolve(targetPath);
  if (!safeTarget.startsWith(safeRoot)) {
    sendNotFound(res);
    return;
  }

  try {
    const stat = await fs.promises.stat(safeTarget);
    if (!stat.isFile()) {
      sendNotFound(res);
      return;
    }

    const ext = path.extname(safeTarget).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypes[ext] || "application/octet-stream");
    fs.createReadStream(safeTarget).pipe(res);
  } catch (_) {
    sendNotFound(res);
  }
}

function resolveStaticPath(pathname) {
  if (pathname === "/") {
    return path.join(ROOT_DIR, "index.html");
  }

  const cleanPath = pathname.replace(/^\/+/, "");
  const directFile = path.join(ROOT_DIR, cleanPath);
  if (fs.existsSync(directFile)) {
    return directFile;
  }

  if (!path.extname(cleanPath)) {
    const htmlFile = path.join(ROOT_DIR, `${cleanPath}.html`);
    if (fs.existsSync(htmlFile)) {
      return htmlFile;
    }
  }

  return null;
}

function sendNotFound(res) {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("未找到对应页面或资源。");
}

function getLanUrls(port) {
  const urls = [];
  const networkMap = os.networkInterfaces();
  for (const addresses of Object.values(networkMap)) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) {
        urls.push(`http://${address.address}:${port}`);
      }
    }
  }
  return urls;
}
