// CSR Engine (Classic Light Slate - Variant #1) | Version: v2.0-stateless-wrs
const APP_VERSION = 'v2.0-stateless-wrs';
const API_BASE = 'https://bunbunserver.my.id';
const SITE_ORIGIN = window.location.origin;

// Detect Stateless Search Crawlers (Googlebot WRS, Bingbot, etc.) to serve 100% pure technical HTML without 3rd-party ad bloat
const IS_SEARCH_BOT =
  /googlebot|adsbot-google|mediapartners-google|bingbot|slurp|duckduckbot|baiduspider|yandexbot/i.test(
    navigator.userAgent || ''
  );

const appContainer = document.getElementById('app');
const topAdSlot = document.getElementById('ad-top-slot');
const bottomStickyAdSlot = document.getElementById('ad-bottom-sticky');

// Master AbortController to detach the #app error listener once hydration completes
const cleanupController = new AbortController();
const cleanupSignal = cleanupController.signal;

// Read initial site defaults directly from DOM
const DEFAULT_SITE_NAME =
  document.getElementById('brand-link')?.textContent.trim().replace(/\s+/g, ' ') ||
  document.title.trim() ||
  'Technical Knowledge Base';
const DEFAULT_DESC = document.getElementById('meta-desc')?.getAttribute('content') || '';
const DEFAULT_KEYWORDS = document.getElementById('meta-keywords')?.getAttribute('content') || '';

// Ad Unit Configurations (hiibel.com) - Mutable reference so it can be garbage-collected on teardown
let AD_UNITS = {
  desktopTop: {
    key: '6bc878b50f4ca4fe0f9f00a24603655f',
    width: 728,
    height: 90,
    src: 'https://hiibel.com/22/6bc878b50f4ca4fe0f9f00a24603655f'
  },
  mobileTop: {
    key: '659b04a20a0861b7619a7103d607c7d3',
    width: 320,
    height: 50,
    src: 'https://hiibel.com/22/659b04a20a0861b7619a7103d607c7d3'
  },
  desktopBottom: {
    key: 'a215683d2d0ce8fecd54e01b99606d75',
    width: 300,
    height: 250,
    src: 'https://hiibel.com/22/a215683d2d0ce8fecd54e01b99606d75'
  },
  mobileBottom: {
    key: '659b04a20a0861b7619a7103d607c7d3',
    width: 320,
    height: 50,
    src: 'https://hiibel.com/22/659b04a20a0861b7619a7103d607c7d3'
  }
};

// In-Memory 600x400 SVG Data URI Fallback (Zero Network Requests, Zero Retry Loops)
const FALLBACK_SVG_URI =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">' +
      '<rect width="100%" height="100%" fill="#e2e8f0"/>' +
      '<rect x="16" y="16" width="568" height="368" rx="4" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/>' +
      '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#475569" font-family="system-ui,sans-serif" font-size="15">Technical Diagram Unavailable</text>' +
    '</svg>'
  );

// Initialize Footer Year & Default Open Graph Image
const footerYearEl = document.getElementById('footer-year');
if (footerYearEl) footerYearEl.textContent = new Date().getFullYear();

const ogImageEl = document.getElementById('og-image');
if (ogImageEl) ogImageEl.setAttribute('content', FALLBACK_SVG_URI);

// Capture-Phase Image Error Guard (Bound to cleanupSignal; detached immediately in finalizeEngine)
appContainer.addEventListener(
  'error',
  (event) => {
    const target = event.target;
    if (!target || target.tagName !== 'IMG') return;
    if (target.dataset.fallbackApplied === '1') return;
    target.dataset.fallbackApplied = '1';
    target.removeAttribute('srcset');
    target.src = FALLBACK_SVG_URI;
  },
  { capture: true, signal: cleanupSignal }
);

// ============================================================================
// PARALLEL <HEAD> IN-FLIGHT PROMISE CONSUMER (CSR v2.0)
// ============================================================================
function fetchPrimaryJson(url) {
  const prefetched = window.__CSR_PREFETCH__;
  if (prefetched) {
    delete window.__CSR_PREFETCH__;
    if (prefetched.u === url && prefetched.p) {
      return prefetched.p;
    }
  }
  return fetch(url, {
    priority: 'high',
    cache: 'no-store'
  });
}

