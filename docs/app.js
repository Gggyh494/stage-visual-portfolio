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
  put("hero-wordmark", studio.name);
  put("hero-title", hero.title);
  put("work-intro", data.workIntro);
  put("services-intro", data.servicesIntro);
  put("contact-description", data.contactDescription);
  $("hero-status").hidden = !studio.demo;
  $("footer-note").hidden = !studio.demo;
  document.title = studioTitle;
  document.querySelector('meta[name="description"]').content = studio.name + "。 " + hero.caption + "。 " + data.workIntro;
  document.querySelector("[data-reel]").hidden = !mediaUrl(sourceOf(hero.reel));
  const featured = projectById.get(hero.featured) || projects[0];
  const showcase = featured ? [featured, ...projects.filter((p) => p !== featured)].slice(0, 3) : [];
  let showcaseIndex = -1;
  let projectPreview = false;
  const heroProjects = $("hero-projects");
  const heroControls = $("hero-select");
  heroProjects.hidden = !showcase.length;
  heroControls.innerHTML = showcase.map((project, i) => `
    <a class="hero-project-link" href="${esc(caseHref(project))}" data-showcase="${i}">${esc(project.name)} <span aria-hidden="true">↗</span></a>`).join("");
  const heroLinks = Array.from(heroControls.querySelectorAll("a"));
  for (const button of heroProjects.querySelectorAll("[data-hero-skip]")) button.hidden = showcase.length < 2;
  $("hero-swipe-hint").hidden = showcase.length < 2;

  const heroView = document.querySelector(".hero-visual");
  const homeView = $("home-view");
  const siteHead = $("site-head");
  const heroImage = $("hero-image");
  const nextHeroImage = $("hero-next-image");
  const heroVideo = $("hero-video");
  const heroVideoLayer = heroVideo.parentElement;
  const motionToggle = $("hero-motion-toggle");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const reducedData = matchMedia("(prefers-reduced-data: reduce)");
  const compactProjects = matchMedia("(max-width: 690px), (hover: none) and (pointer: coarse)");
  const mouseHover = matchMedia("(any-hover: hover) and (any-pointer: fine)");
  const connection = navigator.connection;
  const autoMotion = () => !reducedMotion.matches && !reducedData.matches && !connection?.saveData;
  const decorateHero = () => autoMotion() && motionChoice !== false && !playBlocked;
  const heroMotionEnabled = () => Boolean(heroClip && (motionChoice ?? autoMotion()) && !playBlocked);
  const usesVideoFrames = typeof heroVideo.requestVideoFrameCallback === "function";
  const clampUnit = (value) => Math.max(0, Math.min(1, value));
  let heroClip = "";
  let motionChoice;
  let playBlocked = false;
  let heroInView = !("IntersectionObserver" in window);
  let posterBusy = false;
  let posterFade;
  let selectionRevision = 0;
  let playAttempt;
  let videoFrame = null;
  let pointerFrame = 0;
  let headerFrame = 0;
  heroVideo.muted = true;

  function syncHeroHeader() {
    siteHead.toggleAttribute("data-over-hero", !homeView.hidden && heroView.getBoundingClientRect().bottom > siteHead.offsetHeight);
  }
  window.addEventListener("scroll", () => {
    if (headerFrame) return;
    headerFrame = requestAnimationFrame(() => {
      headerFrame = 0;
      syncHeroHeader();
    });
  }, { passive: true });
  window.addEventListener("resize", syncHeroHeader, { passive: true });

  function paintVideoEdge(time) {
    const duration = heroVideo.duration;
    const edge = Math.min(.42, duration / 4);
    const t = Number.isFinite(duration) && edge > 0 ? clampUnit(Math.min(time, duration - time) / edge) : 0;
    heroVideo.style.opacity = String(t * t * (3 - 2 * t));
  }
  function updateVideoFrame(_, frame) {
    videoFrame = null;
    if (heroVideo.paused) return;
    paintVideoEdge(frame?.mediaTime ?? heroVideo.currentTime);
    queueVideoFrame();
  }
  function queueVideoFrame() {
    if (videoFrame !== null || heroVideo.paused) return;
    videoFrame = usesVideoFrames
      ? heroVideo.requestVideoFrameCallback(updateVideoFrame)
      : requestAnimationFrame(updateVideoFrame);
  }
  function hideHeroVideo() {
    heroVideoLayer.classList.remove("is-visible");
    if (videoFrame === null) return;
    if (usesVideoFrames) heroVideo.cancelVideoFrameCallback(videoFrame);
    else cancelAnimationFrame(videoFrame);
    videoFrame = null;
  }
  heroVideo.addEventListener("pause", () => { if (heroVideo.paused) hideHeroVideo(); });

  function resetHeroPointer() {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    delete heroView.dataset.tracking;
  }

  function syncHeroMotion() {
    const enabled = heroMotionEnabled();
    motionToggle.hidden = !heroClip;
    motionToggle.disabled = posterBusy;
    motionToggle.dataset.playing = String(enabled);
    const label = enabled ? "暂停首屏动效" : "播放首屏动效";
    motionToggle.setAttribute("aria-label", label);
    motionToggle.title = label;
    if (!decorateHero() || !mouseHover.matches) resetHeroPointer();
    if (!enabled || posterBusy || !heroInView || document.hidden || homeView.hidden || $("media-dialog").open) {
      playAttempt = null;
      heroVideo.pause();
      hideHeroVideo();
      return;
    }
    if (heroVideo.getAttribute("src") !== heroClip || heroVideo.error) {
      heroVideo.style.opacity = "0";
      heroVideo.src = heroClip;
    }
    if (playAttempt || !heroVideo.paused) return;
    const attempt = heroVideo.play();
    playAttempt = attempt;
    attempt.then(() => {
      if (playAttempt !== attempt) return;
      playAttempt = null;
      paintVideoEdge(heroVideo.currentTime);
      heroVideoLayer.classList.add("is-visible");
      queueVideoFrame();
    }).catch(() => {
      if (playAttempt !== attempt) return;
      playAttempt = null;
      playBlocked = true;
      syncHeroMotion();
    });
  }
  motionToggle.addEventListener("click", () => {
    motionChoice = !heroMotionEnabled();
    playBlocked = false;
    syncHeroMotion();
  });
  heroVideo.addEventListener("error", () => {
    if (posterBusy || heroVideo.getAttribute("src") !== heroClip) return;
    playBlocked = true;
    syncHeroMotion();
  });
  if ("IntersectionObserver" in window) new IntersectionObserver(([entry]) => {
    heroInView = entry.intersectionRatio >= .1;
    syncHeroMotion();
  }, { threshold: .1 }).observe(heroView);
  document.addEventListener("visibilitychange", syncHeroMotion);

  let wasAuto = autoMotion();
  function updateMotionPreference() {
    const allowed = autoMotion();
    if (wasAuto && !allowed && motionChoice === true) motionChoice = undefined;
    wasAuto = allowed;
    if (!decorateHero()) posterFade?.finish();
    syncHeroMotion();
    if (!allowed && !heroMotionEnabled() && heroVideo.hasAttribute("src")) {
      heroVideo.removeAttribute("src");
      heroVideo.load();
    }
  }
  for (const query of [reducedMotion, reducedData]) query.addEventListener?.("change", updateMotionPreference);
  mouseHover.addEventListener?.("change", resetHeroPointer);
  connection?.addEventListener?.("change", updateMotionPreference);

  async function swapHeroPoster(path, alt, revision) {
    const url = mediaUrl(path);
    posterFade?.cancel();
    posterFade = null;
    nextHeroImage.hidden = true;
    if (url && url !== heroImage.getAttribute("src") && heroImage.naturalWidth && decorateHero() && nextHeroImage.animate && nextHeroImage.decode) {
      nextHeroImage.src = url;
      const ready = await nextHeroImage.decode().then(() => true, () => false);
      if (revision !== selectionRevision) return;
      if (ready && decorateHero()) {
        nextHeroImage.hidden = false;
        posterFade = nextHeroImage.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: compactProjects.matches ? 160 : 220, easing: "ease-out", fill: "both",
        });
        await posterFade.finished.catch(() => {});
        if (revision !== selectionRevision) return;
      }
    }
    heroImage.alt = alt;
    heroImage.removeAttribute("width");
    heroImage.removeAttribute("height");
    if (dimensions[mediaPath(path)]) [heroImage.width, heroImage.height] = dimensions[mediaPath(path)];
    if (url) heroImage.src = url;
    else heroImage.removeAttribute("src");
    heroImage.hidden = !url;
    if (!nextHeroImage.hidden) {
      await heroImage.decode().catch(() => {});
      if (revision !== selectionRevision) return;
    }
    nextHeroImage.hidden = true;
    nextHeroImage.removeAttribute("src");
    posterFade?.cancel();
    posterFade = null;
  }

  function renderShowcase(index, preview = true) {
    if (index === showcaseIndex && preview === projectPreview) return;
    showcaseIndex = index;
    projectPreview = preview;
    const project = showcase[index];
    const useCover = index === 0 && mediaUrl(hero.image);
    const image = useCover ? hero.image : project?.cover;
    const alt = (useCover ? hero.alt || project?.coverAlt : project?.coverAlt) || "";
    const revision = ++selectionRevision;
    const projectClip = mediaUrl(hero.motion?.[project?.id]);
    heroClip = preview ? projectClip : (mediaUrl(hero.loopVideo) || projectClip);
    if (motionChoice === true && !autoMotion()) motionChoice = undefined;
    playBlocked = false;
    posterBusy = true;
    syncHeroMotion();
    const clipFade = (heroVideoLayer.getAnimations?.() || []).map((animation) => animation.finished.catch(() => {}));
    Promise.all([swapHeroPoster(image, alt, revision), ...clipFade]).then(() => {
      if (revision !== selectionRevision) return;
      posterBusy = false;
      syncHeroMotion();
    });
    for (const [position, link] of heroLinks.entries()) {
      if (position === index) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  }
  renderShowcase(0, false);

  function stepShowcase(direction) {
    if (showcase.length < 2) return;
    const next = (showcaseIndex + direction + showcase.length) % showcase.length;
    renderShowcase(next);
    put("hero-project-status", showcase[next].name);
  }
  const projectControl = (node) => node?.closest?.("[data-hero-skip], [data-showcase]");
  let projectTap;
  let handledTap;
  heroProjects.addEventListener("pointerdown", (event) => {
    const control = projectControl(event.target);
    if (control && event.pointerType === "touch") {
      projectTap = { control, id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp };
    }
  }, { passive: true });
  heroProjects.addEventListener("pointercancel", () => { projectTap = undefined; });
  heroProjects.addEventListener("pointerup", (event) => {
    const start = projectTap;
    projectTap = undefined;
    if (!start || start.id !== event.pointerId || event.timeStamp - start.at > 550 ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10 ||
        projectControl(document.elementFromPoint(event.clientX, event.clientY)) !== start.control) return;
    // A browser can suppress the first click after a swipe. Keep short taps usable.
    handledTap = { control: start.control, at: event.timeStamp };
    start.control.click();
  }, { passive: true });
  heroProjects.addEventListener("click", (event) => {
    const control = projectControl(event.target);
    const fromTouch = event.pointerType === "touch" || (!event.pointerType && event.detail > 0);
    if (handledTap && control === handledTap.control && event.isTrusted && fromTouch && event.timeStamp - handledTap.at < 600) {
      event.preventDefault();
      return;
    }
    if (control?.hasAttribute("data-hero-skip")) stepShowcase(Number(control.dataset.heroSkip));
  });
  let hoverPreview;
  const cancelHoverPreview = () => clearTimeout(hoverPreview);
  for (const [index, link] of heroLinks.entries()) {
    link.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || !mouseHover.matches || compactProjects.matches) return;
      cancelHoverPreview();
      hoverPreview = setTimeout(() => renderShowcase(index), 75);
    });
    link.addEventListener("pointerleave", cancelHoverPreview);
    link.addEventListener("focus", () => {
      cancelHoverPreview();
      if (!compactProjects.matches || link.matches(":focus-visible")) renderShowcase(index);
    });
  }
  let swipeOrigin;
  heroView.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") swipeOrigin = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }, { passive: true });
  heroView.addEventListener("pointerup", (event) => {
    const start = swipeOrigin;
    swipeOrigin = undefined;
    if (!start || start.id !== event.pointerId || showcase.length < 2) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      stepShowcase(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
  heroView.addEventListener("pointercancel", () => { swipeOrigin = undefined; }, { passive: true });
  heroView.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || !mouseHover.matches || !decorateHero()) return;
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      const box = heroView.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const x = clampUnit((event.clientX - box.left) / box.width);
      const y = clampUnit((event.clientY - box.top) / box.height);
      heroView.style.setProperty("--hero-shift-x", ((x * 2 - 1) * 6) + "px");
      heroView.style.setProperty("--hero-shift-y", ((y * 2 - 1) * 4) + "px");
      heroView.style.setProperty("--hero-glow-x", (x * 100) + "%");
      heroView.style.setProperty("--hero-glow-y", (y * 100) + "%");
      heroView.dataset.tracking = "true";
    });
  }, { passive: true });
  heroView.addEventListener("pointerleave", resetHeroPointer);

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
      cancelHoverPreview();
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
      if (prior) caseView.replaceChildren();
      const anchor = ["#work", "#motion", "#services", "#contact", "#top", "#main"].includes(hash)
        ? $(hash.slice(1)) : null;
      if (prior || (!shouldFocus && anchor)) {
        requestAnimationFrame(() => {
          if (location.hash !== hash || activeProject) return;
          if (anchor && !anchor.hidden) anchor.scrollIntoView({ block: "start", behavior: "instant" });
          else if (prior) window.scrollTo({ top: homeScroll, behavior: "instant" });
          syncHeroHeader();
          if (shouldFocus) $("main").focus({ preventScroll: true });
        });
      }
    }
    syncHeroHeader();
    syncHeroMotion();
    for (const link of document.querySelectorAll(".site-nav a")) {
      if (!project && link.getAttribute("href") === hash) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  }
  window.addEventListener("hashchange", () => route(true));
  route();
  window.initStageShowroom?.({ projects, asset: mediaUrl, sourceOf, caseHref, frameText });

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
    syncHeroMotion();
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
    syncHeroMotion();
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
  document.getElementById("site-head").removeAttribute("data-over-hero");
  document.getElementById("load-error").hidden = false;
  document.getElementById("home-view").hidden = true;
});
