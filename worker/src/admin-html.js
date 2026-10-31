/**
 * worker/src/admin-html.js —— /admin 上传工作台（单文件页，Worker 同源服务）
 *
 * 对齐全案 §6.3（v1.2：Worker 同源单文件页，内联亮主题 tokens）+ PRD F-13：
 *   拖拽上传（.md/.jpg/.png/.webp，单文件≤10MB、单次≤20，前端+Worker 双校验）
 *   归类建议（标题→slug、类型→目录、分类下拉可改）
 *   实时预览（手写迷你 markdown 渲染器，覆盖标题/列表/代码块/粗体/链接）
 *   草稿 localStorage 自动保存与恢复；待发布列表（localStorage）一键重试
 *   发布成功 → 访问链接 + 「约 1~3 分钟线上生效」
 * 主题：2026-10-30 用户决策——全站仅亮主题（彩铅笔感），本页同步移除暗色版。
 */

const ADMIN_JS = [
  'var NOTE_CATS = ["AI knowledge","AI prompt","AIPERSON","FastAPI","HTTP knowledges","Python","agent ai","code_knowledge","后端基础学习","智能客服"];',
  'var PROJ_CATS = ["智能体","RAG 应用","AI 产品","后端服务","工具","工程实践"];',
  'var DRAFT_KEY = "portfolio-admin-draft-v1";',
  'var PENDING_KEY = "portfolio-admin-pending-v1";',
  'var MAX_FILES = 20, MAX_FILE_MB = 10, MAX_IMG_BYTES = 2 * 1024 * 1024;',
  'var IMG_EXTS = ["webp","jpg","jpeg","png"];',
  '',
  'function $(id) { return document.getElementById(id); }',
  'function esc(s) { return String(s == null ? "" : s).replace(/[&<>"\'"]/g, function(c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",\'"\':"&quot;","\'":"&#39;"}[c]; }); }',
  '',
  '/* ---------- 登录态 ---------- */',
  'function checkAuth() {',
  '  fetch("/api/v1/me", { credentials: "same-origin" })',
  '    .then(function(r) { return r.json(); })',
  '    .then(function(data) {',
  '      if (data && data.login) {',
  '        $("login-view").style.display = "none";',
  '        $("app-view").style.display = "block";',
  '        $("me-login").textContent = data.login;',
  '        restoreDraft();',
  '        renderPending();',
  '      } else {',
  '        showLoginErrorFromUrl();',
  '      }',
  '    })',
  '    .catch(function() { showLoginErrorFromUrl(); });',
  '}',
  '',
  'function showLoginErrorFromUrl() {',
  '  var params = new URLSearchParams(location.search);',
  '  var err = params.get("error");',
  '  if (!err) return;',
  '  var box = $("login-error");',
  '  var msg = "";',
  '  if (err === "denied") msg = "已取消授权，可重试。";',
  '  else if (err === "forbidden") msg = "该账号无访问权限。";',
  '  else if (err === "locked") {',
  '    var until = parseInt(params.get("until") || "0", 10);',
  '    startLockCountdown(until);',
  '    return;',
  '  } else msg = "登录失败，请重试。";',
  '  var detail = params.get("detail");',
  '  if (detail) msg += "（" + decodeURIComponent(detail) + "）";',
  '  var left = params.get("left");',
  '  if (left && parseInt(left, 10) < 5) msg += "还可尝试 " + (5 - parseInt(left, 10)) + " 次。";',
  '  box.textContent = msg;',
  '  box.style.display = "block";',
  '}',
  '',
'function startLockCountdown(until) {',
'  var box = $("login-error");',
'  box.style.display = "block";',
'  box.textContent = "";',
'  var line = document.createElement("div");',
'  box.appendChild(line);',
'  // 锁定态也展示上一次失败原因（Worker 从 KV 持久化透出），排障不必干等 15 分钟',
'  var detail = new URLSearchParams(location.search).get("detail");',
'  if (detail) {',
'    var d = document.createElement("div");',
'    d.style.marginTop = "6px";',
'    d.style.fontSize = "13px";',
'    d.style.opacity = "0.85";',
'    d.textContent = "上次失败原因：" + decodeURIComponent(detail);',
'    box.appendChild(d);',
'  }',
'  function tick() {',
'    var remain = Math.ceil((until - Date.now()) / 1000);',
'    if (remain <= 0) { line.textContent = "锁定已解除，可重新登录。"; return; }',
'    var m = Math.floor(remain / 60), s = remain % 60;',
'    line.textContent = "登录失败次数过多，已锁定。解锁倒计时 " + m + " 分 " + (s < 10 ? "0" : "") + s + " 秒。";',
'    setTimeout(tick, 1000);',
'  }',
'  tick();',
'}',
  '',
  'function logout() {',
  '  fetch("/api/v1/auth/logout", { credentials: "same-origin" }).finally(function() { location.href = "/admin"; });',
  '}',
  '',
  '/* ---------- 表单状态 ---------- */',
  'function currentKind() { return document.querySelector(".kind-tab.active").dataset.kind; }',
  '',
  'function setKind(kind) {',
  '  document.querySelectorAll(".kind-tab").forEach(function(t) { t.classList.toggle("active", t.dataset.kind === kind); });',
  '  var groups = {',
  '    "field-note": kind === "note",',
  '    "field-project": kind === "project",',
  '    "field-project-extra": kind === "project",',
  '    "field-project-demo": kind === "project",',
  '    "field-featured": kind === "project",',
  '    "field-gallery": kind === "gallery",',
  '    "field-body": kind !== "gallery"',
  '  };',
  '  Object.keys(groups).forEach(function(id) { $(id).style.display = groups[id] ? "block" : "none"; });',
  '  var dl = $("cat-list");',
  '  dl.innerHTML = "";',
  '  (kind === "project" ? PROJ_CATS : NOTE_CATS).forEach(function(c) {',
  '    var o = document.createElement("option"); o.value = c; dl.appendChild(o);',
  '  });',
  '  saveDraft(); renderPreview();',
  '}',
  '',
  'function suggestSlug() {',
  '  var s = $("f-title").value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");',
  '  if (s) $("f-slug").value = s;',
  '}',
  '',
  'function todayStr() {',
  '  var d = new Date(Date.now() + 8 * 3600 * 1000);',
  '  return d.toISOString().slice(0, 10);',
  '}',
  '',
  'function collectForm() {',
  '  var kind = currentKind();',
  '  return {',
  '    kind: kind,',
  '    title: $("f-title").value.trim(),',
  '    slug: $("f-slug").value.trim(),',
  '    date: $("f-date").value || todayStr(),',
  '    category: (kind === "project" ? $("f-category-proj").value : $("f-category").value).trim(),',
  '    tags: $("f-tags").value.split(/[,，]/).map(function(s) { return s.trim(); }).filter(Boolean),',
  '    summary: $("f-summary").value.trim(),',
  '    status: $("f-status").value,',
  '    repo_url: $("f-repo").value.trim(),',
  '    demo_type: $("f-demo-type").value,',
  '    demo_url: $("f-demo-url").value.trim(),',
  '    tech_stack: $("f-tech").value.split(/[,，]/).map(function(s) { return s.trim(); }).filter(Boolean),',
  '    featured: $("f-featured").checked,',
  '    series: $("f-series").value.trim(),',
  '    prompt: $("f-prompt").value.trim(),',
  '    markdown: $("f-body").value',
  '  };',
  '}',
  '',
  'function fillForm(d) {',
  '  if (!d) return;',
  '  setKind(d.kind || "note");',
  '  $("f-title").value = d.title || "";',
  '  $("f-slug").value = d.slug || "";',
  '  $("f-date").value = d.date || todayStr();',
  '  $("f-category").value = d.category || "";',
  '  $("f-category-proj").value = d.category || "";',
  '  $("f-tags").value = (d.tags || []).join(", ");',
  '  $("f-summary").value = d.summary || "";',
  '  $("f-status").value = d.status || "draft";',
  '  $("f-repo").value = d.repo_url || "";',
  '  $("f-demo-type").value = d.demo_type || "none";',
  '  $("f-demo-url").value = d.demo_url || "";',
  '  $("f-tech").value = (d.tech_stack || []).join(", ");',
  '  $("f-featured").checked = !!d.featured;',
  '  $("f-series").value = d.series || "";',
  '  $("f-prompt").value = d.prompt || "";',
  '  $("f-body").value = d.markdown || "";',
  '}',
  '',
  'function saveDraft() {',
  '  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(collectForm())); } catch (e) {}',
  '}',
  '',
  'function restoreDraft() {',
  '  try {',
  '    var raw = localStorage.getItem(DRAFT_KEY);',
  '    if (raw) { fillForm(JSON.parse(raw)); $("draft-tip").style.display = "inline"; }',
  '  } catch (e) {}',
  '  renderPreview();',
  '}',
  '',
  '/* ---------- 迷你 markdown 渲染器（预览用） ---------- */',
  'function renderMarkdown(src) {',
  '  var lines = String(src || "").replace(/\\r\\n/g, "\\n").split("\\n");',
  '  var html = [], i = 0, inCode = false, listType = null;',
  '  function inline(s) {',
  '    return esc(s)',
  '      .replace(/`([^`]+)`/g, "<code>$1</code>")',
  '      .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>")',
  '      .replace(/\\*([^*]+)\\*/g, "<em>$1</em>")',
  '      .replace(/\\[([^\\]]+)\\]\\((https?:[^)\\s]+)\\)/g, \'<a href="$2" target="_blank" rel="noopener">$1</a>\');',
  '  }',
  '  function closeList() { if (listType) { html.push("</" + listType + ">"); listType = null; } }',
  '  while (i < lines.length) {',
  '    var line = lines[i];',
  '    if (/^```/.test(line)) {',
  '      if (inCode) { html.push("</code></pre>"); inCode = false; }',
  '      else { closeList(); html.push("<pre><code>"); inCode = true; }',
  '      i++; continue;',
  '    }',
  '    if (inCode) { html.push(esc(line) + "\\n"); i++; continue; }',
  '    var h = line.match(/^(#{1,4})\\s+(.*)$/);',
  '    if (h) { closeList(); var lv = h[1].length; html.push("<h" + lv + ">" + inline(h[2]) + "</h" + lv + ">"); i++; continue; }',
  '    if (/^\\s*(-{3,}|\\*{3,})\\s*$/.test(line)) { closeList(); html.push("<hr>"); i++; continue; }',
  '    var q = line.match(/^>\\s?(.*)$/);',
  '    if (q) { closeList(); html.push("<blockquote>" + inline(q[1]) + "</blockquote>"); i++; continue; }',
  '    var ul = line.match(/^\\s*[-*]\\s+(.*)$/);',
  '    if (ul) { if (listType !== "ul") { closeList(); html.push("<ul>"); listType = "ul"; } html.push("<li>" + inline(ul[1]) + "</li>"); i++; continue; }',
  '    var ol = line.match(/^\\s*\\d+[.、]\\s+(.*)$/);',
  '    if (ol) { if (listType !== "ol") { closeList(); html.push("<ol>"); listType = "ol"; } html.push("<li>" + inline(ol[1]) + "</li>"); i++; continue; }',
  '    if (!line.trim()) { closeList(); i++; continue; }',
  '    closeList();',
  '    var para = [line]; i++;',
  '    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\\s|```|>\\s?|\\s*[-*]\\s|\\s*\\d+[.、]\\s)/.test(lines[i])) { para.push(lines[i]); i++; }',
  '    html.push("<p>" + inline(para.join(" ")) + "</p>");',
  '  }',
  '  closeList();',
  '  if (inCode) html.push("</code></pre>");',
  '  return html.join("\\n");',
  '}',
  '',
  'function renderPreview() {',
  '  var f = collectForm();',
  '  var meta = "<h1>" + esc(f.title || "未命名") + "</h1>";',
  '  meta += "<p class=\\"pv-meta\\">" + esc(f.date) + " · " + esc(f.category || "未分类") + " · " + (f.status === "published" ? "发布" : "草稿") + "</p>";',
  '  if (f.summary) meta += "<p class=\\"pv-summary\\">" + esc(f.summary) + "</p>";',
  '  if (f.kind === "project") {',
  '    meta += "<p class=\\"pv-meta\\">" + (f.tech_stack || []).map(function(t) { return "<span class=\\"chip\\">" + esc(t) + "</span>"; }).join(" ") + "</p>";',
  '  }',
  '  var body = f.kind === "gallery" ? "" : renderMarkdown(f.markdown);',
  '  $("preview").innerHTML = meta + body;',
  '}',
  '',
  '/* ---------- 文件处理（Canvas 压缩：≤1920 WebP + thumb 640） ---------- */',
  'var readyFiles = [];',
  '',
  'function fileItem(name, status, note) {',
  '  return \'<div class="file-row" data-name="\' + esc(name) + \'"><span class="fname">\' + esc(name) + \'</span><span class="fstatus">\' + esc(status) + (note ? \' · \' + esc(note) : "") + "</span></div>";',
  '}',
  '',
  'function renderFileList() {',
  '  $("file-list").innerHTML = readyFiles.map(function(f) {',
  '    return fileItem(f.name, f.status, f.note);',
  '  }).join("");',
  '}',
  '',
  'function loadImage(file) {',
  '  return new Promise(function(resolve, reject) {',
  '    var img = new Image();',
  '    var url = URL.createObjectURL(file);',
  '    img.onload = function() { resolve(img); URL.revokeObjectURL(url); };',
  '    img.onerror = function() { reject(new Error("图片解码失败")); URL.revokeObjectURL(url); };',
  '    img.src = url;',
  '  });',
  '}',
  '',
  'function canvasToBlob(canvas, quality) {',
  '  return new Promise(function(resolve) { canvas.toBlob(function(b) { resolve(b); }, "image/webp", quality); });',
  '}',
  '',
  'async function compressImage(file, maxEdge, quality) {',
  '  var img = await loadImage(file);',
  '  var scale = Math.min(1, maxEdge / Math.max(img.width, img.height));',
  '  var w = Math.round(img.width * scale), h = Math.round(img.height * scale);',
  '  var canvas = document.createElement("canvas");',
  '  canvas.width = w; canvas.height = h;',
  '  canvas.getContext("2d").drawImage(img, 0, 0, w, h);',
  '  return canvasToBlob(canvas, quality);',
  '}',
  '',
  'function blobToBase64(blob) {',
  '  return new Promise(function(resolve, reject) {',
  '    var r = new FileReader();',
  '    r.onload = function() { resolve(String(r.result).split(",")[1]); };',
  '    r.onerror = reject;',
  '    r.readAsDataURL(blob);',
  '  });',
  '}',
  '',
  'async function handleFiles(fileList) {',
  '  var files = Array.prototype.slice.call(fileList || []);',
  '  if (!files.length) return;',
  '  if (readyFiles.length + files.length > MAX_FILES) {',
  '    alert("单次最多 " + MAX_FILES + " 个文件");',
  '    return;',
  '  }',
  '  for (var i = 0; i < files.length; i++) {',
  '    var file = files[i];',
  '    var ext = file.name.split(".").pop().toLowerCase();',
  '    var entry = { name: file.name, status: "处理中", note: "", data: null, thumb: null, thumbName: "" };',
  '    if (IMG_EXTS.indexOf(ext) < 0) { entry.status = "已拒绝"; entry.note = "仅支持 webp/jpg/png"; readyFiles.push(entry); renderFileList(); continue; }',
  '    if (file.size > MAX_FILE_MB * 1024 * 1024) { entry.status = "已拒绝"; entry.note = "超过 10MB"; readyFiles.push(entry); renderFileList(); continue; }',
  '    readyFiles.push(entry); renderFileList();',
  '    try {',
  '      var main = await compressImage(file, 1920, 0.85);',
  '      if (main.size > MAX_IMG_BYTES) throw new Error("压缩后仍超过 2MB");',
  '      var thumb = await compressImage(file, 640, 0.8);',
  '      entry.data = await blobToBase64(main);',
  '      entry.thumb = await blobToBase64(thumb);',
  '      var stem = file.name.replace(/\\.[^.]+$/, "");',
  '      entry.thumbName = stem + "-thumb.webp";',
  '      entry.status = "就绪";',
  '      entry.note = Math.round(main.size / 1024) + "KB";',
  '    } catch (e) {',
  '      entry.status = "已拒绝"; entry.note = e.message || "压缩失败";',
  '    }',
  '    renderFileList();',
  '  }',
  '}',
  '',
  'function setupDropzone() {',
  '  var dz = $("dropzone"), input = $("file-input");',
  '  dz.addEventListener("click", function() { input.click(); });',
  '  input.addEventListener("change", function() { handleFiles(input.files); input.value = ""; });',
  '  ["dragover", "dragenter"].forEach(function(ev) { dz.addEventListener(ev, function(e) { e.preventDefault(); dz.classList.add("over"); }); });',
  '  ["dragleave", "drop"].forEach(function(ev) { dz.addEventListener(ev, function(e) { e.preventDefault(); dz.classList.remove("over"); }); });',
  '  dz.addEventListener("drop", function(e) { handleFiles(e.dataTransfer.files); });',
  '}',
  '',
  '/* ---------- 待发布列表（localStorage 重试） ---------- */',
  'function getPending() { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch (e) { return []; } }',
  'function setPending(list) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch (e) {} }',
  '',
  'function renderPending() {',
  '  var list = getPending();',
  '  var box = $("pending-list");',
  '  if (!list.length) { box.innerHTML = "<p class=\\"empty\\">无待发布内容</p>"; return; }',
  '  box.innerHTML = list.map(function(p, idx) {',
  '    return \'<div class="pending-row"><span>\' + esc(p.title) + "（" + esc(p.kindLabel) + \'）</span><button data-idx="\' + idx + \'" class="btn-retry">重试发布</button></div>\';',
  '  }).join("");',
  '  box.querySelectorAll(".btn-retry").forEach(function(btn) {',
  '    btn.addEventListener("click", function() { retryPending(parseInt(btn.dataset.idx, 10)); });',
  '  });',
  '}',
  '',
  'function retryPending(idx) {',
  '  var list = getPending();',
  '  var item = list[idx];',
  '  if (!item) return;',
  '  doPublish(item.payload, item.files, true).then(function(ok) {',
  '    if (ok) { list.splice(idx, 1); setPending(list); renderPending(); }',
  '  });',
  '}',
  '',
  '/* ---------- 发布 ---------- */',
  'function validateBeforePublish(f) {',
  '  var errs = [];',
  '  if (!f.title) errs.push("标题必填");',
  '  if (!/^[a-z0-9-]+$/.test(f.slug)) errs.push("slug 不合规（kebab-case）");',
  '  if (f.kind !== "gallery" && !f.category) errs.push("分类必填");',
  '  if (f.summary.length > 120) errs.push("摘要超过 120 字");',
  '  var ready = readyFiles.filter(function(x) { return x.status === "就绪"; });',
  '  if (f.kind === "gallery" && !ready.length) errs.push("画廊发布至少需要 1 张就绪图片");',
  '  return errs;',
  '}',
  '',
  'function buildPayload(f, ready) {',
  '  var payload = {',
  '    kind: f.kind,',
  '    meta: {',
  '      title: f.title, slug: f.slug, date: f.date, category: f.category,',
  '      tags: f.tags, summary: f.summary, status: f.status',
  '    },',
  '    markdown: f.markdown',
  '  };',
  '  if (f.kind === "project") {',
  '    payload.meta.repo_url = f.repo_url;',
  '    payload.meta.demo_type = f.demo_type;',
  '    payload.meta.demo_url = f.demo_url;',
  '    payload.meta.tech_stack = f.tech_stack;',
  '    payload.meta.featured = f.featured;',
  '  }',
  '  if (f.kind === "gallery") {',
  '    payload.meta.series = f.series;',
  '    payload.meta.prompt = f.prompt;',
  '  }',
  '  var images = [];',
  '  ready.forEach(function(x) {',
  '    var entry = { name: x.name.replace(/\\.[^.]+$/, "") + ".webp", data: x.data };',
  '    if (x.thumb) entry.thumb = { name: x.thumbName, data: x.thumb };',
  '    images.push(entry);',
  '  });',
  '  payload.images = images;',
  '  return payload;',
  '}',
  '',
  'async function doPublish(payload, files, isRetry) {',
  '  var btn = $("btn-publish");',
  '  if (!isRetry) btn.disabled = true;',
  '  btn.textContent = "发布中…";',
  '  var attempt = 0;',
  '  while (attempt < 3) {',
  '    try {',
  '      var res = await fetch("/api/v1/publish", {',
  '        method: "POST",',
  '        headers: { "Content-Type": "application/json" },',
  '        credentials: "same-origin",',
  '        body: JSON.stringify(payload)',
  '      });',
  '      var data = await res.json().catch(function() { return {}; });',
  '      if (res.ok && data.ok) {',
  '        showSuccess(data);',
  '        return true;',
  '      }',
  '      if (res.status === 401) { location.href = "/api/v1/auth/login"; return false; }',
  '      throw new Error(data.message || ("HTTP " + res.status));',
  '    } catch (e) {',
  '      attempt++;',
  '      if (attempt < 3) { btn.textContent = "网络重试 " + attempt + "/2…"; await new Promise(function(r) { setTimeout(r, 1200); }); }',
  '      else {',
  '        btn.textContent = "发布";',
  '        if (!isRetry) btn.disabled = false;',
  '        var list = getPending();',
  '        list.push({ title: payload.meta.title, kindLabel: { note: "笔记", project: "项目", gallery: "画廊" }[payload.kind], payload: payload, files: files });',
  '        setPending(list);',
  '        renderPending();',
  '        $("publish-error").textContent = "线上仍为上一版本，内容已存入「待发布」可重试。（" + e.message + "）";',
  '        $("publish-error").style.display = "block";',
  '        return false;',
  '      }',
  '    }',
  '  }',
  '  return false;',
  '}',
  '',
  'async function publish() {',
  '  var f = collectForm();',
  '  var errs = validateBeforePublish(f);',
  '  if (errs.length) {',
  '    $("publish-error").textContent = errs.join("；");',
  '    $("publish-error").style.display = "block";',
  '    return;',
  '  }',
  '  $("publish-error").style.display = "none";',
  '  var ready = readyFiles.filter(function(x) { return x.status === "就绪"; });',
  '  var payload = buildPayload(f, ready);',
  '  await doPublish(payload, [], false);',
  '}',
  '',
  'function showSuccess(data) {',
  '  try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}',
  '  $("app-view").querySelector(".workbench").style.display = "none";',
  '  var box = $("success-view");',
  '  box.style.display = "block";',
  '  $("success-link").href = data.visit_url || "/";',
  '  $("success-msg").textContent = data.eta || "约 1~3 分钟线上生效";',
  '  if (data.overwrote) $("success-overwrote").style.display = "block";',
  '}',
  '',
  'function resetForm() {',
  '  readyFiles = []; renderFileList();',
  '  $("app-view").querySelector(".workbench").style.display = "grid";',
  '  $("success-view").style.display = "none";',
  '  $("success-overwrote").style.display = "none";',
  '  $("f-title").value = ""; $("f-slug").value = ""; $("f-body").value = "";',
  '  $("f-summary").value = ""; $("f-tags").value = "";',
  '  $("f-series").value = ""; $("f-prompt").value = "";',
  '  $("f-date").value = todayStr();',
  '  renderPreview();',
  '}',
  '',
  '/* ---------- 启动 ---------- */',
  'document.addEventListener("DOMContentLoaded", function() {',
  '  $("f-date").value = todayStr();',
  '  setKind("note");',
  '  setupDropzone();',
  '  ["input", "change"].forEach(function(ev) {',
  '    document.querySelectorAll(".workbench input, .workbench textarea, .workbench select").forEach(function(el) {',
  '      el.addEventListener(ev, function() { saveDraft(); renderPreview(); });',
  '    });',
  '  });',
  '  document.querySelectorAll(".kind-tab").forEach(function(t) {',
  '    t.addEventListener("click", function() { setKind(t.dataset.kind); });',
  '  });',
  '  $("btn-suggest-slug").addEventListener("click", suggestSlug);',
  '  $("btn-publish").addEventListener("click", publish);',
  '  $("btn-again").addEventListener("click", resetForm);',
  '  $("btn-logout").addEventListener("click", logout);',
  '  checkAuth();',
  '});'
].join('\n');