// ============================================================================
// STATELESS ROUTE FINGERPRINTING & IMMEDIATE SELF-CLEANING TEARDOWN
// ============================================================================
function setRouteFingerprint({ route, category = '', slug = '' }) {
  if (!document.body) return;
  document.body.setAttribute('data-route', route);
  if (category) {
    document.body.setAttribute('data-category', category);
  } else {
    document.body.removeAttribute('data-category');
  }
  if (slug) {
    document.body.setAttribute('data-slug', slug);
  } else {
    document.body.removeAttribute('data-slug');
  }
}

function removeScriptTag() {
  const scriptById = document.getElementById('csr-app-script');
  if (scriptById) {
    scriptById.remove();
    return;
  }
  const scriptBySrc = document.querySelector('script[src*="app.js"], script[src*="app-v2.js"]');
  if (scriptBySrc) scriptBySrc.remove();
}

function finalizeEngine() {
  // Ensure no unclaimed prefetch promise remains on window (e.g., on 404 or invalid query params)
  if (window.__CSR_PREFETCH__) {
    delete window.__CSR_PREFETCH__;
  }

  if (cleanupSignal.aborted) return;

  // 1. Detach the capture-phase image error listener on #app (zero active listeners left)
  cleanupController.abort();

  // 2. Remove the <script> tag from the live DOM
  removeScriptTag();

  // 3. Release object references for V8 Garbage Collection
  Templates = null;
  AD_UNITS = null;
}

function setAppBusy(isBusy) {
  appContainer.setAttribute('aria-busy', isBusy ? 'true' : 'false');
}

function safeImgUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return FALLBACK_SVG_URI;
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  return FALLBACK_SVG_URI;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toIsoDate(epochSeconds) {
  if (!epochSeconds || Number.isNaN(Number(epochSeconds))) {
    return new Date().toISOString();
  }
  return new Date(Number(epochSeconds) * 1000).toISOString();
}

function formatReadableDate(epochSeconds) {
  if (!epochSeconds || Number.isNaN(Number(epochSeconds))) return '';
  return new Date(Number(epochSeconds) * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function buildCategoryPath(categorySlug) {
  return `/?category=${encodeURIComponent(categorySlug)}`;
}

function buildArticlePath(categorySlug, articleSlug) {
  return `/?category=${encodeURIComponent(categorySlug)}&slug=${encodeURIComponent(articleSlug)}`;
}

// Single-Article ImageObject Builder (Excludes data: URIs for Google Rich Results compliance)
function buildArticleImageObjects(images = [], articleTitle = '', fullArticleUrl = '') {
  if (!Array.isArray(images) || images.length === 0) return [];
  const items = [];

  images.forEach((img, idx) => {
    const cleanUrl = safeImgUrl(img?.url);
    if (cleanUrl === FALLBACK_SVG_URI) return;

    const label = String(img?.title || img?.alt || articleTitle || 'Technical Diagram').trim();
    const altDesc = String(img?.alt || img?.title || articleTitle || 'Technical Diagram').trim();

    items.push({
      '@type': 'ImageObject',
      '@id': `${fullArticleUrl}#image-${idx + 1}`,
      url: cleanUrl,
      contentUrl: cleanUrl,
      name: label,
      caption: `Fig. ${idx + 1} \u2014 ${label}`,
      description: altDesc,
      width: Number(img?.width) || 600,
      height: Number(img?.height) || 400,
      representativeOfPage: idx === 0
    });
  });

  return items;
}

function groupSentencesIntoParagraphs(sentences = [], fallbackContent = '', perParagraph = 4) {
  if (Array.isArray(sentences) && sentences.length > 0) {
    const paragraphs = [];
    for (let i = 0; i < sentences.length; i += perParagraph) {
      const chunk = sentences
        .slice(i, i + perParagraph)
        .map((s) => escapeHtml(String(s).trim()))
        .filter(Boolean)
        .join(' ');
      if (chunk) paragraphs.push(`<p>${chunk}</p>`);
    }
    return paragraphs.join('');
  }
  if (fallbackContent) {
    return `<p>${escapeHtml(fallbackContent)}</p>`;
  }
  return '';
}

// ============================================================================
// BOT-AWARE IMMEDIATE GLOBAL AD MANAGER (HUMANS ONLY)
// ============================================================================
function mountAdIframe(containerEl, unit) {
  if (!containerEl || !unit) return;
  containerEl.innerHTML = '';
  containerEl.hidden = false;

  const iframe = document.createElement('iframe');
  iframe.className = 'ad-iframe';
  iframe.width = String(unit.width);
  iframe.height = String(unit.height);
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('title', 'Advertisement');

  const optionsJson = JSON.stringify({
    key: unit.key,
    format: 'iframe',
    height: unit.height,
    width: unit.width,
    params: {}
  });

  iframe.srcdoc =
    `<!DOCTYPE html><html><head><base href="${SITE_ORIGIN}/"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;}</style></head><body>` +
    `<script>atOptions = ${optionsJson};<\/script>` +
    `<script src="${unit.src}"><\/script>` +
    '</body></html>';

  containerEl.appendChild(iframe);
}

function clearGlobalAds() {
  if (topAdSlot) {
    topAdSlot.innerHTML = '';
    topAdSlot.hidden = true;
  }
  if (bottomStickyAdSlot) {
    bottomStickyAdSlot.innerHTML = '';
    bottomStickyAdSlot.hidden = true;
  }
  if (document.body) {
    document.body.style.paddingBottom = '';
  }
}

// Immediate Global Ads (Humans Only):
// 1. Top Banner: 320x50 on Mobile (<=767px) or 728x90 on Non-Mobile (>=768px)
// 2. Sticky Bottom Banner: 320x50 on Mobile (<=767px) or 300x250 on Non-Mobile (>=768px) without scrolling
function scheduleGlobalAds() {
  if (IS_SEARCH_BOT || !AD_UNITS) {
    if (IS_SEARCH_BOT) clearGlobalAds();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (AD_UNITS) {
          const isMobile = window.matchMedia('(max-width: 767px)').matches;
          if (topAdSlot) {
            const selectedTopUnit = isMobile ? AD_UNITS.mobileTop : AD_UNITS.desktopTop;
            mountAdIframe(topAdSlot, selectedTopUnit);
          }
          if (bottomStickyAdSlot) {
            const selectedBottomUnit = isMobile ? AD_UNITS.mobileBottom : AD_UNITS.desktopBottom;
            mountAdIframe(bottomStickyAdSlot, selectedBottomUnit);
            if (document.body && selectedBottomUnit) {
              document.body.style.paddingBottom = `${selectedBottomUnit.height + 14}px`;
            }
          }
        }
        resolve();
      }, 0);
    });
  });
}

