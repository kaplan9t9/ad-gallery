// =========================================================
// GALLERY — public-facing logic
//
// Every image/video is one GitHub Issue (label: gallery-item).
// Issue body JSON: { type, title, category, description,
//                     mediaUrl, path, uploadedAt }
// "mediaUrl" points to the raw file committed into the repo
// (see admin.js) — no counts are tracked or displayed.
// =========================================================

const cfg = window.SITE_CONFIG;
const API_BASE = `https://api.github.com/repos/${cfg.GITHUB_OWNER}/${cfg.GITHUB_REPO}`;

let allItems = [];
let activeType = "image";

const galleryEl = document.getElementById("gallery");
const searchInput = document.getElementById("searchInput");
const categorySelect = document.getElementById("categorySelect");
const modalBackdrop = document.getElementById("modalBackdrop");
const toastEl = document.getElementById("toast");
const tabImages = document.getElementById("tabImages");
const tabVideos = document.getElementById("tabVideos");

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2200);
}

async function fetchItems() {
  galleryEl.innerHTML = `<div class="empty-state"><h3>Loading the gallery…</h3></div>`;
  try {
    const res = await fetch(
      `${API_BASE}/issues?labels=${encodeURIComponent(cfg.GITHUB_LABEL)}&state=open&per_page=100`
    );
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    const issues = await res.json();

    allItems = issues
      .map((issue) => {
        try {
          return { ...JSON.parse(issue.body), id: issue.number };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    populateCategories();
    renderGallery();
    handleShareParam();
  } catch (err) {
    galleryEl.innerHTML = `<div class="empty-state">
      <h3>Couldn't load the gallery</h3>
      <p>${err.message}. Check GITHUB_OWNER / GITHUB_REPO in config.js and that the repo is public.</p>
    </div>`;
  }
}

function itemsOfActiveType() {
  return allItems.filter((i) => i.type === activeType);
}

function populateCategories() {
  const cats = [...new Set(itemsOfActiveType().map((i) => i.category).filter(Boolean))].sort();
  categorySelect.innerHTML =
    `<option value="">All categories</option>` +
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function getFiltered() {
  const q = searchInput.value.trim().toLowerCase();
  const cat = categorySelect.value;
  return itemsOfActiveType().filter((item) => {
    const matchesQ =
      !q ||
      item.title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q);
    const matchesCat = !cat || item.category === cat;
    return matchesQ && matchesCat;
  });
}

function renderGallery() {
  const list = getFiltered();

  if (list.length === 0) {
    galleryEl.innerHTML = `<div class="empty-state">
      <h3>Nothing here yet</h3>
      <p>Try a different search or category, or check back once the admin uploads more ${activeType}s.</p>
    </div>`;
    return;
  }

  galleryEl.innerHTML = list
    .map(
      (item) => `
    <article class="card" data-id="${item.id}">
      <div class="card-media">
        <span class="card-media-tag">${escapeHtml(item.category || "uncategorized")}</span>
        <span class="card-media-type">${item.type}</span>
        ${
          item.type === "video"
            ? `<video src="${item.mediaUrl}" preload="metadata" muted></video>`
            : `<img src="${item.mediaUrl}" alt="${escapeHtml(item.title)}" loading="lazy" />`
        }
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-desc">${escapeHtml(item.description || "")}</p>
        <div class="card-actions">
          <button class="btn btn-primary" data-action="view" data-id="${item.id}">View</button>
          <button class="btn" data-action="download" data-id="${item.id}">Download</button>
          <button class="btn btn-icon" data-action="share" data-id="${item.id}" title="Copy share link">🔗</button>
        </div>
      </div>
    </article>`
    )
    .join("");
}

function findItem(id) {
  return allItems.find((i) => String(i.id) === String(id));
}

// ---- actions ----
function openItem(id) {
  const item = findItem(id);
  if (!item) return;

  const wrap = document.getElementById("modalMediaWrap");
  wrap.innerHTML =
    item.type === "video"
      ? `<video src="${item.mediaUrl}" controls autoplay></video>`
      : `<img src="${item.mediaUrl}" alt="${escapeHtml(item.title)}" />`;

  document.getElementById("modalTitle").textContent = item.title;
  document.getElementById("modalDesc").textContent = item.description || "";
  document.getElementById("modalDownload").dataset.id = id;
  document.getElementById("modalShare").dataset.id = id;
  modalBackdrop.classList.add("open");
}

function closeModal() {
  modalBackdrop.classList.remove("open");
  document.getElementById("modalMediaWrap").innerHTML = "";
}

function downloadItem(id) {
  const item = findItem(id);
  if (!item) return;
  const a = document.createElement("a");
  a.href = item.mediaUrl;
  a.download = item.mediaUrl.split("/").pop() || slugify(item.title);
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function shareItem(id) {
  const url = `${location.origin}${location.pathname}?item=${id}`;
  navigator.clipboard
    .writeText(url)
    .then(() => showToast("Link copied to clipboard"))
    .catch(() => showToast(url));
}

function handleShareParam() {
  const params = new URLSearchParams(location.search);
  const id = params.get("item");
  if (!id) return;
  const item = findItem(id);
  if (item && item.type !== activeType) setActiveTab(item.type);
  const card = galleryEl.querySelector(`.card[data-id="${id}"]`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("highlight");
    setTimeout(() => card.classList.remove("highlight"), 2500);
  }
}

// ---- tabs ----
function setActiveTab(type) {
  activeType = type;
  tabImages.classList.toggle("active", type === "image");
  tabVideos.classList.toggle("active", type === "video");
  searchInput.value = "";
  populateCategories();
  renderGallery();
}

tabImages.addEventListener("click", () => setActiveTab("image"));
tabVideos.addEventListener("click", () => setActiveTab("video"));

// ---- utils ----
function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function slugify(str = "file") {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "file";
}

// ---- event wiring ----
galleryEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (action === "view") openItem(id);
  if (action === "download") downloadItem(id);
  if (action === "share") shareItem(id);
});

document.getElementById("modalClose").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

document.getElementById("modalDownload").addEventListener("click", (e) => {
  downloadItem(e.currentTarget.dataset.id);
});
document.getElementById("modalShare").addEventListener("click", (e) => {
  shareItem(e.currentTarget.dataset.id);
});

searchInput.addEventListener("input", renderGallery);
categorySelect.addEventListener("change", renderGallery);

fetchItems();
