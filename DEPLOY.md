# yoimagine Tools Hub - Deployment Guide

## Project Overview

Static site built with Astro 4.x + Tailwind CSS, optimized for Cloudflare Pages hosting.

**Subdomain Structure:**
- `tools.yoimagine.com` → PDF, SEO, Career tools (this project)
- `seo.yoimagine.com` → Separate project for SEO tools
- `career.yoimagine.com` → Separate project for Career tools

---

## Build Output

Production files are in `/mnt/minissd/home/us1/code/mastersite/tools-hub/dist/`

```
dist/
├── index.html                    (redirects to /en/)
├── en/
│   ├── index.html                (homepage)
│   ├── blog/
│   │   ├── index.html            (blog listing)
│   │   ├── how-to-compress-pdf/
│   │   ├── pdf-to-jpg-conversion/
│   │   ├── how-to-merge-pdfs/
│   │   ├── top-free-pdf-tools/
│   │   ├── remove-pdf-password-guide/
│   │   ├── meta-title-description-guide/
│   │   ├── json-ld-schema-markup-guide/
│   │   ├── keyword-density-checker-guide/
│   │   ├── ats-resume-checker-guide/
│   │   └── best-free-career-tools/
│   └── tools/
│       ├── compress-pdf/
│       ├── merge-pdf/
│       ├── split-pdf/
│       ├── pdf-to-jpg/
│       ├── jpg-to-pdf/
│       ├── rotate-pdf/
│       ├── remove-password/
│       ├── extract-pages/
│       ├── meta-title-generator/
│       ├── schema-generator/
│       ├── keyword-density/
│       ├── serp-preview/
│       ├── og-preview/
│       ├── resume-builder/
│       ├── cover-letter/
│       ├── ats-checker/
│       └── interview-questions/
└── sitemap-0.xml / sitemap-index.xml
```

---

## Cloudflare Pages Deployment

### 1. Push to GitHub

```bash
cd /mnt/minissd/home/us1/code/mastersite/tools-hub
git init
git add .
git commit -m "Initial commit: 17 tools, 10 blog posts, AdSense integration"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/yoimagine-tools.git
git push -u origin main
```

### 2. Configure Cloudflare Pages

1. Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/pages)
2. Click **"Create a project"** → **"Connect to Git"**
3. Select your repository
4. **Build settings:**
   - **Production branch:** `main`
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Root directory:** `tools-hub` (if repo contains multiple projects)
5. Click **"Save and Deploy"**

### 3. Custom Domain Setup

1. After deployment, go to **Custom domains** tab
2. Click **"Set up a custom domain"**
3. Enter: `tools.yoimagine.com`
4. Cloudflare will auto-detect DNS (since yoimagine.com is on Cloudflare)

---

## Post-Deployment Configuration

### 1. DNS Records

Ensure these DNS records exist in Cloudflare:
```
CNAME  tools  <your-pages-subdomain>.pages.dev
```

### 2. AdSense Configuration

Replace placeholder ad slot IDs in `/src/components/AdSenseBlock.astro`:

```javascript
// Current slot IDs (need real ones from AdSense dashboard):
TOP_LEADERBOARD      → your actual 728x90 slot ID
SIDEBAR_RECTANGLE    → your actual 300x250 slot ID
BOTTOM_LEADERBOARD   → your actual 728x90 slot ID
ARTICLE_TOP          → your actual slot ID
ARTICLE_MIDDLE       → your actual slot ID
ARTICLE_BOTTOM       → your actual slot ID
BLOG_TOP             → your actual slot ID
BLOG_BOTTOM          → your actual slot ID
```

**Publisher ID:** `pub-5332027341695441` (already configured)

### 3. Google Analytics 4

Update `/src/components/GoogleAnalytics.astro`:
```javascript
const GA_ID = 'G-XXXXXXXXXX'; // Replace with your GA4 measurement ID
```

### 4. Affiliate Links

Update affiliate URLs in tool pages with your actual tracking IDs:
- Adobe Acrobat Pro
- SmallPDF Pro
- iSkysoft PDF Editor
- Ahrefs / Semrush / Surfer SEO
- LinkedIn Learning / Coursera / Udemy

---

## Performance Targets

All pages should achieve:
- **Lighthouse Performance:** 85+
- **Core Web Vitals:** All green
- **SEO Score:** 95+
- **Accessibility:** 90+

---

## Maintenance

### Adding New Tools

1. Create `/src/pages/en/tools/new-tool.astro` following existing pattern
2. Add tool to homepage (`/src/pages/en/index.astro`)
3. Add to Footer (`/src/components/Footer.astro`)
4. Run `npm run build` and redeploy

### Adding Blog Posts

1. Create `/src/pages/en/blog/post-slug.astro` using `BlogPost` layout
2. Add to `/src/pages/en/blog/index.astro` posts array
3. Run `npm run build` and redeploy

### Multilingual (Spanish/French)

Create `/src/pages/es/tools/compress-pdf.astro` with `locale="es"` and translate content. Repeat for `/fr/`.

---

## Monitoring

- **Google Search Console:** Submit sitemap.xml
- **Google Analytics:** Track traffic and conversions
- **Cloudflare Analytics:** Monitor bandwidth and performance
- **AdSense Dashboard:** Track ad revenue

---

## Support

For issues:
- Check build logs in Cloudflare Pages dashboard
- Verify DNS propagation: `dig tools.yoimagine.com`
- Test locally: `npm run dev -- --host 0.0.0.0 --port 3000`