// ============================================================================
// ISOLATED MODULAR HTML TEMPLATES (Homepage-Only Bottom Categories)
// ============================================================================
let Templates = {
  homeCategoriesBox(categories = []) {
    if (!Array.isArray(categories) || categories.length === 0) return '';
    const itemsHtml = categories
      .map((cat) => {
        const href = buildCategoryPath(cat.category);
        return `
          <li>
            <a class="nav-link" href="${href}">
              <span>${escapeHtml(cat.label || cat.category)}</span>
              ${typeof cat.count === 'number' ? `<span class="nav-count">(${cat.count})</span>` : ''}
            </a>
          </li>
        `;
      })
      .join('');

    return `
      <div class="home-categories-header">
        <h2 class="home-categories-title">Browse All Technical Categories (${categories.length})</h2>
      </div>
      <ul class="home-categories-list">
        ${itemsHtml}
      </ul>
    `;
  },

  articleCard(card, index = 0) {
    const articleHref = card.url || buildArticlePath(card.category, card.slug);
    const categoryHref = buildCategoryPath(card.category);
    const imgSrc = safeImgUrl(card.thumbnail || card.image);
    const imgAlt = card.imageAlt || card.title || 'Technical specification diagram';
    const specCode = `#${String(index + 1).padStart(2, '0')}`;

    return `
      <li class="article-card">
        <a class="card-media" href="${escapeHtml(articleHref)}">
          <img
            src="${escapeHtml(imgSrc)}"
            alt="${escapeHtml(imgAlt)}"
            width="600"
            height="400"
            loading="lazy"
            decoding="async"
          />
        </a>
        <div class="card-body">
          <div class="card-top-meta">
            <a class="card-category" href="${escapeHtml(categoryHref)}">
              ${escapeHtml(card.categoryLabel || card.category)}
            </a>
            <span class="card-code">${specCode}</span>
          </div>
          <h2 class="card-title">
            <a href="${escapeHtml(articleHref)}">${escapeHtml(card.title)}</a>
          </h2>
          <p class="card-excerpt">${escapeHtml(card.excerpt || '')}</p>
        </div>
      </li>
    `;
  },

  listingView({
    heading,
    subheading = '',
    breadcrumbLabel = '',
    articles = [],
    showHomeCategories = false,
    categories = []
  }) {
    const breadcrumbHtml = breadcrumbLabel
      ? `<nav class="breadcrumb" aria-label="Breadcrumb">
           <a href="/">Home</a> &raquo; <span>${escapeHtml(breadcrumbLabel)}</span>
         </nav>`
      : '';

    const gridHtml =
      articles.length > 0
        ? `<ul class="article-grid">${articles.map((c, idx) => Templates.articleCard(c, idx)).join('')}</ul>`
        : `<p>No technical articles available in this section.</p>`;

    // Render Category Directory ONLY on Homepage at Bottom of Main (Below Articles)
    let homeCategoriesHtml = '';
    if (showHomeCategories) {
      const hasImmediateCategories = Array.isArray(categories) && categories.length > 0;
      homeCategoriesHtml = `
        <section id="home-categories-slot" class="home-categories" aria-label="Technical Categories Directory"${hasImmediateCategories ? '' : ' hidden'}>
          ${hasImmediateCategories ? Templates.homeCategoriesBox(categories) : ''}
        </section>
      `;
    }

    return `
      <section>
        ${breadcrumbHtml}
        <header class="section-header">
          <h1 class="section-title">${escapeHtml(heading)}</h1>
          ${subheading ? `<p class="section-subtitle">${escapeHtml(subheading)}</p>` : ''}
        </header>
        ${gridHtml}
        ${homeCategoriesHtml}
      </section>
    `;
  },

  singleArticle(article) {
    const categoryHref = buildCategoryPath(article.category);
    const images = Array.isArray(article.images) ? article.images : [];
    const heroImg = images.length > 0 ? images[0] : null;
    const readableDate = formatReadableDate(article.updatedAt || article.createdAt);
    const isoDate = toIsoDate(article.updatedAt || article.createdAt);

    // 1. Hero Image (images[0])
    const heroHtml = heroImg
      ? `<figure class="article-hero">
           <img
             src="${escapeHtml(safeImgUrl(heroImg.url))}"
             alt="${escapeHtml(heroImg.alt || article.title)}"
             width="${Number(heroImg.width) || 600}"
             height="${Number(heroImg.height) || 400}"
             fetchpriority="high"
             decoding="async"
           />
           <figcaption>Fig. 1 &mdash; ${escapeHtml(heroImg.title || heroImg.alt || article.title)}</figcaption>
         </figure>`
      : '';

    // 2. Article Text Body (sentences[])
    const bodyParagraphsHtml = groupSentencesIntoParagraphs(article.sentences, article.content, 4);

    // 3. Full Technical Diagrams Gallery (All images[] from 0 to images.length - 1)
    const galleryHtml =
      images.length > 0
        ? `<section class="article-gallery" aria-label="Technical Diagrams Gallery">
             <h2 class="gallery-heading">Technical Diagrams &amp; Schematics (${images.length})</h2>
             <div class="gallery-grid">
               ${images
                 .map(
                   (img, idx) => `
                     <figure class="gallery-card">
                       <img
                         src="${escapeHtml(safeImgUrl(img.url))}"
                         alt="${escapeHtml(img.alt || img.title || article.title)}"
                         width="${Number(img.width) || 600}"
                         height="${Number(img.height) || 400}"
                         loading="lazy"
                         decoding="async"
                       />
                       <figcaption>Fig. ${idx + 1} &mdash; ${escapeHtml(img.title || img.alt || article.title)}</figcaption>
                     </figure>
                   `
                 )
                 .join('')}
             </div>
           </section>`
        : '';

    // 4. Single Article + Phase 2 Low-Priority Bottom Link Slots
    return `
      <div class="single-article-wrap">
        <article class="single-article">
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="/">Home</a> &raquo;
            <a href="${escapeHtml(categoryHref)}">${escapeHtml(article.categoryLabel || article.category)}</a> &raquo;
            <span>${escapeHtml(article.title)}</span>
          </nav>

          <h1 class="article-title">${escapeHtml(article.title)}</h1>

          <div class="article-meta">
            <span>Category: <a href="${escapeHtml(categoryHref)}">${escapeHtml(article.categoryLabel || article.category)}</a></span>
            ${readableDate ? `<span>&bull; Updated <time datetime="${escapeHtml(isoDate)}">${escapeHtml(readableDate)}</time></span>` : ''}
            ${article.imageCount ? `<span>&bull; ${Number(article.imageCount)} Diagrams</span>` : ''}
          </div>

          ${heroHtml}

          <div class="article-body">
            ${bodyParagraphsHtml}
          </div>

          ${galleryHtml}
        </article>

        <!-- Phase 2 Low-Priority Bottom Hydration Slots (Dispatched Synchronously for WRS) -->
        <section id="related-posts-slot" class="bottom-links-section related-posts" hidden></section>
        <aside id="cross-domain-slot" class="bottom-links-section cross-domain-links" hidden></aside>
      </div>
    `;
  },

  relatedPosts(items = []) {
    return `
      <h2 class="bottom-links-title">Related Technical Guides</h2>
      <ul class="link-list">
        ${items
          .map((item) => {
            const href = item.url || buildArticlePath(item.category, item.slug);
            return `
              <li class="link-list-item">
                <a class="link-item-title" href="${escapeHtml(href)}">${escapeHtml(item.title)}</a>
                <p class="link-item-meta">
                  <strong>${escapeHtml(item.categoryLabel || item.category)}:</strong>
                  ${escapeHtml(item.excerpt || '')}
                </p>
              </li>
            `;
          })
          .join('')}
      </ul>
    `;
  },

  crossDomainLinks(pairs = []) {
    return `
      <h2 class="bottom-links-title">Recommended Partner Technical Resources</h2>
      <ul class="link-list">
        ${pairs
          .map(
            (pair) => `
              <li class="link-list-item">
                <a class="link-item-title" href="${escapeHtml(pair.fullUrl)}">${escapeHtml(pair.title)}</a>
                <p class="link-item-meta">
                  <span>${escapeHtml(pair.domainHost)}</span> &bull;
                  <span>${escapeHtml(pair.categoryLabel)}</span>
                </p>
              </li>
            `
          )
          .join('')}
      </ul>
    `;
  },

  notFound(message) {
    return `
      <section class="single-article-wrap">
        <div class="single-article">
          <h1 class="article-title">404 - Page Not Found</h1>
          <p>${escapeHtml(message)}</p>
          <p><a href="/">&larr; Return to Homepage</a></p>
        </div>
      </section>
    `;
  }
};

