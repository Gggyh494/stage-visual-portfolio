import { createServer } from "node:http";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const root = fileURLToPath(new URL(".", import.meta.url));
const site = join(root, "docs");
const editor = join(root, "editor");
const contentPath = join(site, "portfolio.json");
const temp = join(root, ".editor-tmp");
const uploads = join(site, "media", "uploads");
const port = Number(process.env.STAGE_EDITOR_PORT || 8788);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid editor port");
const host = "127.0.0.1:" + port;
const origin = "http://" + host;
const projectMount = "/portfolio-preview/";
const nonce = randomBytes(24).toString("hex");
const uploadLimit = 90 * 1024 * 1024;
const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".avif": "image/avif", ".mp4": "video/mp4", ".webm": "video/webm",
};
const revisionOf = (text) => createHash("sha256").update(text).digest("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const imageExts = new Set(Object.keys(mime).filter((ext) => mime[ext].startsWith("image/")));
const videoExts = new Set([".mp4", ".webm"]);
let saving = false;

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
};
function send(res, status, payload) {
  res.writeHead(status, { ...headers, "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
function validId(value) { return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value); }
function string(value, label, required = false, max = 2000) {
  if (value == null && !required) return "";
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    throw fail(422, label + "不能为空或超过 " + max + " 字。");
  }
  return value.trim();
}

async function verifyMedia(value, kind, label, required = false, externalOnly = false) {
  const ref = string(value, label, required, 2048);
  if (!ref) return;
  if (/^https:\/\//i.test(ref)) {
    const url = URL.parse(ref);
    if (url?.protocol === "https:" && !url.username && !url.password) return;
    throw fail(422, label + "需要有效的 HTTPS 媒体地址。");
  }
  if (externalOnly) throw fail(422, label + "需要 HTTPS 地址。");
  const path = ref.replace(/^\/?(?:docs\/)?media\//, "media/");
  const segments = path.split("/");
  if (segments.length < 2 || segments[0] !== "media" || segments.some((part) => !part || part.startsWith(".") || /[\\:%?#\x00-\x1f]/.test(part))) {
    throw fail(422, label + "需要是 media/ 下的文件或 HTTPS 地址。");
  }
  if (!(kind === "image" ? imageExts : videoExts).has(extname(path).toLowerCase())) {
    throw fail(422, label + (kind === "image" ? "需要是图片文件。" : "需要 MP4 或 WebM。"));
  }
  if (!(await stat(join(site, path), { throwIfNoEntry: false }))?.isFile()) {
    throw fail(422, label + "找不到文件：" + ref);
  }
}

async function verifyVideo(value, label) {
  if (value == null) return;
  if (!isObject(value)) throw fail(422, label + "格式有误。");
  await verifyMedia(value.externalUrl, "video", label + "的外部地址", false, true);
  await verifyMedia(value.src, "video", label);
  await verifyMedia(value.poster, "image", label + "的封面");
  for (const key of ["title", "note", "credit", "creditUrl"]) string(value[key], label + "的说明");
}

async function verifyContent(value) {
  if (!isObject(value) || !isObject(value.studio) || !isObject(value.hero) ||
    !Array.isArray(value.projects) || !Array.isArray(value.categories) || !Array.isArray(value.services)) {
    throw fail(422, "缺少工作室、首页或项目数据。");
  }
  const { studio, hero, projects, categories, services } = value;
  string(studio.name, "工作室名称", true, 60);
  string(studio.english, "工作室副标题", true, 100);
  const email = string(studio.email, "邮箱", false, 160);
  if (email && !/^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/.test(email)) throw fail(422, "请输入有效的合作邮箱。");
  if (typeof studio.demo !== "boolean") throw fail(422, "示例标记格式有误。");
  string(hero.title, "首页标题", true, 60);
  for (const key of ["intro", "caption", "alt"]) string(hero[key], "首页文案");
  await verifyMedia(hero.image, "image", "首页封面");
  await verifyVideo(hero.reel, "首页片段");
  for (const key of ["workIntro", "servicesIntro", "contactDescription"]) string(value[key], "网站介绍");
  if (!categories.length || categories.length > 20) throw fail(422, "请保留 1–20 个作品类别。");
  const tags = new Set();
  for (const category of categories) {
    if (!isObject(category) || !validId(category.id) || tags.has(category.id)) throw fail(422, "类别 ID 无效或重复。");
    string(category.label, "类别名称", true, 80);
    tags.add(category.id);
  }
  if (services.length > 15) throw fail(422, "服务项目最多 15 项。");
  for (const service of services) {
    if (!isObject(service)) throw fail(422, "服务格式有误。");
    string(service.name, "服务名称", true, 100);
    string(service.en, "服务英文名称");
    string(service.description, "服务说明");
  }
  if (!projects.length || projects.length > 40) throw fail(422, "请保留 1–40 个项目。");
  const ids = new Set();
  for (const [index, project] of projects.entries()) {
    const label = "项目 " + (index + 1) + "（" + (project?.name || "未命名") + "）";
    if (!isObject(project) || !validId(project.id) || ids.has(project.id) || !tags.has(project.category)) {
      throw fail(422, label + "的 ID 无效、重复，或类别不存在。");
    }
    ids.add(project.id);
    string(project.name, label + "名称", true, 100);
    for (const key of ["en", "coverAlt", "cardAlt", "hook", "occasion", "scope", "deliveries", "brief", "concept"]) string(project[key], label + "的文案");
    await verifyMedia(project.cover, "image", label + "的封面", true);
    await verifyMedia(project.cardImage, "image", label + "的列表图");
    await verifyVideo(project.video, label + "的现场片段");
    if (project.gallery != null && (!Array.isArray(project.gallery) || project.gallery.length > 15)) throw fail(422, label + "最多添加 15 个媒体项。");
    for (const [n, entry] of (project.gallery || []).entries()) {
      const mediaLabel = label + "的媒体 " + (n + 1);
      if (!isObject(entry) || !["image", "video"].includes(entry.type)) throw fail(422, mediaLabel + "类型无效。");
      string(entry.label, mediaLabel + "名称", true, 70);
      for (const key of ["alt", "note", "credit", "creditUrl"]) string(entry[key], mediaLabel + "说明");
      if (entry.type === "image") await verifyMedia(entry.src, "image", mediaLabel, true);
      else {
        if (!entry.src && !entry.externalUrl) throw fail(422, mediaLabel + "没有视频文件或地址。");
        await verifyVideo(entry, mediaLabel);
      }
    }
  }
  if (hero.featured && !ids.has(hero.featured)) throw fail(422, "首页主推项目不存在。");
}

async function mediaFiles() {
  const out = [];
  for (const directory of ["media", "media/uploads"]) {
    const items = await readdir(join(site, directory), { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const item of items) {
      if (item.isFile() && (imageExts.has(extname(item.name).toLowerCase()) || videoExts.has(extname(item.name).toLowerCase()))) {
        out.push(directory + "/" + item.name);
      }
    }
  }
  return out.sort();
}

async function getState(res) {
  const [raw, files] = await Promise.all([readFile(contentPath, "utf8"), mediaFiles()]);
  send(res, 200, { token: nonce, revision: revisionOf(raw), model: JSON.parse(raw), files });
}

async function readBody(req, limit) {
  const parts = [];
  let total = 0;
  for await (const part of req) {
    total += part.length;
    if (total > limit) throw fail(413, "内容超过本地编辑限制。");
    parts.push(part);
  }
  return Buffer.concat(parts).toString("utf8");
}

async function save(req, res) {
  if (saving) throw fail(409, "正在保存，请稍后再试。");
  saving = true;
  const temporary = join(temp, randomUUID() + ".json");
  try {
    let parsed;
    const body = await readBody(req, 512 * 1024);
    try { parsed = JSON.parse(body); } catch { throw fail(400, "保存的数据不是有效 JSON。"); }
    if (!isObject(parsed)) throw fail(400, "保存请求格式不正确。");
    const previous = await readFile(contentPath, "utf8");
    if (parsed.revision !== revisionOf(previous)) throw fail(409, "内容已在别处更新。请先刷新管理页再保存。");
    await verifyContent(parsed.model);
    const output = JSON.stringify(parsed.model, null, 2) + "\n";
    await mkdir(temp, { recursive: true });
    await writeFile(temporary, output, { flag: "wx" });
    await rename(temporary, contentPath);
    send(res, 200, { revision: revisionOf(output) });
  } finally {
    saving = false;
    await rm(temporary, { force: true });
  }
}

function matchesSignature(bytes, extension) {
  const four = (start) => bytes.subarray(start, start + 4).toString("ascii");
  if (extension === ".png") return bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  if (extension === ".jpg" || extension === ".jpeg") return bytes.subarray(0, 3).toString("hex") === "ffd8ff";
  if (extension === ".webp") return four(0) === "RIFF" && four(8) === "WEBP";
  if (extension === ".gif") return /^GIF8[79]a/.test(bytes.toString("ascii"));
  if (extension === ".avif") return four(4) === "ftyp" && /\bavi[fs]/.test(bytes.toString("ascii"));
  if (extension === ".mp4") return four(4) === "ftyp";
  if (extension === ".webm") return four(0) !== "" && bytes.subarray(0, 4).toString("hex") === "1a45dfa3";
  return false;
}

async function upload(req, res, url) {
  const name = url.searchParams.get("name") || "";
  const extension = extname(name).toLowerCase();
  if (!imageExts.has(extension) && !videoExts.has(extension)) throw fail(415, "请选择常见图片、MP4 或 WebM。");
  const length = Number(req.headers["content-length"]);
  if (!Number.isSafeInteger(length) || length < 1) throw fail(411, "请选择有效的本地文件。");
  if (length > uploadLimit) throw fail(413, "单个文件请控制在 90 MB 以内。长视频可用 HTTPS 直链。");
  const id = randomUUID();
  const nameStem = name.slice(0, -extension.length).replace(/[^a-z0-9_-]+/gi, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 45) || "stage";
  const finalName = nameStem + "-" + id.slice(0, 12) + extension;
  const temporary = join(temp, id + ".upload");
  await Promise.all([mkdir(temp, { recursive: true }), mkdir(uploads, { recursive: true })]);
  try {
    let actual = 0;
    const limited = new Transform({
      transform(chunk, _, callback) {
        actual += chunk.length;
        if (actual > uploadLimit) callback(fail(413, "文件太大。"));
        else callback(null, chunk);
      },
    });
    await pipeline(req, limited, createWriteStream(temporary, { flags: "wx" }));
    const file = await open(temporary, "r");
    try {
      const { buffer, bytesRead } = await file.read(Buffer.alloc(96), 0, 96, 0);
      if (!matchesSignature(buffer.subarray(0, bytesRead), extension)) throw fail(415, "文件内容和扩展名不匹配。");
    } finally { await file.close(); }
    await rename(temporary, join(uploads, finalName));
    send(res, 201, { path: "media/uploads/" + finalName });
  } finally { await rm(temporary, { force: true }); }
}

async function serve(req, res, dir, relative, privatePage = false) {
  if (relative.includes("\\") || relative.split("/").some((part) => part.startsWith("."))) throw fail(404, "找不到页面。");
  const file = resolve(dir, relative);
  if (!file.startsWith(dir + sep)) throw fail(404, "找不到页面。");
  const type = mime[extname(file).toLowerCase()];
  const info = type ? await stat(file, { throwIfNoEntry: false }) : null;
  if (!info?.isFile()) throw fail(404, "找不到页面。");
  const output = { ...headers, "Content-Type": type, "Accept-Ranges": "bytes" };
  if (privatePage) output["Content-Security-Policy"] = "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; form-action 'none'; frame-ancestors 'none'";
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
  let options;
  if (range) {
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) { res.writeHead(416, { "Content-Range": "bytes */" + info.size }).end(); return; }
    options = { start, end };
    output["Content-Range"] = "bytes " + start + "-" + end + "/" + info.size;
  }
  output["Content-Length"] = options ? options.end - options.start + 1 : info.size;
  res.writeHead(options ? 206 : 200, output);
  if (req.method === "HEAD") res.end();
  else {
    const stream = createReadStream(file, options);
    stream.on("error", () => res.destroy());
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== host) throw fail(403, "请通过本机管理地址访问。");
    const url = new URL(req.url, origin);
    if (url.origin !== origin) throw fail(403, "仅允许本机访问。");
    const path = decodeURIComponent(url.pathname);
    if (path.startsWith("/_editor/api/")) {
      if (req.headers["sec-fetch-site"] === "cross-site" || (req.headers.origin && req.headers.origin !== origin)) throw fail(403, "来源不允许。");
      if (req.method === "GET" && path === "/_editor/api/state") return await getState(res);
      if (req.method !== "POST") throw fail(405, "请求方式不支持。");
      if (req.headers.origin !== origin || req.headers["x-stage-editor"] !== nonce) throw fail(403, "编辑会话已失效，请刷新管理页。");
      if (path === "/_editor/api/save") return await save(req, res);
      if (path === "/_editor/api/upload") return await upload(req, res, url);
      throw fail(404, "找不到操作。");
    }
    if (!["GET", "HEAD"].includes(req.method)) throw fail(405, "请求方式不支持。");
    if (path === "/_editor/") return await serve(req, res, editor, "index.html", true);
    if (path === "/_editor/app.js" || path === "/_editor/styles.css") return await serve(req, res, editor, path.slice(9), true);
    const publicPath = path.startsWith(projectMount) ? path.slice(projectMount.length) : path.slice(1);
    const file = publicPath.endsWith("/") ? publicPath + "index.html" : (publicPath || "index.html");
    return await serve(req, res, site, file);
  } catch (error) {
    if (res.headersSent || res.destroyed) return;
    if (!error.status) console.error(error.message);
    send(res, error.status || 500, { error: error.status ? error.message : "本地服务出错，请查看终端。" });
  }
});
server.listen(port, "127.0.0.1", () => {
  console.log("作品集预览: " + origin + "/");
  console.log("本机素材管理: " + origin + "/_editor/");
});
