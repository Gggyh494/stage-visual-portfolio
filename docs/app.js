(async () => {
  "use strict";

  const load = async () => {
    const response = await fetch("portfolio.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Unable to load portfolio data");
    return response.json();
  };
  const data = window.PORTFOLIO || await load();
  const embedded = window.PORTFOLIO_MEDIA || {};
  const dimensions = {
    "media/afterimage-wide.webp": [1672, 630],
    "media/afterimage.webp": [1672, 941],
    "media/afterimage-led.webp": [2172, 724],
    "media/launch.webp": [2021, 778],
    "media/liquid.webp": [1448, 1086],
    "media/signal-wide.webp": [1448, 556],
    "media/signal.webp": [1448, 1086],
  };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
  const put = (id, text) => { $(id).textContent = text || ""; };
  const ordinal = (index) => String(index + 1).padStart(2, "0");
  const studio = data.studio;
  const hero = data.hero;
  const categories = data.categories;
  const projects = data.projects;
  const category = (id) => categories.find((item) => item.id === id)?.label || id;
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const email = /^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/.test(studio.email) ? studio.email : "";
  const emailHref = email ? "mailto:" + encodeURIComponent(email).replace("%40", "@") : "";
  const studioTitle = studio.name + " · 舞台视觉作品集";

  function mediaPath(path) {
    if (typeof path !== "string") return "";
    // CMS paths start with /media/. Resolve them inside the Pages project subdirectory.
    return path.trim().replace(/^\/?(?:docs\/)?media\//, "media/");
  }

  function mediaUrl(path) {
    const value = mediaPath(path);
    if (!value) return "";
    if (embedded[value]) return embedded[value];
    try {
      const resolved = new URL(value, location.href);
      if (!resolved.username && !resolved.password && ["http:", "https:"].includes(resolved.protocol)) return value;
      if (resolved.protocol === "file:" && location.protocol === "file:") return value;
    } catch { /* Omit a malformed media address. */ }
    return "";
  }

  function safeCredit(url) {
    try {
      const parsed = new URL(url);
      return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
    } catch { return ""; }
  }

  function imgAttributes(path) {
    const size = dimensions[mediaPath(path)];
    return size ? ` width="${Number(size[0])}" height="${Number(size[1])}"` : "";
  }

  function imageTag(path, alt, eager = false) {
    return `<img src="${esc(mediaUrl(path))}" alt="${esc(alt)}"${imgAttributes(path)}${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'}>`;
  }

  const sourceOf = (item) => item?.externalUrl || item?.src;

  function videoTag(item) {
    const poster = mediaUrl(item.poster);
    return `<video controls playsinline preload="metadata" src="${esc(mediaUrl(sourceOf(item)))}"${poster ? ` poster="${esc(poster)}"` : ""} aria-label="${esc(item.title || item.label || "项目视频")}">您的浏览器不支持视频播放。</video>`;
  }

  function creditTag(item) {
    if (!item.credit) return "";
    const url = safeCredit(item.creditUrl);
    return url
      ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.credit)}</a>`
      : esc(item.credit);
  }

  function caseHref(project) {
    return "#case/" + encodeURIComponent(project.id);
  }

  put("brand-name", studio.name);
  put("brand-en", studio.english);
  put("footer-brand", studio.english);
  put("hero-title", hero.title);
  put("hero-intro", hero.intro);
  put("hero-caption", hero.caption);
  put("work-intro", data.workIntro);
  put("services-intro", data.servicesIntro);
  put("contact-description", data.contactDescription);
  $("hero-status").hidden = !studio.demo;
  $("footer-note").hidden = !studio.demo;
  document.title = studioTitle;
  document.querySelector('meta[name="description"]').content = studio.name + "。 " + hero.caption + "。 " + data.workIntro;
  if (mediaUrl(sourceOf(hero.reel))) {
    document.querySelector("[data-reel]").hidden = false;
    put("reel-label", studio.demo ? "现场片段" : "播放 Showreel");
  }
  const featured = projectById.get(hero.featured) || projects[0];
  const showcase = featured ? [featured, ...projects.filter((p) => p !== featured)].slice(0, 3) : [];
  const heroControls = $("hero-select");
  heroControls.hidden = showcase.length < 2;
  heroControls.innerHTML = showcase.map((project, i) => `
    <button class="hero-step mono" type="button" data-showcase="${i}" aria-label="预览：${esc(project.name)}" aria-pressed="false">${ordinal(i)}</button>`).join("");

  function renderShowcase(index) {
    const project = showcase[index];
    const useCover = index === 0 && mediaUrl(hero.image);
    const image = useCover ? hero.image : project?.cover;
    const node = $("hero-image");
    node.alt = useCover ? hero.alt || project?.coverAlt || "" : project?.coverAlt || "";
    node.removeAttribute("width");
    node.removeAttribute("height");
    if (dimensions[mediaPath(image)]) [node.width, node.height] = dimensions[mediaPath(image)];
    const url = mediaUrl(image);
    if (url) node.src = url;
    else node.removeAttribute("src");
    node.hidden = !url;
    $("featured-link").hidden = !project;
    if (project) $("featured-link").href = caseHref(project);
    put("featured-name", project?.name);
    put("featured-index", project ? ordinal(projects.indexOf(project)) + " / " + project.en : "");
    for (const button of heroControls.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.showcase) === index));
    }
  }
  renderShowcase(0);
  heroControls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-showcase]");
    if (button) renderShowcase(Number(button.dataset.showcase));
  });

  $("services-list").innerHTML = data.services.map((service, index) => `
    <li><span class="service-index mono" aria-hidden="true">${ordinal(index)}</span>
    <h3>${esc(service.name)}<small class="mono" lang="en">${esc(service.en)}</small></h3>
    <p>${esc(service.description)}</p></li>`).join("");
  $("brief-kind").innerHTML = [
    '<option value="">请选择项目类型</option>',
    ...categories.map((item) => `<option>${esc(item.label)}</option>`),
    "<option>其他舞台项目</option>",
  ].join("");
  if (email) {
    const link = $("contact-email");
    link.href = emailHref;
    link.textContent = email;
    link.hidden = false;
    $("brief-email").hidden = false;
    put("brief-hint", "整理好的需求可以复制，也可以在你的邮件应用中继续发送。");
  }

  let filter = "";
  const filterItems = [{ id: "", label: "全部" }, ...categories];
  $("filters").innerHTML = filterItems.map((item) => `
    <button class="filter" type="button" data-filter="${esc(item.id)}" aria-pressed="${item.id === filter}">${esc(item.label)}</button>`).join("");
  $("work-grid").innerHTML = projects.map((project, index) => `
    <article class="work-card" data-category="${esc(project.category)}">
      <a class="card-link" href="${esc(caseHref(project))}" aria-label="查看项目：${esc(project.name)}">
        <span class="mono card-index" aria-hidden="true">${ordinal(index)}</span>
        <div class="card-caption">
          <p class="mono">${esc(category(project.category))} <span aria-hidden="true">/</span> <span lang="en">${esc(project.en)}</span></p>
          <h3>${esc(project.name)}</h3>
          <p class="card-description">${esc(project.hook)}</p>
        </div>
        <div class="card-image">${imageTag(project.cardImage || project.cover, project.cardAlt || project.coverAlt)}</div>
        <span class="card-arrow" aria-hidden="true">↗</span>
      </a>
    </article>`).join("");

  function renderFilter() {
    for (const button of $("filters").querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
    }
    let count = 0;
    for (const card of $("work-grid").children) {
      card.hidden = !!filter && card.dataset.category !== filter;
      if (!card.hidden) count++;
    }
    put("work-count", String(count).padStart(2, "0") + " 个项目");
  }
  renderFilter();
  $("filters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (button) {
      filter = button.dataset.filter;
      renderFilter();
    }
  });

  function frameText(width, height) {
    if (!width || !height) return "";
    const choices = [[4,1], [32,9], [3,1], [21,9], [16,9], [4,3], [1,1], [9,16]];
    const ratio = width / height;
    const standard = choices.find(([w, h]) => Math.abs(ratio - w / h) < .012);
    return `${width} × ${height} · ${standard ? standard.join(":") : ratio.toFixed(2) + ":1"}`;
  }

  function applyVideoRatio(video) {
    if (video.videoWidth && video.videoHeight) {
      video.style.aspectRatio = video.videoWidth + " / " + video.videoHeight;
    }
  }

  function bindFrameLabels(container) {
    for (const figure of container.querySelectorAll(".full-media")) {
      const node = figure.querySelector("img, video");
      const label = figure.querySelector("[data-dimensions]");
      if (!node || !label) continue;
      const isVideo = node.tagName === "VIDEO";
      const refresh = () => {
        const width = isVideo ? node.videoWidth : node.naturalWidth;
        const height = isVideo ? node.videoHeight : node.naturalHeight;
        if (isVideo) applyVideoRatio(node);
        label.textContent = frameText(width, height);
        label.hidden = !width;
      };
      node.addEventListener(isVideo ? "loadedmetadata" : "load", refresh);
      if (isVideo) node.addEventListener("resize", refresh);
      refresh();
    }
  }

  let activeProject = null;
  let caseMedia = [];
  let homeScroll = 0;
  const caseView = $("case-view");

  function renderCaseMedia(index) {
    const item = caseMedia[index];
    const pane = $("case-media-pane");
    if (!pane || !item) return;
    pane.querySelector("video")?.pause();
    for (const button of caseView.querySelectorAll("[data-case-media]")) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.caseMedia) === index));
    }
    const isVideo = item.type === "video";
    const content = isVideo ? videoTag(item)
      : `<button class="figure-button" type="button" data-media="${index}" aria-label="放大查看：${esc(item.label)}">${imageTag(item.src, item.alt, true)}</button>`;
    pane.innerHTML = `<figure class="full-media">${content}
      <figcaption>
        <span><strong>${esc(item.label)}</strong>${item.note ? " · " + esc(item.note) : ""}${item.credit ? " · " + creditTag(item) : ""}</span>
        <span class="figure-meta"><span class="mono" data-dimensions hidden></span>${!isVideo ? '<span class="zoom-hint" aria-hidden="true">点图放大 ↗</span>' : ""}</span>
      </figcaption>
    </figure>`;
    bindFrameLabels(pane);
    put("case-media-status", "正在查看：" + item.label);
  }

  function renderCase(project) {
    const i = projects.indexOf(project);
    const next = projects.length > 1 ? projects[(i + 1) % projects.length] : null;
    const video = project.video;
    caseMedia = [
      { type: "image", src: project.cover, alt: project.coverAlt, label: "项目全景", note: studio.demo ? "概念渲染" : "" },
      ...(mediaUrl(sourceOf(video)) ? [{ ...video, type: "video", label: video.title || "现场片段" }] : []),
      ...(project.gallery || []).filter((item) => mediaUrl(item.type === "video" ? sourceOf(item) : item.src)),
    ].filter((item) => mediaUrl(item.type === "video" ? sourceOf(item) : item.src));
    const selector = caseMedia.map((item, n) => `
      <button class="case-tab" type="button" data-case-media="${n}" aria-controls="case-media-pane" aria-pressed="false">
        <span class="mono" aria-hidden="true">${ordinal(n)}</span>${esc(item.label)}
      </button>`).join("");
    caseView.innerHTML = `
      <div class="case-nav"><a class="back-link" href="#work">← 返回作品</a><span class="mono">PROJECT / ${ordinal(i)}${studio.demo ? " · 概念示例" : ""}</span></div>
      <div class="case-heading">
        <div><p class="mono"><span lang="en">${esc(project.en)}</span> / ${esc(category(project.category))}</p>
          <h1 id="case-title" tabindex="-1">${esc(project.name)}</h1></div>
        <p>${esc(project.hook)}</p>
      </div>
      ${caseMedia.length > 0 ? `<section aria-label="项目影像与大屏内容">
        ${caseMedia.length > 1 ? `<div class="case-switch" role="group" aria-label="切换案例媒体">${selector}</div>` : ""}
        <p class="sr-only" id="case-media-status" aria-live="polite"></p>
        <div id="case-media-pane" class="media-pane"></div>
      </section>` : ""}
      <dl class="case-facts">
        <div><dt>使用场景</dt><dd>${esc(project.occasion)}</dd></div>
        <div><dt>我们负责</dt><dd>${esc(project.scope)}</dd></div>
        <div><dt>${studio.demo ? "交付示例" : "交付内容"}</dt><dd>${esc(project.deliveries)}</dd></div>
      </dl>
      <div class="case-story">
        <section><h2>项目需求</h2><p>${esc(project.brief)}</p></section>
        <section><h2>视觉方向</h2><p>${esc(project.concept)}</p></section>
      </div>
      ${next ? `<a class="case-next" href="${esc(caseHref(next))}"><span class="mono">下个项目 / NEXT</span><strong>${esc(next.name)} ↗</strong></a>` : ""}`;
    renderCaseMedia(0);
  }
  caseView.addEventListener("click", (event) => {
    const tab = event.target.closest("button[data-case-media]");
    if (tab && tab.getAttribute("aria-pressed") !== "true") renderCaseMedia(Number(tab.dataset.caseMedia));
  });

  function route(shouldFocus = false) {
    const hash = location.hash;
    let id = "";
    if (hash.startsWith("#case/")) {
      try { id = decodeURIComponent(hash.slice(6)); } catch { /* Fall back to home. */ }
    }
    const project = projectById.get(id);
    const prior = activeProject;
    if (project && project !== prior) {
      if (!prior) homeScroll = scrollY;
      if ($("media-dialog").open) $("media-dialog").close();
      activeProject = project;
      renderCase(project);
      $("home-view").hidden = true;
      caseView.hidden = false;
      document.title = project.name + " · " + studio.name;
      window.scrollTo({ top: 0, behavior: "instant" });
      if (shouldFocus) $("case-title").focus({ preventScroll: true });
    } else if (!project) {
      activeProject = null;
      caseView.hidden = true;
      $("home-view").hidden = false;
      document.title = studioTitle;
      if (prior) {
        caseView.replaceChildren();
        const anchor = ["#work", "#services", "#contact", "#top", "#main"].includes(hash)
          ? $(hash.slice(1)) : null;
        requestAnimationFrame(() => {
          if (anchor) anchor.scrollIntoView({ block: "start", behavior: "instant" });
          else window.scrollTo({ top: homeScroll, behavior: "instant" });
          if (shouldFocus) $("main").focus({ preventScroll: true });
        });
      }
    }
    for (const link of document.querySelectorAll(".site-nav a")) {
      if (!project && link.getAttribute("href") === hash) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  }
  window.addEventListener("hashchange", () => route(true));
  route();

  const mediaDialog = $("media-dialog");
  const mediaBody = $("media-body");
  const zoom = $("zoom-image");
  let mediaTrigger;

  function openMedia(item, isVideo, trigger) {
    if (!mediaUrl(isVideo ? sourceOf(item) : item?.src)) return;
    mediaTrigger = trigger;
    put("media-title", item.title || item.label || "项目媒体");
    mediaBody.innerHTML = isVideo ? videoTag(item) : imageTag(item.src, item.alt, true);
    mediaBody.dataset.zoomed = "false";
    zoom.hidden = isVideo;
    zoom.setAttribute("aria-pressed", "false");
    zoom.textContent = "原尺寸";
    const note = $("media-note");
    note.innerHTML = [esc(item.note), creditTag(item)].filter(Boolean).join(" · ");
    note.hidden = !note.innerHTML;
    mediaDialog.showModal();
    mediaBody.scrollTo(0, 0);
    if (isVideo) {
      const video = mediaBody.querySelector("video");
      video.addEventListener("loadedmetadata", () => applyVideoRatio(video));
      video.addEventListener("resize", () => applyVideoRatio(video));
      applyVideoRatio(video);
      video.play().catch(() => {});
    }
  }

  zoom.addEventListener("click", () => {
    const zoomed = mediaBody.dataset.zoomed !== "true";
    mediaBody.dataset.zoomed = String(zoomed);
    zoom.setAttribute("aria-pressed", String(zoomed));
    zoom.textContent = zoomed ? "适合窗口" : "原尺寸";
    if (!zoomed) mediaBody.scrollTo(0, 0);
  });
  mediaDialog.addEventListener("close", () => {
    mediaBody.querySelector("video")?.pause();
    mediaBody.replaceChildren();
    if (mediaTrigger?.isConnected) mediaTrigger.focus({ preventScroll: true });
  });

  const briefDialog = $("brief-dialog");
  let briefTrigger;
  const status = $("brief-status");
  const manual = $("manual-copy");

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("button[data-reel], button[data-media], button[data-brief], button[data-close]");
    if (!trigger) return;
    if (trigger.hasAttribute("data-reel")) openMedia(hero.reel, true, trigger);
    if (trigger.hasAttribute("data-media")) {
      const item = caseMedia[Number(trigger.dataset.media)];
      if (item) openMedia(item, item.type === "video", trigger);
    }
    if (trigger.hasAttribute("data-brief")) {
      briefTrigger = trigger;
      status.hidden = true;
      manual.hidden = true;
      briefDialog.showModal();
    }
    if (trigger.hasAttribute("data-close")) $(trigger.dataset.close).close();
  });
  briefDialog.addEventListener("close", () => briefTrigger?.focus({ preventScroll: true }));

  $("brief-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const message = String(values.get("message") || "").trim();
    if (!message) {
      form.elements.message.value = "";
      form.elements.message.reportValidity();
      return;
    }
    const brief = [
      "舞台视觉合作需求",
      "",
      "项目类型：" + values.get("kind"),
      "演出日期：" + (String(values.get("date") || "").trim() || "待定"),
      "屏幕规格：" + (String(values.get("screen") || "").trim() || "待确认"),
      "",
      "制作需求：",
      message,
    ].join("\n");
    if (event.submitter?.value === "email" && emailHref) {
      location.href = emailHref + "?subject=" + encodeURIComponent("舞台视觉合作咨询") + "&body=" + encodeURIComponent(brief);
      return;
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(brief);
      copied = true;
    } catch {
      manual.hidden = false;
      manual.value = brief;
      manual.focus();
      manual.select();
      try { copied = document.execCommand("copy"); } catch { /* Leave a selectable copy. */ }
    }
    status.textContent = copied ? "需求已复制。" : "需求已整理，请复制下方文字。";
    status.hidden = false;
    if (copied && !manual.hidden) {
      manual.hidden = true;
      event.submitter?.focus({ preventScroll: true });
    }
  });
})().catch(() => {
  document.getElementById("load-error").hidden = false;
  document.getElementById("home-view").hidden = true;
});