// ============================================================================
// IN-PLACE SEO & HOMEPAGE-ONLY CATEGORY FALLBACK HYDRATION
// ============================================================================
async function hydrateHomeCategoriesIfMissing() {
  const slot = document.getElementById('home-categories-slot');
  if (!slot || !slot.hidden) return;
  try {
    const res = await fetch(`${API_BASE}/api/categories`, {
      priority: 'low',
      cache: 'no-store'
    });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.categories) && data.categories.length > 0 && Templates) {
      slot.innerHTML = Templates.homeCategoriesBox(data.categories);
      slot.hidden = false;
    }
  } catch (_) {
    // Non-critical fallback failure ignored
  }
}

function updateSEO({
  title,
  description,
  keywords = DEFAULT_KEYWORDS,
  canonicalPath,
  robots = 'index, follow',
  ogType = 'website',
  ogImage = FALLBACK_SVG_URI,
  schema = null
}) {
  const cleanCanonicalPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
  const fullCanonicalUrl = `${SITE_ORIGIN}${cleanCanonicalPath}`;

  document.title = title;
  document.getElementById('meta-desc')?.setAttribute('content', description);
  document.getElementById('meta-keywords')?.setAttribute('content', keywords);
  document.getElementById('meta-robots')?.setAttribute('content', robots);
  document.getElementById('canonical-link')?.setAttribute('href', fullCanonicalUrl);

  document.getElementById('og-type')?.setAttribute('content', ogType);
  document.getElementById('og-title')?.setAttribute('content', title);
  document.getElementById('og-desc')?.setAttribute('content', description);
  document.getElementById('og-url')?.setAttribute('content', fullCanonicalUrl);
  document.getElementById('og-image')?.setAttribute('content', safeImgUrl(ogImage));

  const schemaEl = document.getElementById('schema-jsonld');
  if (schemaEl) {
    schemaEl.textContent = schema ? JSON.stringify(schema) : '';
  }
}

