// =========================================================
// ADMIN — upload / manage images and videos
//
// Two things happen on upload:
//  1. The actual file is committed into the repo under
//     MEDIA_FOLDER/<type>s/ via GitHub's Contents API.
//  2. A GitHub Issue (label: gallery-item) is created holding
//     the metadata + a link to that committed file.
// Delete removes both: the repo file and the issue (closed).
//
// SECURITY NOTE: your GitHub token is entered here at login and
// kept ONLY in this tab's sessionStorage — never written to any
// committed file. Use a fine-grained PAT scoped to only this repo,
// with "Contents: Read and write" AND "Issues: Read and write".
// =========================================================

const cfg = window.SITE_CONFIG;
const API_BASE = `https://api.github.com/repos/${cfg.GITHUB_OWNER}/${cfg.GITHUB_REPO}`;
const TOKEN_KEY = "admin_gh_token";

const loginCard = document.getElementById("loginCard");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const tokenInput = document.getElementById("tokenInput");
const loginNotice = document.getElementById("loginNotice");
const tabImages = document.getElementById("adminTabImages");
const tabVideos = document.getElementById("adminTabVideos");

let activeType = "image";
let cachedItems = [];

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    Accept: "application/vnd.github+json",
  };
}

function notice(el, msg, type) {
  el.textContent = msg;
  el.className = `notice show ${type}`;
}

// ---- login ----
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = tokenInput.value.trim();
  if (!token) return;

  const submitBtn = loginForm.querySelector("button");
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Verifying…`;

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error("Invalid or expired token");

    const repoRes = await fetch(API_BASE, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (!repoRes.ok) throw new Error(`Token can't access ${cfg.GITHUB_OWNER}/${cfg.GITHUB_REPO}`);

    sessionStorage.setItem(TOKEN_KEY, token);
    showDashboard();
  } catch (err) {
    notice(loginNotice, err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem(TOKEN_KEY);
  location.reload();
});

function showDashboard() {
  loginCard.style.display = "none";
  dashboard.style.display = "block";
  loadItems();
}

// ---- tabs ----
function setActiveTab(type) {
  activeType = type;
  tabImages.classList.toggle("active", type === "image");
  tabVideos.classList.toggle("active", type === "video");
  document.getElementById("uploadFile").accept = type === "video" ? "video/*" : "image/*";
  document.getElementById("uploadCardTitle").textContent =
    type === "video" ? "Upload a new video" : "Upload a new image";
  renderList();
}

tabImages.addEventListener("click", () => setActiveTab("image"));
tabVideos.addEventListener("click", () => setActiveTab("video"));

