import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";

export const repository = "Gggyh494/stage-visual-portfolio";
const remote = "https://Gggyh494@github.com/Gggyh494/stage-visual-portfolio.git";
const branch = "refs/heads/main";
const exec = promisify(execFile);

export function mediaSlots(model) {
  const slots = [];
  const add = (id, label, kind, target, key, heroMotion = false) => {
    const src = kind === "video" && key === "src" && !heroMotion ? (target.externalUrl || target[key]) : target?.[key];
    slots.push({ id, label, kind, target, key, heroMotion, src: src || "" });
  };
  const video = (id, label, target) => {
    if (!target) return;
    add(id, label, "video", target, "src");
    add(id + "-poster", label + "封面", "image", target, "poster");
  };
  add("hero-image", "首页 · 首屏图", "image", model.hero, "image");
  add("hero-loop", "首页 · 首屏默认循环视频", "video", model.hero, "loopVideo");
  video("hero-reel", "首页 · 作品混剪", model.hero.reel);
  for (const project of model.projects) {
    const id = project.id;
    const name = project.name;
    add(id + ":hero-motion", name + " · 首屏循环视频", "video", model.hero.motion, id, true);
    add(id + ":cover", name + " · 项目封面", "image", project, "cover");
    add(id + ":card", name + " · 列表图", "image", project, "cardImage");
    video(id + ":video", name + " · 现场片段", project.video);
    for (const [index, item] of (project.gallery || []).entries()) {
      const key = id + ":gallery:" + index;
      const label = name + " · " + item.label;
      if (item.type === "video") video(key, label, item);
      else add(key, label, "image", item, "src");
    }
  }
  return slots;
}

export async function openGitHubWorkspace(root) {
  const temporary = join(root, ".editor-tmp");
  await mkdir(temporary, { recursive: true });
  const parent = await realpath(temporary);
  if (parent !== join(await realpath(root), ".editor-tmp")) throw new Error("编辑器暂存目录必须在作品集文件夹内。");
  const dir = await mkdtemp(join(parent, "github-"));
  async function close() {
    const resolved = await realpath(dir).catch(() => null);
    if (resolved && dirname(resolved) === parent && basename(resolved).startsWith("github-")) {
      await rm(resolved, { recursive: true, force: true, maxRetries: 3 });
    }
  }

  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_ASKPASS", "SSH_ASKPASS", "GIT_CURL_VERBOSE"]) delete env[key];
  for (const key of Object.keys(env)) if (key.startsWith("GIT_TRACE") || key.startsWith("GIT_CONFIG_")) delete env[key];
  const git = async (...args) => {
    const { stdout } = await exec("git", [
      "-c", "core.hooksPath=" + join(dir, ".git", "stage-no-hooks"),
      "-c", "core.symlinks=false", "-c", "credential.username=Gggyh494", "-c", "http.followRedirects=false", ...args,
    ], { cwd: dir, env, timeout: 120_000, windowsHide: true });
    return stdout.trim();
  };
  const revision = () => git("rev-parse", "--verify", "HEAD");
  const restore = (sha) => git("reset", "--hard", sha);
  try {
    if (await git("ls-remote", "--get-url", remote) !== remote) throw new Error("Git 地址被改写。");
    await git("clone", "--quiet", "--depth", "1", "--single-branch", "--branch", "main", "--no-tags", "--", remote, ".");
    await git("remote", "set-url", "--push", "origin", remote);
    if (await git("remote", "get-url", "--push", "origin") !== remote) throw new Error("Git 推送地址被改写。");
  } catch {
    await close();
    throw new Error("无法打开作品集仓库。请检查网络、Git 安装和本机 Git 设置。");
  }
  try {
    await git("push", "--dry-run", "--porcelain", "--no-verify", "--", "origin", "HEAD:" + branch);
  } catch {
    await close();
    throw new Error("本机 GitHub 登录无法写入此仓库。请检查已有的 Git 登录，或到 GitHub 网页上传素材。");
  }

  async function refresh() {
    try {
      await git("fetch", "--quiet", "--depth", "1", "--no-tags", "--", remote, branch);
      const latest = await git("rev-parse", "--verify", "FETCH_HEAD");
      if (latest !== await revision()) await restore(latest);
      return latest;
    } catch {
      throw Object.assign(new Error("暂时无法读取线上版本，请稍后重试。"), { status: 502 });
    }
  }

  async function publish(asset) {
    await git("add", "--", "docs/portfolio.json", "docs/" + asset);
    await git("-c", "user.name=Gggyh494", "-c", "user.email=343306003+Gggyh494@users.noreply.github.com",
      "commit", "--quiet", "--no-gpg-sign", "-m", "chore: replace portfolio media");
    const sha = await revision();
    try {
      if (await git("remote", "get-url", "--push", "origin") !== remote) throw new Error("Git 推送地址被改写。");
      await git("push", "--porcelain", "--no-verify", "--", "origin", sha + ":" + branch);
    } catch {
      const remoteHead = await git("ls-remote", "--heads", "--", remote, branch).catch(() => "");
      if (remoteHead.split(/\s+/)[0] !== sha) {
        throw Object.assign(new Error("GitHub 未确认提交。请检查本机 Git 登录或线上是否有新提交，再重试。"), { status: 409 });
      }
    }
    return sha;
  }

  return { dir, revision, refresh, restore, publish, close };
}