function renderNotFound(message = 'The requested technical resource could not be found.') {
  clearGlobalAds();
  setRouteFingerprint({ route: 'not-found' });
  updateSEO({
    title: `404 - Page Not Found | ${DEFAULT_SITE_NAME}`,
    description: message,
    canonicalPath: `${window.location.pathname}${window.location.search}`,
    robots: 'noindex, nofollow',
    schema: null
  });
  if (Templates) {
    appContainer.innerHTML = Templates.notFound(message);
  }
  setAppBusy(false);
  finalizeEngine();
}

// ============================================================================
// STATELESS ROUTE HANDLERS (Consumes <head> Parallel Prefetch + WRS Queue)
// ============================================================================

// 1. HOMEPAGE ROUTE: / (24 Articles + Bottom Category Directory Hub)
async function renderHome() {
  try {
    const res = await fetchPrimaryJson(`${API_BASE}/api/articles/random?limit=24`);
    if (!res.ok) throw new Error('Failed to load homepage feed');

    const data = await res.json();
    const articles = Array.isArray(data.articles) ? data.articles : [];
    const categories = Array.isArray(data.categories) ? data.categories : [];

    const firstValidCard = articles.find((a) => safeImgUrl(a.image || a.thumbnail) !== FALLBACK_SVG_URI);
    const firstImage = firstValidCard
      ? safeImgUrl(firstValidCard.image || firstValidCard.thumbnail)
      : FALLBACK_SVG_URI;

    const homeSchema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: DEFAULT_SITE_NAME,
          url: `${SITE_ORIGIN}/`,
          description: DEFAULT_DESC
        },
        {
          '@type': 'ItemList',
          itemListElement: articles.map((item, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            url: `${SITE_ORIGIN}${item.url || buildArticlePath(item.category, item.slug)}`,
            name: item.title
          }))
        }
      ]
    };

    setRouteFingerprint({ route: 'home' });

    updateSEO({
      title: DEFAULT_SITE_NAME,
      description: DEFAULT_DESC,
      keywords: DEFAULT_KEYWORDS,
      canonicalPath: '/',
      robots: articles.length > 0 ? 'index, follow' : 'noindex, follow',
      ogType: 'website',
      ogImage: firstImage,
      schema: homeSchema
    });

    appContainer.innerHTML = Templates.listingView({
      heading: data.categoryLabel
        ? `Featured Technical Guides: ${data.categoryLabel}`
        : 'Featured Technical Specifications & Guides',
      subheading: 'Explore verified schematics, diagnostic procedures, and component specifications.',
      articles,
      showHomeCategories: true,
      categories
    });
    setAppBusy(false);

    // Dispatch fallback category fetch synchronously (zero rAF gap for WRS) + Global Ads
    const categoryHydrationPromise =
      categories.length === 0 ? hydrateHomeCategoriesIfMissing() : Promise.resolve();
    const globalAdsPromise = scheduleGlobalAds();

    await Promise.all([categoryHydrationPromise, globalAdsPromise]);
    finalizeEngine();
  } catch (_) {
    renderNotFound('Unable to load homepage technical listings.');
  }
}