// ---- load + render ----
async function loadItems() {
  const list = document.getElementById("adminList");
  list.innerHTML = `<div class="admin-row"><div class="admin-row-info">Loading…</div></div>`;
  try {
    const res = await fetch(
      `${API_BASE}/issues?labels=${encodeURIComponent(cfg.GITHUB_LABEL)}&state=open&per_page=100`,
      { headers: ghHeaders() }
    );
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    const issues = await res.json();

    cachedItems = issues
      .map((issue) => {
        try {
          return { ...JSON.parse(issue.body), id: issue.number };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    document.getElementById("dashTotal").textContent = cachedItems.length;
    renderList();
  } catch (err) {
    list.innerHTML = `<div class="admin-row"><div class="admin-row-info">Error loading items: ${err.message}</div></div>`;
  }
}

function renderList() {
  const list = document.getElementById("adminList");
  const items = cachedItems.filter((i) => i.type === activeType);

  if (items.length === 0) {
    list.innerHTML = `<div class="admin-row"><div class="admin-row-info">No ${activeType}s uploaded yet.</div></div>`;
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
    <div class="admin-row">
      ${
        item.type === "video"
          ? `<video src="${item.mediaUrl}" muted></video>`
          : `<img src="${item.mediaUrl}" alt="" />`
      }
      <div class="admin-row-info">
        <div class="admin-row-title">${escapeHtml(item.title)}</div>
        <div class="admin-row-meta">#${item.id} · ${escapeHtml(item.category || "—")}</div>
      </div>
      <button class="btn btn-danger" data-id="${item.id}">Delete</button>
    </div>`
    )
    .join("");
}

document.getElementById("adminList").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;
  const id = btn.dataset.id;
  const item = cachedItems.find((i) => String(i.id) === String(id));
  if (!item) return;
  if (!confirm(`Delete "${item.title}"? This removes the file from the repo and closes its issue.`)) return;

  btn.disabled = true;
  btn.textContent = "Deleting…";
  try {
    // 1. remove the committed file (need its current sha first)
    if (item.path) {
      const fileRes = await fetch(`${API_BASE}/contents/${item.path}`, { headers: ghHeaders() });
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        await fetch(`${API_BASE}/contents/${item.path}`, {
          method: "DELETE",
          headers: { ...ghHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ message: `Remove ${item.path}`, sha: fileData.sha }),
        });
      }
    }
    // 2. close the issue
    await fetch(`${API_BASE}/issues/${id}`, {
      method: "PATCH",
      headers: { ...ghHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ state: "closed" }),
    });
    loadItems();
  } catch (err) {
    alert(`Couldn't delete: ${err.message}`);
    btn.disabled = false;
    btn.textContent = "Delete";
  }
});

// ---- upload ----
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("uploadTitle").value.trim();
  const category = document.getElementById("uploadCategory").value.trim();
  const description = document.getElementById("uploadDescription").value.trim();
  const fileInput = document.getElementById("uploadFile");
  const file = fileInput.files[0];
  const uploadNotice = document.getElementById("uploadNotice");

  if (!title || !file) {
    notice(uploadNotice, "Title and file are required.", "error");
    return;
  }

  const maxMb = activeType === "video" ? cfg.MAX_VIDEO_MB : cfg.MAX_IMAGE_MB;
  if (file.size > maxMb * 1024 * 1024) {
    notice(uploadNotice, `Keep ${activeType}s under ${maxMb}MB (see MAX_${activeType.toUpperCase()}_MB in config.js).`, "error");
    return;
  }

  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Uploading…`;

  try {
    const base64 = await fileToRawBase64(file);
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${cfg.MEDIA_FOLDER}/${activeType}s/${Date.now()}-${slugify(title)}.${ext}`;

    // 1. commit the actual file to the repo
    const putRes = await fetch(`${API_BASE}/contents/${path}`, {
      method: "PUT",
      headers: { ...ghHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Add ${activeType}: ${title}`,
        content: base64,
      }),
    });
    if (!putRes.ok) {
      const errBody = await putRes.json().catch(() => ({}));
      throw new Error(errBody.message || `GitHub API returned ${putRes.status} committing the file`);
    }
    const putData = await putRes.json();
    const mediaUrl = putData.content.download_url;

    // 2. create the metadata issue
    const payload = {
      type: activeType,
      title,
      category,
      description,
      mediaUrl,
      path,
      uploadedAt: new Date().toISOString(),
    };

    const issueRes = await fetch(`${API_BASE}/issues`, {
      method: "POST",
      headers: { ...ghHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `[${activeType}] ${title}`,
        body: JSON.stringify(payload),
        labels: [cfg.GITHUB_LABEL],
      }),
    });
    if (!issueRes.ok) {
      const errBody = await issueRes.json().catch(() => ({}));
      throw new Error(errBody.message || `GitHub API returned ${issueRes.status} creating the issue`);
    }

    notice(uploadNotice, "Uploaded. The public gallery will pick it up on next load.", "success");
    e.target.reset();
    loadItems();
  } catch (err) {
    notice(uploadNotice, err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Upload";
  }
});

function fileToRawBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]); // strip data: prefix
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function slugify(str = "file") {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "file";
}

// ---- boot ----
if (getToken()) {
  showDashboard();
}