export const ADMIN_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>作品集后台 · 上传工作台</title>
<style>
  :root {
    --bg: #F4F1EA; --surface: #FBF9F4; --surface-2: #E2D8CC; --line: #E2D8CC;
    --text: #2C3635; --text-2: #4A525A; --accent: #81A5DE; --accent-ink: #46648C;
    --accent-2: #B78483; --hl: #E7E3B4; --tag-bg: #C9CB96; --hover: #82BAA3;
    --code-bg: #232A31; --code-text: #E8E4DA;
    --font-sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
    --font-mono: "JetBrains Mono", "SF Mono", Consolas, "Courier New", monospace;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--font-sans); }
  button { font-family: inherit; }

  /* 登录页 */
  #login-view { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .login-card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 48px 44px; width: 100%; max-width: 420px; text-align: center; box-shadow: 0 8px 32px rgba(44,54,53,.08); }
  .login-card h1 { margin: 0 0 8px; font-size: 1.5rem; }
  .login-card .sub { color: var(--text-2); font-size: .9rem; margin: 0 0 32px; }
  .btn-github { display: inline-flex; align-items: center; gap: 10px; background: var(--text); color: var(--bg); border: none; border-radius: 10px; padding: 12px 28px; font-size: 1rem; cursor: pointer; text-decoration: none; transition: transform .15s, box-shadow .15s; }
  .btn-github:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(44,54,53,.25); }
  .btn-github svg { width: 20px; height: 20px; fill: currentColor; }
  #login-error { display: none; margin: 20px auto 0; max-width: 340px; background: #F9E5E4; border: 1px solid var(--accent-2); color: #7A3B3A; border-radius: 10px; padding: 12px 16px; font-size: .88rem; line-height: 1.5; }

  /* 工作台 */
  #app-view { display: none; max-width: 1240px; margin: 0 auto; padding: 24px; }
  .admin-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .admin-head .brand { font-size: 1.15rem; font-weight: 700; display: flex; align-items: center; gap: 10px; }
  .admin-head .brand .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
  .admin-head .me { color: var(--text-2); font-size: .85rem; display: flex; align-items: center; gap: 14px; }
  .btn-text { background: none; border: none; color: var(--accent-ink); cursor: pointer; font-size: .85rem; padding: 4px 8px; border-radius: 6px; }
  .btn-text:hover { background: var(--surface-2); }

  .kind-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
  .kind-tab { border: 1px solid var(--line); background: var(--surface); color: var(--text-2); border-radius: 999px; padding: 8px 20px; font-size: .9rem; cursor: pointer; }
  .kind-tab.active { background: var(--text); color: var(--bg); border-color: var(--text); }

  .workbench { display: grid; grid-template-columns: 5fr 4fr; gap: 20px; align-items: start; }
  @media (max-width: 960px) { .workbench { grid-template-columns: 1fr; } }

  .panel { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 24px; }
  .panel h2 { margin: 0 0 16px; font-size: 1rem; color: var(--text-2); font-weight: 600; }
  .field { margin-bottom: 14px; }
  .field label { display: block; font-size: .82rem; color: var(--text-2); margin-bottom: 6px; }
  .field input[type="text"], .field input[type="url"], .field input[type="date"], .field textarea, .field select {
    width: 100%; border: 1px solid var(--line); border-radius: 10px; background: #fff;
    padding: 9px 12px; font-size: .92rem; color: var(--text); font-family: inherit;
  }
  .field input:focus, .field textarea:focus, .field select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .field textarea { resize: vertical; min-height: 220px; font-family: var(--font-mono); font-size: .85rem; line-height: 1.6; }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .slug-row { display: flex; gap: 8px; }
  .slug-row input { flex: 1; }
  .btn-mini { border: 1px solid var(--line); background: var(--surface-2); border-radius: 10px; padding: 0 14px; font-size: .82rem; cursor: pointer; color: var(--text-2); white-space: nowrap; }
  .btn-mini:hover { background: var(--hover); color: var(--text); }
  #draft-tip { display: none; font-size: .78rem; color: var(--accent-ink); background: var(--hl); border-radius: 6px; padding: 2px 8px; margin-left: 8px; }

  #dropzone { border: 2px dashed var(--line); border-radius: 12px; padding: 28px 16px; text-align: center; color: var(--text-2); font-size: .88rem; cursor: pointer; transition: border-color .15s, background .15s; }
  #dropzone:hover, #dropzone.over { border-color: var(--accent); background: var(--surface-2); }
  #file-list { margin-top: 10px; }
  .file-row { display: flex; justify-content: space-between; gap: 10px; font-size: .8rem; padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; margin-bottom: 6px; background: #fff; }
  .file-row .fname { font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-row .fstatus { color: var(--text-2); white-space: nowrap; }

  .publish-bar { display: flex; align-items: center; gap: 14px; margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--line); }
  .btn-publish { background: var(--accent-ink); color: #fff; border: none; border-radius: 10px; padding: 12px 32px; font-size: .95rem; cursor: pointer; transition: transform .15s, box-shadow .15s; }
  .btn-publish:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(70,100,140,.3); }
  .btn-publish:disabled { opacity: .6; cursor: wait; }
  .publish-hint { font-size: .78rem; color: var(--text-2); }
  #publish-error { display: none; margin-top: 12px; background: #F9E5E4; border: 1px solid var(--accent-2); color: #7A3B3A; border-radius: 10px; padding: 10px 14px; font-size: .84rem; }

  .pending-block { margin-top: 22px; }
  .pending-block h3 { font-size: .88rem; color: var(--text-2); margin: 0 0 10px; }
  .pending-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: .85rem; padding: 9px 12px; border: 1px solid var(--line); border-radius: 10px; margin-bottom: 8px; background: var(--surface-2); }
  .btn-retry { background: var(--accent-2); color: #fff; border: none; border-radius: 8px; padding: 6px 14px; font-size: .8rem; cursor: pointer; }
  .empty { font-size: .82rem; color: var(--text-2); margin: 0; }

  /* 预览 */
  #preview { font-size: .92rem; line-height: 1.75; max-height: 70vh; overflow: auto; }
  #preview h1 { font-size: 1.4rem; margin: 0 0 6px; }
  #preview h2 { font-size: 1.15rem; margin: 20px 0 8px; }
  #preview h3 { font-size: 1rem; margin: 16px 0 6px; }
  #preview .pv-meta { color: var(--text-2); font-size: .8rem; margin: 0 0 4px; }
  #preview .pv-summary { color: var(--text-2); border-left: 3px solid var(--hl); padding-left: 10px; margin: 8px 0 14px; }
  #preview .chip { display: inline-block; background: var(--tag-bg); color: var(--text); border-radius: 999px; padding: 1px 10px; font-size: .75rem; margin-right: 6px; }
  #preview pre { background: var(--code-bg); color: var(--code-text); border-radius: 10px; padding: 14px 16px; overflow: auto; font-size: .82rem; }
  #preview code { font-family: var(--font-mono); }
  #preview p code, #preview li code { background: var(--surface-2); border-radius: 4px; padding: 1px 6px; font-size: .85em; }
  #preview blockquote { border-left: 3px solid var(--accent); margin: 10px 0; padding: 2px 14px; color: var(--text-2); }
  #preview a { color: var(--accent-ink); }

  /* 成功页 */
  #success-view { display: none; max-width: 560px; margin: 60px auto; text-align: center; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 48px 40px; }
  #success-view .ok { font-size: 2.4rem; }
  #success-view h2 { margin: 12px 0 8px; }
  #success-view p { color: var(--text-2); font-size: .9rem; }
  #success-link { display: inline-block; margin: 18px 0; color: var(--accent-ink); font-size: .95rem; }
  #success-overwrote { display: none; font-size: .8rem; color: #8A6D1F; background: var(--hl); border-radius: 8px; padding: 6px 12px; }
  .success-actions { display: flex; gap: 12px; justify-content: center; margin-top: 20px; }
  .btn-secondary { background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 10px 22px; font-size: .9rem; cursor: pointer; color: var(--text); }
  .btn-secondary:hover { background: var(--hover); }
</style>
</head>
<body>

<div id="login-view">
  <div class="login-card">
    <h1>作品集后台</h1>
    <p class="sub">GitHub OAuth 白名单登录 · 仅作者本人可进入</p>
    <a class="btn-github" href="/api/v1/auth/login">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
      使用 GitHub 登录
    </a>
    <div id="login-error" role="alert"></div>
  </div>
</div>

<div id="app-view">
  <div class="admin-head">
    <div class="brand"><span class="dot" aria-hidden="true"></span>上传工作台</div>
    <div class="me">
      <span>已登录：<b id="me-login"></b></span>
      <button class="btn-text" id="btn-logout">退出登录</button>
    </div>
  </div>

  <div class="kind-tabs" role="tablist">
    <button class="kind-tab active" data-kind="note" role="tab">笔记</button>
    <button class="kind-tab" data-kind="project" role="tab">项目</button>
    <button class="kind-tab" data-kind="gallery" role="tab">画廊图片</button>
  </div>

  <div class="workbench">
    <div class="panel">
      <h2>内容信息<span id="draft-tip">已恢复上次草稿</span></h2>
      <div class="field">
        <label for="f-title">标题 *</label>
        <input type="text" id="f-title" placeholder="中文标题">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="f-slug">slug（URL 标识，kebab-case）*</label>
          <div class="slug-row">
            <input type="text" id="f-slug" placeholder="my-note-title">
            <button class="btn-mini" id="btn-suggest-slug" type="button">从标题生成</button>
          </div>
        </div>
        <div class="field">
          <label for="f-date">日期</label>
          <input type="date" id="f-date">
        </div>
      </div>
      <div class="field-row" id="field-note">
        <div class="field">
          <label for="f-category">分类 *</label>
          <input type="text" id="f-category" list="cat-list" placeholder="选择或输入">
          <datalist id="cat-list"></datalist>
        </div>
        <div class="field">
          <label for="f-tags">标签（逗号分隔）</label>
          <input type="text" id="f-tags" placeholder="Python, 学习笔记">
        </div>
      </div>
      <div class="field-row" id="field-project" style="display:none">
        <div class="field">
          <label for="f-category-proj">项目分类 *</label>
          <input type="text" id="f-category-proj" list="cat-list" placeholder="选择或输入">
        </div>
        <div class="field">
          <label for="f-tech">技术栈（逗号分隔）</label>
          <input type="text" id="f-tech" placeholder="Astro, TypeScript">
        </div>
      </div>
      <div class="field-row" id="field-project-extra" style="display:none">
        <div class="field">
          <label for="f-repo">仓库地址</label>
          <input type="url" id="f-repo" placeholder="https://github.com/...">
        </div>
        <div class="field">
          <label for="f-demo-type">Demo 类型</label>
          <select id="f-demo-type">
            <option value="none">无</option>
            <option value="static">站内静态</option>
            <option value="external">外部链接</option>
          </select>
        </div>
      </div>
      <div class="field" id="field-project-demo" style="display:none">
        <label for="f-demo-url">Demo 地址（static=站内路径 / external=完整 URL）</label>
        <input type="text" id="f-demo-url" placeholder="/demos/xxx/index.html">
      </div>
      <div class="field-row" id="field-gallery" style="display:none">
        <div class="field">
          <label for="f-series">系列（可选，同系列画廊分组展示）</label>
          <input type="text" id="f-series" placeholder="如：蜡笔小新">
        </div>
        <div class="field">
          <label for="f-prompt">提示词（可选展示）</label>
          <input type="text" id="f-prompt" placeholder="生成提示词">
        </div>
      </div>
      <div class="field">
        <label for="f-summary">摘要（≤120 字，列表页展示）</label>
        <input type="text" id="f-summary" maxlength="120">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="f-status">发布状态</label>
          <select id="f-status">
            <option value="draft">草稿（抽查后再发布）</option>
            <option value="published">直接发布</option>
          </select>
        </div>
        <div class="field" id="field-featured" style="display:none">
          <label for="f-featured">首页精选</label>
          <input type="checkbox" id="f-featured" style="width:18px;height:18px;margin-top:8px">
        </div>
      </div>
      <div class="field" id="field-body">
        <label for="f-body">正文（Markdown）</label>
        <textarea id="f-body" placeholder="支持 # 标题、**粗体**、列表、代码块、链接"></textarea>
      </div>
      <div class="field">
        <label>图片（拖拽或点击选择，≤10MB/张、≤20 张；自动压缩为 WebP ≤1920 + 缩略图）</label>
        <div id="dropzone">拖拽文件到此处，或点击选择（.webp / .jpg / .png）</div>
        <input type="file" id="file-input" multiple accept=".webp,.jpg,.jpeg,.png" style="display:none">
        <div id="file-list"></div>
      </div>
      <div class="publish-bar">
        <button class="btn-publish" id="btn-publish">发布</button>
        <span class="publish-hint">发布后约 1~3 分钟线上生效 · 草稿状态仅自己可见</span>
      </div>
      <div id="publish-error" role="alert"></div>
      <div class="pending-block">
        <h3>待发布（发布失败自动存入，可重试）</h3>
        <div id="pending-list"></div>
      </div>
    </div>

    <div class="panel">
      <h2>实时预览</h2>
      <div id="preview"></div>
    </div>
  </div>
</div>

<div id="success-view">
  <div class="ok">✅</div>
  <h2>线上已更新</h2>
  <p id="success-msg">约 1~3 分钟线上生效</p>
  <p id="success-overwrote">注意：同名文件已覆盖旧版本。</p>
  <a id="success-link" href="/" target="_blank" rel="noopener">访问线上页面 →</a>
  <div class="success-actions">
    <button class="btn-secondary" id="btn-again">继续上传</button>
    <a class="btn-secondary" href="/" style="text-decoration:none">返回站点</a>
  </div>
</div>

<script>
${ADMIN_JS}
</script>
</body>
</html>
`;