// 2. DYNAMIC CATEGORY ROUTE: /?category=<db> (Distinct CollectionPage + ItemList Graph)
async function renderCategory(categorySlug) {
  try {
    const res = await fetchPrimaryJson(
      `${API_BASE}/api/category/${encodeURIComponent(categorySlug)}?limit=24`
    );
    if (res.status === 404) {
      return renderNotFound(`Category "${categorySlug}" was not found.`);
    }
    if (!res.ok) throw new Error('Category fetch failed');

    const data = await res.json();
    const articles = Array.isArray(data.articles) ? data.articles : [];
    const trueCategory = data.category || categorySlug;
    const categoryLabel = data.categoryLabel || trueCategory;
    const canonicalPath = buildCategoryPath(trueCategory);
    const fullCategoryUrl = `${SITE_ORIGIN}${canonicalPath}`;
    const categoryDescription = `Browse ${data.totalInCategory || articles.length} technical specifications, diagrams, and troubleshooting articles in ${categoryLabel}.`;

    const firstValidCard = articles.find((a) => safeImgUrl(a.image || a.thumbnail) !== FALLBACK_SVG_URI);
    const firstImage = firstValidCard
      ? safeImgUrl(firstValidCard.image || firstValidCard.thumbnail)
      : FALLBACK_SVG_URI;

    const categorySchema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          name: `${categoryLabel} Specifications & Diagrams | ${DEFAULT_SITE_NAME}`,
          description: categoryDescription,
          url: fullCategoryUrl
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: `${SITE_ORIGIN}/`
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: categoryLabel,
              item: fullCategoryUrl
            }
          ]
        },
        {
          '@type': 'ItemList',
          itemListElement: articles.map((item, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            url: `${SITE_ORIGIN}${item.url || buildArticlePath(item.category || trueCategory, item.slug)}`,
            name: item.title
          }))
        }
      ]
    };

    setRouteFingerprint({ route: 'category', category: trueCategory });

    updateSEO({
      title: `${categoryLabel} Specifications & Diagrams | ${DEFAULT_SITE_NAME}`,
      description: categoryDescription,
      keywords: `${categoryLabel}, ${DEFAULT_KEYWORDS}`,
      canonicalPath,
      robots: articles.length > 0 ? 'index, follow' : 'noindex, follow',
      ogType: 'website',
      ogImage: firstImage,
      schema: categorySchema
    });

    appContainer.innerHTML = Templates.listingView({
      heading: categoryLabel,
      subheading: `${data.totalInCategory || articles.length} indexed technical articles in ${categoryLabel}.`,
      breadcrumbLabel: categoryLabel,
      articles,
      showHomeCategories: false
    });
    setAppBusy(false);

    await scheduleGlobalAds();
    finalizeEngine();
  } catch (_) {
    renderNotFound('Unable to load category articles.');
  }
}

