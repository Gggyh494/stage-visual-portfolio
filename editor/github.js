(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const select = byId("slot");
  const fileInput = byId("file");
  const currentPreview = byId("current-preview");
  const newPreview = byId("new-preview");
  const submit = byId("publish");
  const reload = byId("reload");
  const allowed = { image: /\.(?:jpe?g|png|webp|gif|avif)$/i, video: /\.(?:mp4|webm)$/i };
  let state;
  let busy = false;
  let newUrl;
  let fileReady = false;

  const slot = () => state?.slots.find(({ id }) => id === select.value);
  function status(message, kind = "") {
    byId("status").textContent = message;
    byId("status").dataset.kind = kind;
  }
  function lock(active) {
    busy = active;
    byId("controls").disabled = active || !state;
    reload.disabled = active;
    submit.disabled = active || !fileReady;
  }
  function placeholder(target, text) {
    const label = document.createElement("p");
    label.textContent = text;
    target.replaceChildren(label);
  }
  function showMedia(container, type, source, ready, invalid) {
    const isVideo = type === "video";
    const media = document.createElement(isVideo ? "video" : "img");
    if (isVideo) { media.controls = true; media.playsInline = true; media.preload = "metadata"; }
    else media.alt = container === currentPreview ? "当前图片" : "新图片预览";
    media.addEventListener("error", invalid, { once: true });
    if (ready) media.addEventListener(isVideo ? "loadedmetadata" : "load", () => ready(media), { once: true });
    container.replaceChildren(media);
    media.src = source;
  }
  function clearFile() {
    fileReady = false;
    if (newUrl) URL.revokeObjectURL(newUrl);
    newUrl = undefined;
    placeholder(newPreview, "选择文件后预览");
    submit.disabled = true;
  }
  function updateSlot() {
    const entry = slot();
    if (!entry) return;
    fileInput.value = "";
    clearFile();
    fileInput.accept = entry.kind === "image" ? ".jpg,.jpeg,.png,.webp,.gif,.avif" : ".mp4,.webm";
    const size = state.uploadLimit / 1024 / 1024 + " MiB";
    byId("file-hint").textContent = entry.kind === "image"
      ? "支持 JPG、PNG、WebP、GIF、AVIF。单个文件最多 " + size + "。"
      : "支持 MP4、WebM。建议用 H.264 MP4。单个文件最多 " + size + "。";
    if (entry.src) showMedia(currentPreview, entry.kind, entry.src, null, () => placeholder(currentPreview, "当前素材无法预览"));
    else placeholder(currentPreview, "此位置还没有素材");
  }
  async function request(path, options) {
    const response = await fetch("api/" + path, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "操作失败，请重试。");
    return result;
  }
  async function load() {
    const previous = select.value;
    lock(true);
    status("正在读取线上素材…");
    try {
      state = await request("github");
      select.replaceChildren();
      for (const [kind, label] of [["image", "图片"], ["video", "视频"]]) {
        const group = document.createElement("optgroup");
        group.label = label;
        for (const entry of state.slots.filter((item) => item.kind === kind)) group.append(new Option(entry.label, entry.id));
        select.append(group);
      }
      if (state.slots.some(({ id }) => id === previous)) select.value = previous;
      updateSlot();
      status("选择要更换的位置和文件。");
    } catch (error) { status(error.message, "error"); }
    finally { lock(false); }
  }
  select.addEventListener("change", () => { updateSlot(); status("选择此位置的新素材。"); });
  reload.addEventListener("click", load);
  fileInput.addEventListener("change", () => {
    clearFile();
    const file = fileInput.files?.[0];
    const entry = slot();
    if (!file || !entry) return;
    if (!file.size || file.size > state.uploadLimit || !allowed[entry.kind].test(file.name)) {
      status("请选择符合格式和大小要求的素材。", "error");
      return;
    }
    const url = URL.createObjectURL(file);
    newUrl = url;
    status("正在读取预览…");
    showMedia(newPreview, entry.kind, url, (media) => {
      if (newUrl !== url) return;
      const width = media.videoWidth || media.naturalWidth;
      const height = media.videoHeight || media.naturalHeight;
      fileReady = width > 0 && height > 0;
      submit.disabled = busy || !fileReady;
      status(fileReady ? "已选 " + file.name + "（" + width + " × " + height + "）" : "无法读取素材尺寸。", fileReady ? "" : "error");
    }, () => {
      if (newUrl !== url) return;
      clearFile();
      status("浏览器无法预览这个文件，请重新导出后再选。", "error");
    });
  });
  byId("replacement").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !fileReady) return;
    const file = fileInput.files[0];
    const entry = slot();
    const query = new URLSearchParams({ slot: entry.id, revision: state.revision, name: file.name });
    lock(true);
    status("正在上传并提交到 GitHub…");
    try {
      const result = await request("replace?" + query, { method: "POST", headers: { "X-Stage-Editor": state.token }, body: file });
      state.revision = result.revision;
      entry.src = result.src;
      updateSlot();
      byId("commit").href = result.commitUrl;
      byId("commit").hidden = false;
      status("已提交。GitHub Pages 正在发布新版，几分钟后可打开网站查看。", "success");
    } catch (error) { status(error.message, "error"); }
    finally { lock(false); }
  });
  load();
})();
