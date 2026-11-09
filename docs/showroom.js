(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const two = (value) => String(value).padStart(2, "0");
  const time = (seconds) => two(Math.floor((seconds || 0) / 60)) + ":" + two(Math.floor((seconds || 0) % 60));

  function installScrollFeedback() {
    const line = document.querySelector(".page-progress");
    let queued = false;
    const update = () => {
      queued = false;
      const available = document.documentElement.scrollHeight - innerHeight;
      line.style.setProperty("--progress", String(available > 0 ? Math.max(0, Math.min(1, scrollY / available)) : 0));
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("hashchange", schedule);
    document.addEventListener("load", schedule, true);
    if ("ResizeObserver" in window) new ResizeObserver(schedule).observe(document.body);
    schedule();
    if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const arrive = new IntersectionObserver((items) => {
        for (const entry of items) if (entry.isIntersecting) {
          entry.target.classList.add("has-arrived");
          arrive.unobserve(entry.target);
        }
      }, { threshold: .32 });
      document.querySelectorAll("[data-arrive]").forEach((element) => arrive.observe(element));
    }
  }

  window.initStageShowroom = ({ projects, asset, sourceOf, caseHref, frameText }) => {
    installScrollFeedback();
    const cues = projects.flatMap((project) => (project.gallery || [])
      .filter((item) => item.type === "video" && item.showcase === true && asset(sourceOf(item)))
      .map((item) => ({ project, item })));
    if (!cues.length) return;

    const section = byId("motion");
    const showroom = byId("showroom");
    const frame = byId("motion-frame");
    const player = frame.closest(".showroom-player");
    const video = byId("motion-video");
    const poster = byId("motion-poster");
    const play = byId("motion-play");
    const start = byId("motion-start");
    const seek = byId("motion-seek");
    const full = byId("motion-fullscreen");
    const cueList = byId("motion-cues");
    const message = byId("motion-message");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    let selected = 0;
    let readySource = false;

    const nodes = cues.map(({ project, item }, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "showroom-cue";
      button.dataset.cue = String(index);
      const seq = document.createElement("span");
      seq.className = "mono cue-count";
      seq.textContent = two(index + 1);
      const copy = document.createElement("span");
      copy.className = "cue-copy";
      const title = document.createElement("strong");
      title.textContent = item.label || project.name;
      const meta = document.createElement("small");
      meta.textContent = project.occasion || project.en || "";
      const arrow = document.createElement("span");
      arrow.className = "cue-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "↗";
      copy.append(title, meta);
      button.append(seq, copy, arrow);
      cueList.append(button);
      return button;
    });

    function say(text = "") {
      message.textContent = text;
      message.hidden = !text;
    }
    function refreshProgress() {
      const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      seek.max = String(duration || 1);
      if (document.activeElement !== seek || !seek.matches(":active")) seek.value = String(current);
      seek.disabled = !duration || !readySource;
      seek.style.setProperty("--played", duration ? (100 * current / duration).toFixed(2) + "%" : "0%");
      seek.setAttribute("aria-valuetext", time(current) + (duration ? " / " + time(duration) : ""));
      byId("motion-time").textContent = time(current) + (duration ? " / " + time(duration) : "");
    }
    function refreshControls() {
      const playing = readySource && !video.paused && !video.ended;
      play.textContent = playing ? "暂停" : (video.ended ? "重播" : "播放");
      play.setAttribute("aria-label", playing ? "暂停当前模板" : (video.ended ? "重播当前模板" : "播放当前模板"));
      start.hidden = playing || (readySource && video.readyState >= 2);
      showroom.dataset.playing = String(playing);
      refreshProgress();
    }
    function showFormat(width, height) {
      if (width && height) {
        byId("motion-format").textContent = frameText(width, height);
        frame.style.aspectRatio = width + " / " + height;
        video.style.aspectRatio = width + " / " + height;
      }
    }
    poster.addEventListener("load", () => {
      if (!readySource || !video.videoWidth) showFormat(poster.naturalWidth, poster.naturalHeight);
    });
    video.addEventListener("loadedmetadata", () => {
      if (!readySource) return;
      showFormat(video.videoWidth, video.videoHeight);
      refreshProgress();
    });
    video.addEventListener("loadeddata", () => {
      if (!readySource) return;
      poster.hidden = true;
      video.hidden = false;
      say();
      refreshControls();
    });
    video.addEventListener("timeupdate", refreshProgress);
    ["play", "pause", "ended"].forEach((event) => video.addEventListener(event, refreshControls));
    video.addEventListener("error", () => {
      if (!readySource) return;
      poster.hidden = false;
      video.hidden = true;
      readySource = false;
      say("这段视频暂时无法播放。可切换模板或打开对应案例。");
      refreshControls();
    });

    function select(index) {
      selected = index;
      const { project, item } = cues[index];
      readySource = false;
      video.pause();
      if (video.hasAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
      video.hidden = true;
      frame.style.removeProperty("aspect-ratio");
      video.style.removeProperty("aspect-ratio");
      poster.alt = item.alt || item.label || project.name;
      const posterUrl = asset(item.poster || project.cover);
      if (posterUrl) poster.src = posterUrl;
      else poster.removeAttribute("src");
      poster.hidden = !posterUrl;
      video.setAttribute("aria-label", item.label || project.name);
      showroom.dataset.tone = ["live", "launch", "immersive"].includes(project.category) ? project.category : "live";
      byId("motion-number").textContent = "CUE " + two(index + 1) + " / " + two(cues.length);
      byId("motion-format").textContent = "原始画幅";
      byId("motion-caption").textContent = item.note || project.hook || "";
      byId("motion-case").href = caseHref(project);
      for (const [i, node] of nodes.entries()) node.setAttribute("aria-pressed", String(i === index));
      if (poster.complete && poster.naturalWidth) showFormat(poster.naturalWidth, poster.naturalHeight);
      say();
      refreshControls();
      if (!reduce.matches) frame.animate?.([{ opacity: .69, scale: ".998" }, { opacity: 1, scale: "1" }], { duration: 310, easing: "ease-out" });
    }
    function requestPlayback() {
      if (readySource && !video.paused && !video.ended) { video.pause(); return; }
      if (!readySource) {
        readySource = true;
        video.src = asset(sourceOf(cues[selected].item));
        say("正在加载动态样片…");
      }
      if (video.ended) video.currentTime = 0;
      const target = selected;
      video.play().catch((error) => {
        if (target !== selected || error.name === "AbortError") return;
        say("暂时无法播放，请再试一次或打开对应案例。");
        refreshControls();
      });
    }
    start.addEventListener("click", () => { requestPlayback(); play.focus({ preventScroll: true }); });
    play.addEventListener("click", requestPlayback);
    seek.addEventListener("input", () => {
      if (readySource && Number.isFinite(video.duration)) {
        video.currentTime = Number(seek.value);
        refreshProgress();
      }
    });
    full.addEventListener("click", () => {
      if (document.fullscreenElement === player) document.exitFullscreen().catch(() => {});
      else if (document.fullscreenEnabled && player.requestFullscreen) player.requestFullscreen().catch(() => say("当前浏览器暂不能全屏。"));
      else if (readySource && typeof video.webkitEnterFullscreen === "function") video.webkitEnterFullscreen();
      else say("先播放样片，即可使用浏览器的全屏模式。");
    });
    document.addEventListener("fullscreenchange", () => {
      const active = document.fullscreenElement === player;
      full.textContent = active ? "退出" : "全屏";
      full.setAttribute("aria-label", active ? "退出全屏" : "全屏查看当前模板");
    });
    cueList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-cue]");
      if (button && Number(button.dataset.cue) !== selected) select(Number(button.dataset.cue));
    });
    cueList.addEventListener("keydown", (event) => {
      if (!event.target.closest("[data-cue]")) return;
      const from = Number(event.target.closest("[data-cue]").dataset.cue);
      const delta = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0);
      const next = event.key === "Home" ? 0 : (event.key === "End" ? cues.length - 1 : (delta ? (from + delta + cues.length) % cues.length : -1));
      if (next < 0) return;
      event.preventDefault();
      if (next !== selected) select(next);
      nodes[next].focus({ preventScroll: true });
      nodes[next].scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce.matches ? "instant" : "smooth" });
    });
    if ("IntersectionObserver" in window) new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && document.fullscreenElement !== player) video.pause();
    }, { threshold: .13 }).observe(frame);
    document.addEventListener("visibilitychange", () => { if (document.hidden) video.pause(); });
    window.addEventListener("hashchange", () => { if (location.hash.startsWith("#case/")) video.pause(); });
    section.hidden = false;
    byId("motion-nav").hidden = false;
    select(0);
    if (location.hash === "#motion") requestAnimationFrame(() => section.scrollIntoView({ block: "start", behavior: "instant" }));
  };
})();