// 3. SINGLE ARTICLE ROUTE: /?category=<db>&slug=<slug> (Includes Structured ImageObject Array)
async function renderArticle(categorySlug, articleSlug) {
  try {
    // PHASE 1: Consume In-Flight <head> Prefetch (or High-Priority Fetch Fallback)
    const res = await fetchPrimaryJson(
      `${API_BASE}/api/article?category=${encodeURIComponent(categorySlug)}&slug=${encodeURIComponent(articleSlug)}`
    );
    if (res.status === 404 || res.status === 400) {
      return renderNotFound('The requested technical article could not be found.');
    }
    if (!res.ok) throw new Error('Single article fetch failed');

    const article = await res.json();
    const trueCategory = article.category || categorySlug;
    const trueSlug = article.slug || articleSlug;
    const categoryLabel = article.categoryLabel || trueCategory;
    const canonicalPath = article.canonicalPath || buildArticlePath(trueCategory, trueSlug);
    const fullArticleUrl = `${SITE_ORIGIN}${canonicalPath}`;
    const fullCategoryUrl = `${SITE_ORIGIN}${buildCategoryPath(trueCategory)}`;

    const images = Array.isArray(article.images) ? article.images : [];
    const imageObjects = buildArticleImageObjects(images, article.title, fullArticleUrl);
    const primaryOgImage = imageObjects.length > 0 ? imageObjects[0].url : FALLBACK_SVG_URI;

    const publishedIso = toIsoDate(article.createdAt);
    const modifiedIso = toIsoDate(article.updatedAt || article.createdAt);
    const metaDesc = article.metaDesc || (article.sentences && article.sentences[0]) || DEFAULT_DESC;
    const metaKeywords = article.metaKeywords || `${article.keyword || ''}, ${categoryLabel}`;

    const articleSchema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Article',
          headline: article.title,
          description: metaDesc,
          keywords: metaKeywords,
          ...(imageObjects.length > 0
            ? {
                primaryImageOfPage: { '@id': imageObjects[0]['@id'] },
                image: imageObjects
              }
            : {}),
          datePublished: publishedIso,
          dateModified: modifiedIso,
          author: {
            '@type': 'Organization',
            name: DEFAULT_SITE_NAME,
            url: `${SITE_ORIGIN}/`
          },
          publisher: {
            '@type': 'Organization',
            name: DEFAULT_SITE_NAME,
            url: `${SITE_ORIGIN}/`
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': fullArticleUrl
          }
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: `${SITE_ORIGIN}/`
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: categoryLabel,
              item: fullCategoryUrl
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: article.title,
              item: fullArticleUrl
            }
          ]
        }
      ]
    };

    setRouteFingerprint({ route: 'article', category: trueCategory, slug: trueSlug });

    updateSEO({
      title: `${article.title} | ${DEFAULT_SITE_NAME}`,
      description: metaDesc,
      keywords: metaKeywords,
      canonicalPath,
      robots: 'index, follow',
      ogType: 'article',
      ogImage: primaryOgImage,
      schema: articleSchema
    });

    // Paint Primary Article Immediately (Hero + Sentences + All Images Gallery)
    appContainer.innerHTML = Templates.singleArticle(article);
    setAppBusy(false);

    // PHASE 2: Dispatched synchronously (zero rAF network-idle gap so Googlebot WRS captures all links)
    const bottomLinksPromise = hydrateArticleBottomSlots(trueCategory, trueSlug);
    const globalAdsPromise = scheduleGlobalAds();

    await Promise.all([bottomLinksPromise, globalAdsPromise]);
    finalizeEngine();
  } catch (_) {
    renderNotFound('Unable to load the requested technical article.');
  }
}

