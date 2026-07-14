// =========================================================
// CONFIG — edit these before deploying
// =========================================================
// This file is served publicly — never put a secret (like a
// GitHub token) in here. The admin token is entered at login
// and kept only in that browser tab's sessionStorage.
// =========================================================

window.SITE_CONFIG = {
  GITHUB_OWNER: "YOUR_USERNAME",
  GITHUB_REPO: "ad-gallery",

  // All gallery items (images AND videos) are tagged with this
  // single issue label; each item's "type" field (image/video)
  // determines which tab it shows up in.
  GITHUB_LABEL: "gallery-item",

  // Folder inside the repo where actual media files are committed
  MEDIA_FOLDER: "media",

  // Rough client-side size guards (GitHub's Contents API caps
  // individual files at 100MB; keep well under that in practice)
  MAX_IMAGE_MB: 8,
  MAX_VIDEO_MB: 40,

  // Adsterra popunder zone, for your own reference
  ADSTERRA_ZONE_ID: "YOUR_ZONE_ID",
};
