# Print Room — Image & Video Gallery

Light-theme static gallery with two sections — Images and Videos —
each with its own browse view and its own admin upload/management flow.
No view/download counters. GitHub + Netlify only, no backend server.

## What changed from the base "images only, base64-in-issue" version

Real files (images **and** videos) are now committed directly into your
GitHub repo via GitHub's **Contents API**, under `media/images/` and
`media/videos/`. A GitHub Issue (label `gallery-item`) is still created
per item, but it now just holds metadata + a link to the committed file —
not the file itself. This is required for video: GitHub Issue bodies cap
out around 65KB of text, which is nowhere near enough for a real video
file even base64-encoded. Contents API files can be up to 100MB.

**This is a new data format** — it is not compatible with images uploaded
under the old base64-in-issue-body approach. If you had images from before,
re-upload them here.

## Setup

1. **Create a GitHub repo** (public), e.g. `ad-gallery`.
2. **Create a fine-grained Personal Access Token**:
   - GitHub → Settings → Developer settings → Fine-grained tokens
   - Repository access: only the repo above
   - Permissions needed — **both**:
     - **Contents: Read and write** (to commit image/video files)
     - **Issues: Read and write** (to store/manage metadata)
   - Copy the token immediately after generating it.
3. **Edit `client/js/config.js`**:
   ```js
   window.SITE_CONFIG = {
     GITHUB_OWNER: "your-github-username",
     GITHUB_REPO: "ad-gallery",
     GITHUB_LABEL: "gallery-item",
     MEDIA_FOLDER: "media",
     MAX_IMAGE_MB: 8,
     MAX_VIDEO_MB: 40,
     ADSTERRA_ZONE_ID: "your-zone-id",
   };
   ```
4. **Add your Adsterra Popunder script** in `client/index.html` where the
   `ADSTERRA POPUNDER SCRIPT` comment is.
5. **Push to GitHub, deploy to Netlify** (New site from Git → pick the repo
   → build settings come from `netlify.toml` → Deploy).
6. **Log into `/admin.html`** with the token from step 2, pick the Images
   or Videos tab, and upload.

## Known limitations

- **File size**: GitHub's Contents API hard-caps individual files at
  100MB; the defaults here (8MB images / 40MB videos) leave headroom for
  base64's ~33% size inflation and keep uploads from timing out in the
  browser. Raise `MAX_VIDEO_MB` in config.js if you need bigger files —
  but for anything beyond short clips, a dedicated video host (YouTube
  unlisted, Cloudflare Stream, Bunny, etc.) with just the link stored here
  would serve visitors faster than pulling raw files off GitHub.
- **Unauthenticated API rate limit**: the public gallery's GitHub API
  calls are capped at 60/hour per visitor IP by GitHub. Fine for low
  traffic; not fine at scale.
- **Public repo = public files.** Anyone can fetch anything under
  `media/` directly, gallery or not.
- **"Delete" removes the file and closes the issue**, but the commit
  history in the repo still technically contains it (normal git behavior).

## Files

```
ad-gallery/
├── netlify.toml
├── README.md
├── client/
│   ├── index.html      public gallery (Images / Videos tabs)
│   ├── admin.html       admin panel (Images / Videos tabs)
│   ├── css/style.css
│   └── js/
│       ├── config.js    edit this
│       ├── gallery.js
│       └── admin.js
```