// PHASE 2 HELPER: Low-Priority Related Posts (limit=5) & Cross-Domain Links (limit=5)
function hydrateArticleBottomSlots(categorySlug, currentArticleSlug) {
  const relatedSlot = document.getElementById('related-posts-slot');
  const crossDomainSlot = document.getElementById('cross-domain-slot');

  // 2A. Same-Domain Related Posts (limit=5, request 6 to filter out current slug)
  const relatedPromise = relatedSlot
    ? fetch(
        `${API_BASE}/api/articles/random?category=${encodeURIComponent(categorySlug)}&limit=6`,
        {
          priority: 'low',
          cache: 'no-store'
        }
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !Array.isArray(data.articles) || !Templates) return;
          const relatedItems = data.articles
            .filter((item) => item.slug !== currentArticleSlug)
            .slice(0, 5);

          if (relatedItems.length > 0) {
            relatedSlot.innerHTML = Templates.relatedPosts(relatedItems);
            relatedSlot.hidden = false;
          }
        })
        .catch(() => {})
    : Promise.resolve();

  // 2B. Cross-Domain Related Links (limit=5 domains + limit=5 random articles)
  const crossDomainPromise = crossDomainSlot
    ? Promise.all([
        fetch(`${API_BASE}/api/domains/status?limit=5`, {
          priority: 'low',
          cache: 'no-store'
        }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_BASE}/api/articles/random?limit=5`, {
          priority: 'low',
          cache: 'no-store'
        }).then((r) => (r.ok ? r.json() : null))
      ])
        .then(([domainData, articleData]) => {
          if (!domainData || !articleData || !Templates) return;
          const domains = Array.isArray(domainData.activeDomains) ? domainData.activeDomains : [];
          const articles = Array.isArray(articleData.articles) ? articleData.articles : [];
          const count = Math.min(5, domains.length, articles.length);

          if (count === 0) return;

          const pairs = [];
          for (let i = 0; i < count; i++) {
            const cleanOrigin = String(domains[i]).replace(/\/+$/, '');
            const art = articles[i];
            const path = art.url || buildArticlePath(art.category, art.slug);
            let domainHost = cleanOrigin;
            try {
              domainHost = new URL(cleanOrigin).hostname;
            } catch (_) {}

            pairs.push({
              fullUrl: `${cleanOrigin}${path}`,
              title: art.title,
              domainHost,
              categoryLabel: art.categoryLabel || art.category
            });
          }

          if (pairs.length > 0) {
            crossDomainSlot.innerHTML = Templates.crossDomainLinks(pairs);
            crossDomainSlot.hidden = false;
          }
        })
        .catch(() => {})
    : Promise.resolve();

  return Promise.all([relatedPromise, crossDomainPromise]);
}

// ============================================================================
// STATELESS INITIAL PAGE-LOAD DISPATCHER
// ============================================================================
function initPage() {
  setAppBusy(true);

  const pathname = window.location.pathname;
  if (pathname !== '/' && pathname !== '/index.html') {
    return renderNotFound('Page path does not exist.');
  }

  // Automatically ignores Blogger's mobile ?m=1 or ?m=0 query parameters
  const params = new URLSearchParams(window.location.search);
  const category = (params.get('category') || '').trim();
  const slug = (params.get('slug') || '').trim();

  if (!category && !slug) {
    return renderHome();
  }
  if (category && !slug) {
    return renderCategory(category);
  }
  if (category && slug) {
    return renderArticle(category, slug);
  }

  return renderNotFound('Invalid query parameters.');
}

initPage();
