(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
  let model, token, revision;
  let files = [];
  let active = "site";
  let busy = false;
  let dirty = false;

  const valueAt = (path) => path.split(".").reduce((value, key) => value?.[key], model);
  function assign(path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    let target = model;
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      target = target[key];
    }
    target[last] = value;
  }

  function status(message, kind = "") {
    $("status").textContent = message;
    $("status").dataset.kind = kind;
  }
  function updateControls() {
    $("save").disabled = busy || !model || !dirty;
    $("editor-fields").disabled = busy || !model;
    $("add-project").disabled = busy || !model || model.projects.length >= 40;
  }
  function changed() {
    dirty = true;
    updateControls();
    status("有未保存的更改。");
  }

  async function api(action, options = {}) {
    const response = await fetch("api/" + action, { cache: "no-store", ...options });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "操作失败，请重试。");
    return payload;
  }

  function field(label, path, settings = {}) {
    const current = escape(valueAt(path));
    const name = escape(path);
    const required = settings.required ? " required" : "";
    const hint = settings.hint ? `<small class="hint">${escape(settings.hint)}</small>` : "";
    let input;
    if (settings.choices) {
      const items = settings.choices.map(({ value, label }) => `<option value="${escape(value)}"${String(valueAt(path) ?? "") === value ? " selected" : ""}>${escape(label)}</option>`).join("");
      input = `<select name="${name}"${required}${settings.refresh ? ' data-refresh="true"' : ""}>${items}</select>`;
    } else if (settings.area) {
      input = `<textarea name="${name}" rows="${settings.rows || 3}" maxlength="2000"${required}>${current}</textarea>`;
    } else {
      input = `<input name="${name}" type="${settings.type || "text"}" value="${current}" maxlength="${settings.max || 240}"${required}${settings.list ? ' list="media-files"' : ""} autocomplete="off">`;
    }
    return `<label class="field${settings.wide ? " wide" : ""}"><span>${escape(label)}</span>${input}${hint}</label>`;
  }

  function assetUrl(path) {
    if (typeof path !== "string" || !path) return "";
    const clean = path.replace(/^\/?(?:docs\/)?media\//, "/media/");
    if (clean.startsWith("/media/") && !clean.includes("..")) return clean;
    const url = URL.parse(clean);
    return url?.protocol === "https:" && !url.username && !url.password ? url.href : "";
  }

  function media(label, path, kind, settings = {}) {
    const current = assetUrl(valueAt(path));
    const accept = kind === "image" ? ".jpg,.jpeg,.png,.webp,.gif,.avif" : ".mp4,.webm";
    return `<div class="media-control wide">
      ${field(label, path, { ...settings, list: true, max: 2048, wide: false, hint: "" })}
      <label class="upload-button"><span>上传文件</span><input type="file" data-upload="${escape(path)}" data-kind="${kind}" accept="${accept}" aria-label="上传${escape(label)}"></label>
      ${settings.hint ? `<p class="hint">${escape(settings.hint)}</p>` : ""}
      ${kind === "image" && current ? `<img class="asset-preview" src="${escape(current)}" alt="" loading="lazy">` : ""}
    </div>`;
  }

  function videoFields(path) {
    return `<div class="grid">
      ${media("本地视频", path + ".src", "video", { hint: "MP4 / WebM，每个文件最多 90 MB。" })}
      ${field("视频 HTTPS 直链（可选）", path + ".externalUrl", { wide: true, max: 2048, hint: "直链优先于本地视频。大文件可以放在对象存储或 CDN 上。" })}
      ${media("视频封面（可选）", path + ".poster", "image")}
      ${field("片段标题", path + ".title", { max: 70 })}
      ${field("片段说明", path + ".note")}
      ${field("素材署名（可选）", path + ".credit")}
      ${field("素材来源链接（可选）", path + ".creditUrl", { max: 2048 })}
    </div>`;
  }

  function renderNav() {
    const site = document.querySelector('[data-view="site"]');
    site.setAttribute("aria-current", String(active === "site"));
    $("project-nav").innerHTML = model.projects.map((project, index) => `
      <button class="nav-row" type="button" data-view="${index}" aria-current="${active === index}">
        <span class="mono">${String(index + 1).padStart(2, "0")}</span><span>${escape(project.name || "未命名项目")}</span>
      </button>`).join("");
  }

  function renderSite() {
    const projects = [{ value: "", label: "使用首个项目" }, ...model.projects.map((p) => ({ value: p.id, label: p.name }))];
    return `<div class="page-heading"><div><h1>工作室与首页</h1><p>编辑访客最先看到的信息。保存后刷新作品集即可查看。</p></div></div>
      <section class="group"><h2>工作室</h2><div class="grid">
        ${field("工作室名称", "studio.name", { required: true, max: 60 })}
        ${field("英文副标题", "studio.english", { required: true, max: 100 })}
        ${field("合作邮箱", "studio.email", { type: "email", max: 160 })}
        ${field("商务微信号（可选）", "studio.wechat", { max: 80, hint: "访客可以在合作区复制微信号。" })}
        <label class="check"><input name="studio.contactPlaceholder" type="checkbox"${model.studio.contactPlaceholder === true ? " checked" : ""}>使用示例联系方式（正式使用前取消）</label>
        <label class="check"><input name="studio.demo" type="checkbox"${model.studio.demo ? " checked" : ""}>显示概念样板标记</label>
      </div></section>
      <section class="group"><h2>首屏与文案</h2><div class="grid">
        ${field("首屏标题", "hero.title", { required: true, max: 60 })}
        ${field("首屏介绍", "hero.intro")}
        ${field("首屏服务关键词", "hero.caption")}
        ${field("主推项目", "hero.featured", { choices: projects })}
        ${media("首屏封面（可选）", "hero.image", "image", { hint: "留空则使用主推项目的封面；建议选用 16:9 全景。" })}
        ${media("首屏默认循环视频（可选）", "hero.loopVideo", "video", { hint: "建议使用 16:9 无声 MP4。留空则使用主推项目的循环视频。" })}
        ${field("首屏封面说明", "hero.alt", { wide: true })}
        ${field("作品索引介绍", "workIntro", { wide: true, area: true })}
        ${field("服务介绍", "servicesIntro", { wide: true, area: true })}
        ${field("合作区说明", "contactDescription", { wide: true, area: true })}
      </div></section>
      <section class="group"><h2>首页片段</h2>${videoFields("hero.reel")}</section>
      <section class="group"><h2>服务</h2>
        ${model.services.map((_, i) => `<div class="grid media-item">
          ${field("服务名称", "services." + i + ".name", { required: true, max: 100 })}
          ${field("英文名称", "services." + i + ".en")}
          ${field("服务说明", "services." + i + ".description", { area: true, wide: true })}
        </div>`).join("")}
      </section>`;
  }

  function renderGallery(project, base) {
    return `<section class="group">
      <div class="gallery-head"><h2>大屏原画与预演</h2><button class="small" type="button" data-action="add-media">＋ 添加媒体</button></div>
      ${(project.gallery || []).map((item, i) => {
        const prefix = base + ".gallery." + i;
        const video = item.type === "video";
        return `<article class="media-item">
          <header><strong>${escape(item.label || "媒体 " + (i + 1))}</strong><div class="sub-actions">
            <button class="small" type="button" data-action="media-up" data-index="${i}"${i === 0 ? " disabled" : ""}>上移</button>
            <button class="small" type="button" data-action="media-down" data-index="${i}"${i === project.gallery.length - 1 ? " disabled" : ""}>下移</button>
            <button class="small danger" type="button" data-action="remove-media" data-index="${i}">移除</button>
          </div></header>
          <div class="grid">
            ${field("媒体名称", prefix + ".label", { required: true, max: 70 })}
            ${field("媒体类型", prefix + ".type", { refresh: true, choices: [{ value: "image", label: "图片" }, { value: "video", label: "视频" }] })}
            ${media(video ? "视频文件" : "原画图片", prefix + ".src", video ? "video" : "image", { required: !video })}
            ${video ? field("视频 HTTPS 直链（可选）", prefix + ".externalUrl", { wide: true, max: 2048 }) : field("图片说明", prefix + ".alt", { wide: true })}
            ${video ? media("视频封面（可选）", prefix + ".poster", "image") : ""}
            ${video ? `<label class="check wide"><input name="${prefix}.showcase" type="checkbox"${item.showcase ? " checked" : ""}>同时展示在首页展映区</label>` : ""}
            ${field("展示备注", prefix + ".note", { wide: true })}
          </div>
        </article>`;
      }).join("")}
    </section>`;
  }

  function renderProject() {
    const project = model.projects[active];
    const base = "projects." + active;
    return `<div class="page-heading"><div><h1>${escape(project.name || "未命名项目")}</h1><p>项目地址：#case/${escape(project.id)}</p></div>
        <div class="sub-actions">
          <button class="small" type="button" data-action="project-up"${active === 0 ? " disabled" : ""}>项目上移</button>
          <button class="small" type="button" data-action="project-down"${active === model.projects.length - 1 ? " disabled" : ""}>项目下移</button>
          <button class="small danger" type="button" data-action="remove-project"${model.projects.length <= 1 ? " disabled" : ""}>移除项目</button>
        </div>
      </div>
      <section class="group"><h2>项目简介</h2><div class="grid">
        ${field("项目名称", base + ".name", { required: true, max: 100 })}
        ${field("英文标题", base + ".en")}
        ${field("项目类别", base + ".category", { choices: model.categories.map((c) => ({ value: c.id, label: c.label })) })}
        ${field("使用场景", base + ".occasion")}
        ${field("一句话介绍", base + ".hook", { wide: true })}
        ${field("我们负责", base + ".scope")}
        ${field("交付内容", base + ".deliveries")}
        ${field("项目需求", base + ".brief", { area: true })}
        ${field("视觉方向", base + ".concept", { area: true })}
      </div></section>
      <section class="group"><h2>项目封面</h2><div class="grid">
        ${media("项目全景", base + ".cover", "image", { required: true })}
        ${field("项目全景说明", base + ".coverAlt", { wide: true })}
        ${media("索引图片（可选）", base + ".cardImage", "image", { hint: "留空使用项目全景。可选大屏原画，便于一眼看清项目区别。" })}
        ${field("索引图片说明", base + ".cardAlt", { wide: true })}
        ${media("项目首屏循环视频（可选）", "hero.motion." + project.id, "video", { hint: "切换到此精选项目时播放。建议使用 16:9 无声 MP4。" })}
      </div></section>
      <section class="group"><h2>现场片段</h2>${videoFields(base + ".video")}</section>
      ${renderGallery(project, base)}`;
  }

  function render() {
    renderNav();
    $("editor").innerHTML = active === "site" ? renderSite() : renderProject();
    $("media-files").innerHTML = files.map((file) => `<option value="${escape(file)}"></option>`).join("");
    updateControls();
  }
  const relocate = (array, from, to) => {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= array.length || to >= array.length) return false;
    [array[from], array[to]] = [array[to], array[from]];
    return true;
  };
  function action(name, index) {
    const list = model.projects;
    if (name === "add-project") {
      if (list.length >= 40) return false;
      list.push({ id: "show-" + crypto.randomUUID().slice(0, 8), category: model.categories[0].id, name: "新舞台项目", en: "", cover: "", gallery: [] });
      active = list.length - 1;
      return true;
    }
    if (active === "site") return false;
    const project = list[active];
    if (name === "remove-project" && list.length > 1) {
      list.splice(active, 1);
      if (model.hero.featured === project.id) model.hero.featured = list[0].id;
      if (model.hero.motion) delete model.hero.motion[project.id];
      if (Array.isArray(model.hero.featuredProjects)) {
        model.hero.featuredProjects = model.hero.featuredProjects.filter((id) => id !== project.id);
      }
      active = Math.min(active, list.length - 1);
      return true;
    }
    if (name === "project-up" || name === "project-down") {
      const next = active + (name === "project-up" ? -1 : 1);
      if (!relocate(list, active, next)) return false;
      active = next;
      return true;
    }
    const gallery = project.gallery ||= [];
    if (name === "add-media" && gallery.length < 15) {
      gallery.push({ type: "image", label: "主屏原画", src: "", alt: "", note: "" });
      return true;
    }
    if (name === "remove-media" && Number.isInteger(index) && index >= 0 && index < gallery.length) {
      gallery.splice(index, 1);
      return true;
    }
    if (name === "media-up" || name === "media-down") return relocate(gallery, index, index + (name === "media-up" ? -1 : 1));
    return false;
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view], button[data-action]");
    if (!button || !model || busy) return;
    if (button.dataset.view != null) {
      active = button.dataset.view === "site" ? "site" : Number(button.dataset.view);
      render();
    } else if (action(button.dataset.action, Number(button.dataset.index))) {
      changed();
      render();
    }
  });

  $("editor").addEventListener("input", (event) => {
    const input = event.target;
    if (!input.name || busy) return;
    assign(input.name, input.type === "checkbox" ? input.checked : input.value);
    changed();
  });

  $("editor").addEventListener("change", async (event) => {
    const input = event.target;
    if (busy) return;
    if (input.dataset.refresh) {
      assign(input.name, input.value);
      if (input.name.endsWith(".type") && input.value !== "video") assign(input.name.slice(0, -4) + "showcase", false);
      changed();
      render();
      return;
    }
    const path = input.dataset.upload;
    const file = input.files?.[0];
    if (!path || !file) return;
    busy = true;
    updateControls();
    status("正在保存素材：" + file.name);
    try {
      const output = await api("upload?name=" + encodeURIComponent(file.name), {
        method: "POST", headers: { "x-stage-editor": token }, body: file,
      });
      assign(path, output.path);
      if (input.dataset.kind === "video" && path.endsWith(".src") && !path.startsWith("hero.motion.")) {
        assign(path.slice(0, -3) + "externalUrl", "");
      }
      files.push(output.path);
      dirty = true;
      status("素材已上传到本机。保存更改后，作品页才会使用它。", "success");
      render();
    } catch (error) { status(error.message, "error"); }
    finally { busy = false; updateControls(); }
  });

  $("edit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !dirty) return;
    busy = true;
    updateControls();
    status("正在保存更改…");
    try {
      model.studio.email = model.studio.email?.trim() || "";
      model.studio.wechat = model.studio.wechat?.trim() || "";
      const output = await api("save", {
        method: "POST", headers: { "content-type": "application/json", "x-stage-editor": token },
        body: JSON.stringify({ model, revision }),
      });
      revision = output.revision;
      dirty = false;
      status("已保存。刷新作品集即可查看新内容。", "success");
      render();
    } catch (error) { status(error.message, "error"); }
    finally { busy = false; updateControls(); }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = true;
  });
  api("state").then((initial) => {
    ({ model, token, revision, files } = initial);
    render();
    status("本机编辑。更改保存到模板目录，供预览和发布使用。");
  }).catch((error) => status(error.message, "error"));
})();
