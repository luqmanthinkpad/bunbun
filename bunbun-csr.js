/**
 * BunBunServer Modular CSR Engine (bunbun-csr.js)
 * Version: 2.2.1 (External CDN Edition — 4 CSR Lifecycle Polish Upgrades, Light Mode Only)
 * Backend API: https://bunbunserver.my.id
 *
 * Modules:
 *  - MODULE A: AppConfig & Loop-Proof SVG Fallback Handler (window.__BUNBUN_IMG_ERR__)
 *  - MODULE B: ThemeTemplates (Pluggable HTML Builders + Dedicated articleSkeleton)
 *  - MODULE C: SEOController (<head> meta & JSON-LD manager)
 *  - MODULE D: ApiClient (CORS-direct fetch + low-priority deferred fetcher + in-memory cache)
 *  - MODULE E: Router (4-View State Machine, Idle-Deferred Sidebar & History API)
 */
(function(window, document) {
  'use strict';

  /* -------------------------------------------------------------------------
     MODULE A: CONFIGURATION, CONSTANTS & LOOP-PROOF IMAGE FALLBACK
     ------------------------------------------------------------------------- */
  var FALLBACK_SVG_URI = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27600%27%20height%3D%27375%27%20viewBox%3D%270%200%20600%20375%27%3E%3Crect%20width%3D%27600%27%20height%3D%27375%27%20fill%3D%27%23EEF2F6%27%2F%3E%3Crect%20x%3D%27220%27%20y%3D%27145%27%20width%3D%27160%27%20height%3D%2785%27%20fill%3D%27none%27%20stroke%3D%27%2364748B%27%20stroke-width%3D%272%27%20stroke-dasharray%3D%275%205%27%2F%3E%3Ctext%20x%3D%2750%25%27%20y%3D%2751%25%27%20dominant-baseline%3D%27middle%27%20text-anchor%3D%27middle%27%20font-family%3D%27monospace%27%20font-size%3D%2712%27%20fill%3D%27%2364748B%27%3E%5BDIAGRAM%20UNAVAILABLE%5D%3C%2Ftext%3E%3C%2Fsvg%3E";

  /* Upgrade 4: Non-collapsing loop-proof image fallback (never hides <figure> or <figcaption>) */
  window.__BUNBUN_IMG_ERR__ = function(imgEl) {
    if (!imgEl) return;
    imgEl.onerror = null;
    if (imgEl.getAttribute('data-fallback-applied') === '1') return;
    imgEl.setAttribute('data-fallback-applied', '1');
    imgEl.src = FALLBACK_SVG_URI;
    imgEl.classList.add('bbs-img--fallback');
  };

  var AppConfig = {
    API_BASE: 'https://bunbunserver.my.id',
    SITE_TITLE: (document.getElementById('bbs-site-title') && document.getElementById('bbs-site-title').textContent.trim()) || document.title || 'Technical Specification Database',
    HOMEPAGE_LIMIT: 24,
    CATEGORY_LIMIT: 24,
    RELATED_POSTS_LIMIT: 10,
    CROSS_DOMAIN_LINKS_LIMIT: 5,
    SENTENCES_PER_PARAGRAPH: 3,
    PARAGRAPHS_PER_INLINE_IMAGE: 2,
    IGNORED_BLOGGER_PARAMS: ['m', 'zx', 'gclid', 'fbclid']
  };

  if (window.CustomAppConfig && typeof window.CustomAppConfig === 'object') {
    for (var cfgKey in window.CustomAppConfig) {
      if (Object.prototype.hasOwnProperty.call(window.CustomAppConfig, cfgKey)) {
        AppConfig[cfgKey] = window.CustomAppConfig[cfgKey];
      }
    }
  }

  /* -------------------------------------------------------------------------
     UTILITIES (HTML Escaping & Formatting)
     ------------------------------------------------------------------------- */
  var Utils = {
    escapeHtml: function(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    formatDate: function(epochSeconds) {
      if (!epochSeconds) return '';
      var d = new Date(epochSeconds * 1000);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    },
    toIsoDate: function(epochSeconds) {
      if (!epochSeconds) return new Date().toISOString();
      var d = new Date(epochSeconds * 1000);
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    },
    getCleanOrigin: function() {
      return window.location.origin;
    },
    getCleanHostname: function() {
      return window.location.hostname;
    },
    buildCanonicalUrl: function(relativePath) {
      var origin = Utils.getCleanOrigin();
      if (!relativePath || relativePath === '/') return origin + '/';
      return origin + (relativePath.charAt(0) === '/' ? relativePath : '/' + relativePath);
    }
  };

  /* -------------------------------------------------------------------------
     MODULE B: PLUGGABLE RENDER TEMPLATES (window.ThemeTemplates)
     ------------------------------------------------------------------------- */
  var ThemeTemplates = {
    /* 1. Category Navigation Pill */
    categoryPill: function(cat, activeCategorySlug) {
      var isAll = cat.category === 'all';
      var isActive = (isAll && (!activeCategorySlug || activeCategorySlug === 'all')) || (cat.category === activeCategorySlug);
      var href = isAll ? '/' : '/?category=' + encodeURIComponent(cat.category);
      var countBadge = typeof cat.count === 'number'
        ? '<span class="bbs-cat-pill__count">' + Utils.escapeHtml(cat.count) + '</span>'
        : '';
      return (
        '<a class="bbs-cat-pill' + (isActive ? ' is-active' : '') + '" data-csr-link="true" href="' + Utils.escapeHtml(href) + '">' +
          '<span>' + Utils.escapeHtml(cat.label) + '</span>' +
          countBadge +
        '</a>'
      );
    },

    /* 2. Listing Section Banner (Homepage, Search, Category) */
    listingBanner: function(eyebrow, title, metaRightHtml) {
      return (
        '<header class="bbs-view-banner">' +
          '<div>' +
            '<div class="bbs-view-banner__eyebrow">' + Utils.escapeHtml(eyebrow) + '</div>' +
            '<h1 class="bbs-view-banner__title">' + Utils.escapeHtml(title) + '</h1>' +
          '</div>' +
          (metaRightHtml ? '<div class="bbs-view-banner__meta">' + metaRightHtml + '</div>' : '') +
        '</header>'
      );
    },

    /* 3. Article Summary Card (Used on Homepage & Category Grids) */
    articleCard: function(card) {
      var articleHref = card.url || ('/?category=' + encodeURIComponent(card.category) + '&slug=' + encodeURIComponent(card.slug));
      var categoryHref = '/?category=' + encodeURIComponent(card.category);
      var imgSrc = card.thumbnail || card.image || FALLBACK_SVG_URI;

      return (
        '<article class="bbs-card">' +
          '<div class="bbs-card__media">' +
            '<a data-csr-link="true" href="' + Utils.escapeHtml(articleHref) + '" tabindex="-1">' +
              '<img class="bbs-card__img" src="' + Utils.escapeHtml(imgSrc) + '" alt="' + Utils.escapeHtml(card.imageAlt || card.title) + '" loading="lazy" width="600" height="375" onerror="window.__BUNBUN_IMG_ERR__(this)"/>' +
            '</a>' +
            '<a class="bbs-card__badge" data-csr-link="true" href="' + Utils.escapeHtml(categoryHref) + '">' +
              Utils.escapeHtml(card.categoryLabel || card.category) +
            '</a>' +
          '</div>' +
          '<div class="bbs-card__body">' +
            '<h2 class="bbs-card__title">' +
              '<a data-csr-link="true" href="' + Utils.escapeHtml(articleHref) + '">' +
                Utils.escapeHtml(card.title) +
              '</a>' +
            '</h2>' +
            '<p class="bbs-card__excerpt">' + Utils.escapeHtml(card.excerpt || '') + '</p>' +
            '<div class="bbs-card__footer">' +
              '<span class="bbs-card__specs">' +
                '<span>' + Utils.escapeHtml(card.imageCount || 0) + ' diag</span>' +
                '<span>&bull;</span>' +
                '<span>' + Utils.escapeHtml(card.sentenceCount || 0) + ' lines</span>' +
              '</span>' +
              '<time datetime="' + Utils.escapeHtml(Utils.toIsoDate(card.updatedAt)) + '">' +
                Utils.escapeHtml(Utils.formatDate(card.updatedAt)) +
              '</time>' +
            '</div>' +
          '</div>' +
        '</article>'
      );
    },

    /* 4. Single Article View (Interleaves sentences[] and images[] + Sidebar Mounts) */
    singleArticleView: function(article) {
      var catHref = '/?category=' + encodeURIComponent(article.category);
      var images = Array.isArray(article.images) ? article.images : [];
      var sentences = Array.isArray(article.sentences) && article.sentences.length > 0
        ? article.sentences
        : (article.content ? [article.content] : []);

      /* Group validated sentences into readable technical paragraphs */
      var paragraphs = [];
      var chunkSize = AppConfig.SENTENCES_PER_PARAGRAPH;
      for (var i = 0; i < sentences.length; i += chunkSize) {
        paragraphs.push(sentences.slice(i, i + chunkSize).join(' '));
      }

      /* Hero Figure (Image #0) with locked aspect-ratio wrapper & non-collapsing SVG fallback */
      var heroHtml = '';
      if (images.length > 0) {
        var heroImg = images[0];
        heroHtml = (
          '<figure class="bbs-hero-figure">' +
            '<div class="bbs-hero-figure__img-wrap">' +
              '<img class="bbs-hero-figure__img" id="bbs-primary-article-img" src="' + Utils.escapeHtml(heroImg.url || heroImg.thumb || FALLBACK_SVG_URI) + '" alt="' + Utils.escapeHtml(heroImg.alt || article.title) + '" width="' + Utils.escapeHtml(heroImg.width || 600) + '" height="' + Utils.escapeHtml(heroImg.height || 375) + '" loading="eager" fetchpriority="high" decoding="async" onerror="window.__BUNBUN_IMG_ERR__(this)"/>' +
            '</div>' +
            '<figcaption class="bbs-figure__caption">' +
              '<span>FIG 01 — ' + Utils.escapeHtml(heroImg.title || article.title) + '</span>' +
              (heroImg.domain ? '<span>Source: ' + Utils.escapeHtml(heroImg.domain) + '</span>' : '') +
            '</figcaption>' +
          '</figure>'
        );
      }

      /* Interleave paragraphs and inline technical diagrams with locked aspect-ratio wrapper */
      var proseHtml = '';
      var nextImageIdx = 1;
      for (var pIdx = 0; pIdx < paragraphs.length; pIdx++) {
        var pClass = pIdx === 0 ? ' class="bbs-prose__lead"' : '';
        proseHtml += '<p' + pClass + '>' + Utils.escapeHtml(paragraphs[pIdx]) + '</p>';

        if ((pIdx + 1) % AppConfig.PARAGRAPHS_PER_INLINE_IMAGE === 0 && nextImageIdx < images.length && nextImageIdx <= 4) {
          var inlineImg = images[nextImageIdx];
          var figNum = nextImageIdx + 1;
          proseHtml += (
            '<figure class="bbs-inline-figure">' +
              '<div class="bbs-inline-figure__img-wrap">' +
                '<img class="bbs-inline-figure__img" src="' + Utils.escapeHtml(inlineImg.url || inlineImg.thumb || FALLBACK_SVG_URI) + '" alt="' + Utils.escapeHtml(inlineImg.alt || inlineImg.title || article.title) + '" width="' + Utils.escapeHtml(inlineImg.width || 600) + '" height="' + Utils.escapeHtml(inlineImg.height || 375) + '" loading="lazy" decoding="async" onerror="window.__BUNBUN_IMG_ERR__(this)"/>' +
              '</div>' +
              '<figcaption class="bbs-figure__caption">' +
                '<span>FIG 0' + figNum + ' — ' + Utils.escapeHtml(inlineImg.title || article.keyword) + '</span>' +
                (inlineImg.filetype ? '<span>[' + Utils.escapeHtml(inlineImg.filetype.toUpperCase()) + ']</span>' : '') +
              '</figcaption>' +
            '</figure>'
          );
          nextImageIdx++;
        }
      }

      /* Remaining diagrams rendered in structured schematic gallery */
      var galleryHtml = '';
      if (nextImageIdx < images.length) {
        var galleryItems = '';
        for (var gIdx = nextImageIdx; gIdx < images.length; gIdx++) {
          var gImg = images[gIdx];
          galleryItems += (
            '<figure class="bbs-gallery-card">' +
              '<a href="' + Utils.escapeHtml(gImg.url || gImg.thumb) + '" target="_blank" rel="noopener">' +
                '<img class="bbs-gallery-card__img" src="' + Utils.escapeHtml(gImg.thumb || gImg.url || FALLBACK_SVG_URI) + '" alt="' + Utils.escapeHtml(gImg.alt || gImg.title || article.title) + '" width="400" height="300" loading="lazy" decoding="async" onerror="window.__BUNBUN_IMG_ERR__(this)"/>' +
              '</a>' +
              '<figcaption class="bbs-gallery-card__cap">' +
                Utils.escapeHtml(gImg.title || article.keyword) +
              '</figcaption>' +
            '</figure>'
          );
        }
        galleryHtml = (
          '<section class="bbs-gallery">' +
            '<h2 class="bbs-gallery__title">Additional Schematics &amp; Reference Diagrams</h2>' +
            '<div class="bbs-gallery__grid">' + galleryItems + '</div>' +
          '</section>'
        );
      }

      /* Keyword Tags */
      var tagsHtml = '';
      if (article.metaKeywords) {
        var kwList = article.metaKeywords.split(',');
        var tagLinks = '';
        for (var k = 0; k < kwList.length; k++) {
          var kw = kwList[k].trim();
          if (!kw) continue;
          tagLinks += '<a class="bbs-tag" data-csr-link="true" href="/?q=' + encodeURIComponent(kw) + '">#' + Utils.escapeHtml(kw) + '</a>';
        }
        if (tagLinks) {
          tagsHtml = '<footer class="bbs-tags" aria-label="Technical keywords">' + tagLinks + '</footer>';
        }
      }

      return (
        '<div class="bbs-article-layout">' +
          '<article class="bbs-article">' +
            '<nav class="bbs-breadcrumb" aria-label="Breadcrumb">' +
              '<a data-csr-link="true" href="/">Home</a>' +
              '<span>/</span>' +
              '<a data-csr-link="true" href="' + Utils.escapeHtml(catHref) + '">' + Utils.escapeHtml(article.categoryLabel || article.category) + '</a>' +
              '<span>/</span>' +
              '<span>' + Utils.escapeHtml(article.slug) + '</span>' +
            '</nav>' +
            '<header class="bbs-article__header">' +
              '<h1 class="bbs-article__title">' + Utils.escapeHtml(article.title) + '</h1>' +
              '<div class="bbs-article__meta">' +
                '<a class="bbs-meta-chip bbs-meta-chip--accent" data-csr-link="true" href="' + Utils.escapeHtml(catHref) + '">' +
                  Utils.escapeHtml(article.categoryLabel || article.category) +
                '</a>' +
                '<span class="bbs-meta-chip">ID #' + Utils.escapeHtml(article.id) + '</span>' +
                '<span class="bbs-meta-chip">' + Utils.escapeHtml(article.imageCount || images.length) + ' Diagrams</span>' +
                '<span class="bbs-meta-chip">' + Utils.escapeHtml(article.sentenceCount || sentences.length) + ' Spec Lines</span>' +
                '<time class="bbs-meta-chip" datetime="' + Utils.escapeHtml(Utils.toIsoDate(article.updatedAt)) + '">Updated ' + Utils.escapeHtml(Utils.formatDate(article.updatedAt)) + '</time>' +
              '</div>' +
            '</header>' +
            heroHtml +
            '<div class="bbs-prose">' + proseHtml + '</div>' +
            galleryHtml +
            tagsHtml +
          '</article>' +

          '<aside class="bbs-sidebar" aria-label="Related technical specifications">' +
            '<section class="bbs-panel">' +
              '<div class="bbs-panel__header">' +
                '<h2 class="bbs-panel__title">Related Specifications</h2>' +
                '<span class="bbs-panel__tag">LOCAL INDEX</span>' +
              '</div>' +
              '<div class="bbs-rel-mount bbs-rel-mount--ten" id="bbs-related-posts-mount">' +
                ThemeTemplates.sidebarSkeleton(10) +
              '</div>' +
            '</section>' +
            '<section class="bbs-panel">' +
              '<div class="bbs-panel__header">' +
                '<h2 class="bbs-panel__title">Partner Network Specs</h2>' +
                '<span class="bbs-panel__tag bbs-panel__tag--amber">CROSS-DOMAIN</span>' +
              '</div>' +
              '<div class="bbs-rel-mount bbs-rel-mount--five" id="bbs-cross-domain-mount">' +
                ThemeTemplates.sidebarSkeleton(5) +
              '</div>' +
            '</section>' +
          '</aside>' +
        '</div>'
      );
    },

    /* 5. Deferred Same-Domain Related Posts List (10 items) */
    relatedPostsList: function(articles) {
      if (!Array.isArray(articles) || articles.length === 0) {
        return '<p class="bbs-rel-item__meta">No related specifications found.</p>';
      }
      var items = '';
      for (var i = 0; i < articles.length; i++) {
        var item = articles[i];
        var href = item.url || ('/?category=' + encodeURIComponent(item.category) + '&slug=' + encodeURIComponent(item.slug));
        items += (
          '<li class="bbs-rel-item">' +
            '<a class="bbs-rel-item__link" data-csr-link="true" href="' + Utils.escapeHtml(href) + '">' +
              Utils.escapeHtml(item.title) +
            '</a>' +
            '<div class="bbs-rel-item__meta">' +
              '<span>' + Utils.escapeHtml(item.categoryLabel || item.category) + '</span>' +
              '<span>&bull;</span>' +
              '<span>' + Utils.escapeHtml(item.imageCount || 0) + ' diag</span>' +
            '</div>' +
          '</li>'
        );
      }
      return '<ul class="bbs-rel-list">' + items + '</ul>';
    },

    /* 6. Deferred Cross-Domain Related Links List (5 items paired with /api/domains/status - Only Title & Href) */
    crossDomainLinksList: function(articles, activeDomains) {
      if (!Array.isArray(articles) || articles.length === 0) {
        return '<p class="bbs-rel-item__meta">No external network links available.</p>';
      }
      var domains = Array.isArray(activeDomains) && activeDomains.length > 0
        ? activeDomains
        : [Utils.getCleanOrigin()];

      var items = '';
      for (var i = 0; i < articles.length; i++) {
        var art = articles[i];
        var rawOrigin = domains[i % domains.length].replace(/\/+$/, '');
        var path = art.url || ('/?category=' + encodeURIComponent(art.category) + '&slug=' + encodeURIComponent(art.slug));
        var fullUrl = rawOrigin + (path.charAt(0) === '/' ? path : '/' + path);

        items += (
          '<li class="bbs-rel-item">' +
            '<a class="bbs-rel-item__link" href="' + Utils.escapeHtml(fullUrl) + '" target="_blank" rel="noopener">' +
              Utils.escapeHtml(art.title) +
            '</a>' +
          '</li>'
        );
      }
      return '<ul class="bbs-rel-list">' + items + '</ul>';
    },

    /* 7. Skeletons & Loading States (Upgrade 2: Dedicated articleSkeleton matching .bbs-article-layout) */
    gridSkeleton: function(count) {
      var cards = '';
      for (var i = 0; i < (count || 6); i++) {
        cards += (
          '<div class="bbs-card" aria-hidden="true">' +
            '<div class="bbs-card__media bbs-skeleton"></div>' +
            '<div class="bbs-card__body">' +
              '<div class="bbs-skeleton" style="height:20px;width:85%;margin-bottom:10px"></div>' +
              '<div class="bbs-skeleton" style="height:14px;width:100%;margin-bottom:6px"></div>' +
              '<div class="bbs-skeleton" style="height:14px;width:70%;margin-bottom:18px"></div>' +
              '<div class="bbs-skeleton" style="height:12px;width:45%"></div>' +
            '</div>' +
          '</div>'
        );
      }
      return '<div class="bbs-grid">' + cards + '</div>';
    },

    articleSkeleton: function() {
      return (
        '<div class="bbs-article-layout" aria-hidden="true">' +
          '<article class="bbs-article">' +
            '<div class="bbs-skeleton" style="height:14px;width:240px;margin-bottom:20px"></div>' +
            '<div class="bbs-article__header">' +
              '<div class="bbs-skeleton" style="height:36px;width:92%;margin-bottom:10px"></div>' +
              '<div class="bbs-skeleton" style="height:36px;width:65%;margin-bottom:16px"></div>' +
              '<div class="bbs-article__meta">' +
                '<span class="bbs-skeleton" style="height:26px;width:130px;display:inline-block"></span>' +
                '<span class="bbs-skeleton" style="height:26px;width:80px;display:inline-block"></span>' +
                '<span class="bbs-skeleton" style="height:26px;width:95px;display:inline-block"></span>' +
                '<span class="bbs-skeleton" style="height:26px;width:120px;display:inline-block"></span>' +
              '</div>' +
            '</div>' +
            '<figure class="bbs-hero-figure">' +
              '<div class="bbs-hero-figure__img-wrap bbs-skeleton"></div>' +
              '<div class="bbs-figure__caption">' +
                '<span class="bbs-skeleton" style="height:14px;width:55%;display:inline-block"></span>' +
              '</div>' +
            '</figure>' +
            '<div class="bbs-prose">' +
              '<div class="bbs-skeleton" style="height:18px;width:100%;margin-bottom:10px"></div>' +
              '<div class="bbs-skeleton" style="height:18px;width:96%;margin-bottom:10px"></div>' +
              '<div class="bbs-skeleton" style="height:18px;width:84%;margin-bottom:26px"></div>' +
              '<div class="bbs-skeleton" style="height:16px;width:100%;margin-bottom:9px"></div>' +
              '<div class="bbs-skeleton" style="height:16px;width:94%;margin-bottom:9px"></div>' +
              '<div class="bbs-skeleton" style="height:16px;width:76%;margin-bottom:24px"></div>' +
            '</div>' +
          '</article>' +
          '<aside class="bbs-sidebar">' +
            '<section class="bbs-panel">' +
              '<div class="bbs-panel__header">' +
                '<h2 class="bbs-panel__title">Related Specifications</h2>' +
                '<span class="bbs-panel__tag">LOCAL INDEX</span>' +
              '</div>' +
              '<div class="bbs-rel-mount bbs-rel-mount--ten">' +
                ThemeTemplates.sidebarSkeleton(10) +
              '</div>' +
            '</section>' +
            '<section class="bbs-panel">' +
              '<div class="bbs-panel__header">' +
                '<h2 class="bbs-panel__title">Partner Network Specs</h2>' +
                '<span class="bbs-panel__tag bbs-panel__tag--amber">CROSS-DOMAIN</span>' +
              '</div>' +
              '<div class="bbs-rel-mount bbs-rel-mount--five">' +
                ThemeTemplates.sidebarSkeleton(5) +
              '</div>' +
            '</section>' +
          '</aside>' +
        '</div>'
      );
    },

    sidebarSkeleton: function(rows) {
      var html = '';
      for (var i = 0; i < (rows || 5); i++) {
        html += (
          '<div style="margin-bottom:14px" aria-hidden="true">' +
            '<div class="bbs-skeleton" style="height:15px;width:92%;margin-bottom:6px"></div>' +
            '<div class="bbs-skeleton" style="height:12px;width:48%"></div>' +
          '</div>'
        );
      }
      return html;
    },

    /* 8. 404 / Empty Error View */
    error404View: function(title, message) {
      return (
        '<section class="bbs-state-box" role="alert">' +
          '<span class="bbs-state-box__code">HTTP 404 / NO MATCH</span>' +
          '<h1 class="bbs-state-box__title">' + Utils.escapeHtml(title || 'Page Not Found') + '</h1>' +
          '<p class="bbs-state-box__desc">' +
            Utils.escapeHtml(message || 'The requested specification, category database, or search query returned no matching records in memory.') +
          '</p>' +
          '<a class="bbs-btn" data-csr-link="true" href="/">Return to Specification Index</a>' +
        '</section>'
      );
    }
  };

  if (window.CustomThemeTemplates && typeof window.CustomThemeTemplates === 'object') {
    for (var tplKey in window.CustomThemeTemplates) {
      if (Object.prototype.hasOwnProperty.call(window.CustomThemeTemplates, tplKey)) {
        ThemeTemplates[tplKey] = window.CustomThemeTemplates[tplKey];
      }
    }
  }

  window.ThemeTemplates = ThemeTemplates;

  /* -------------------------------------------------------------------------
     MODULE C: SEO & JSON-LD CONTROLLER
     ------------------------------------------------------------------------- */
  var SEOController = {
    setMetaTag: function(id, attrName, value) {
      var el = document.getElementById(id);
      if (el) el.setAttribute(attrName, value || '');
    },

    removeJsonLdScripts: function() {
      var existingSchema = document.getElementById('json-ld-schema');
      if (existingSchema && existingSchema.parentNode) {
        existingSchema.parentNode.removeChild(existingSchema);
      }
      var existingBreadcrumb = document.getElementById('json-ld-breadcrumb');
      if (existingBreadcrumb && existingBreadcrumb.parentNode) {
        existingBreadcrumb.parentNode.removeChild(existingBreadcrumb);
      }
    },

    injectJsonLd: function(id, payloadObj) {
      var existing = document.getElementById(id);
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
      var script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      script.textContent = JSON.stringify(payloadObj);
      document.head.appendChild(script);
    },

    applyHomepageSEO: function(articles, query) {
      var cleanQuery = (query || '').trim();
      var pageTitle = cleanQuery
        ? 'Search: ' + cleanQuery + ' - ' + AppConfig.SITE_TITLE
        : AppConfig.SITE_TITLE;
      var canonicalUrl = Utils.buildCanonicalUrl('/');
      var desc = cleanQuery
        ? 'Technical specifications and schematic diagrams matching "' + cleanQuery + '" on ' + AppConfig.SITE_TITLE + '.'
        : 'Browse random technical specifications, diagnostic procedures, and engineering diagrams on ' + AppConfig.SITE_TITLE + '.';

      document.title = pageTitle;
      SEOController.setMetaTag('dynamic-robots', 'content', 'index, follow');
      SEOController.setMetaTag('dynamic-description', 'content', desc);
      SEOController.setMetaTag('dynamic-keywords', 'content', '');
      SEOController.setMetaTag('og-title', 'content', pageTitle);
      SEOController.setMetaTag('og-description', 'content', desc);
      SEOController.setMetaTag('og-url', 'content', canonicalUrl);
      SEOController.setMetaTag('og-type', 'content', 'website');

      SEOController.removeJsonLdScripts();

      var itemListElements = [];
      if (Array.isArray(articles)) {
        for (var i = 0; i < articles.length; i++) {
          var a = articles[i];
          var itemUrl = Utils.buildCanonicalUrl(a.url || ('/?category=' + encodeURIComponent(a.category) + '&slug=' + encodeURIComponent(a.slug)));
          itemListElements.push({
            '@type': 'ListItem',
            'position': i + 1,
            'name': a.title,
            'url': itemUrl
          });
        }
      }

      SEOController.injectJsonLd('json-ld-schema', {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            'name': AppConfig.SITE_TITLE,
            'url': canonicalUrl,
            'potentialAction': {
              '@type': 'SearchAction',
              'target': canonicalUrl + '?q={search_term_string}',
              'query-input': 'required name=search_term_string'
            }
          },
          {
            '@type': 'ItemList',
            'itemListElement': itemListElements
          }
        ]
      });
    },

    applyCategorySEO: function(categorySlug, categoryLabel, totalCount) {
      var pageTitle = (categoryLabel || categorySlug) + ' Specifications - ' + AppConfig.SITE_TITLE;
      var canonicalUrl = Utils.buildCanonicalUrl('/?category=' + encodeURIComponent(categorySlug));
      var desc = 'Explore ' + (totalCount || '') + ' technical specifications and wiring schematics in the ' + (categoryLabel || categorySlug) + ' category database.';

      document.title = pageTitle;
      SEOController.setMetaTag('dynamic-robots', 'content', 'index, follow');
      SEOController.setMetaTag('dynamic-description', 'content', desc);
      SEOController.setMetaTag('dynamic-keywords', 'content', categoryLabel || categorySlug);
      SEOController.setMetaTag('og-title', 'content', pageTitle);
      SEOController.setMetaTag('og-description', 'content', desc);
      SEOController.setMetaTag('og-url', 'content', canonicalUrl);
      SEOController.setMetaTag('og-type', 'content', 'website');

      SEOController.removeJsonLdScripts();
    },

    applySingleArticleSEO: function(article) {
      var pageTitle = article.title + ' - ' + AppConfig.SITE_TITLE;
      var canonicalPath = article.canonicalPath || ('/?category=' + encodeURIComponent(article.category) + '&slug=' + encodeURIComponent(article.slug));
      var canonicalUrl = Utils.buildCanonicalUrl(canonicalPath);
      var desc = article.metaDesc || (Array.isArray(article.sentences) && article.sentences[0]) || article.title;

      document.title = pageTitle;
      SEOController.setMetaTag('dynamic-robots', 'content', 'index, follow');
      SEOController.setMetaTag('dynamic-description', 'content', desc);
      SEOController.setMetaTag('dynamic-keywords', 'content', article.metaKeywords || article.keyword || '');
      SEOController.setMetaTag('og-title', 'content', pageTitle);
      SEOController.setMetaTag('og-description', 'content', desc);
      SEOController.setMetaTag('og-url', 'content', canonicalUrl);
      SEOController.setMetaTag('og-type', 'content', 'article');

      var firstImg = (Array.isArray(article.images) && article.images[0] && article.images[0].url) || '';
      SEOController.setMetaTag('og-image', 'content', firstImg);

      SEOController.removeJsonLdScripts();

      var imageObjects = [];
      if (Array.isArray(article.images)) {
        for (var i = 0; i < article.images.length; i++) {
          var img = article.images[i];
          imageObjects.push({
            '@type': 'ImageObject',
            'url': img.url,
            'width': img.width || 600,
            'height': img.height || 400,
            'caption': img.title || img.alt || article.title
          });
        }
      }

      var bodyText = Array.isArray(article.sentences) && article.sentences.length > 0
        ? article.sentences.join(' ')
        : (article.content || '');

      SEOController.injectJsonLd('json-ld-schema', {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': article.title,
        'description': desc,
        'keywords': article.metaKeywords || article.keyword || '',
        'articleSection': article.categoryLabel || article.category,
        'articleBody': bodyText,
        'image': imageObjects,
        'datePublished': Utils.toIsoDate(article.createdAt),
        'dateModified': Utils.toIsoDate(article.updatedAt),
        'mainEntityOfPage': {
          '@type': 'WebPage',
          '@id': canonicalUrl
        }
      });

      SEOController.injectJsonLd('json-ld-breadcrumb', {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': Utils.buildCanonicalUrl('/')
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': article.categoryLabel || article.category,
            'item': Utils.buildCanonicalUrl('/?category=' + encodeURIComponent(article.category))
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': article.title,
            'item': canonicalUrl
          }
        ]
      });
    },

    apply404SEO: function() {
      document.title = 'Page Not Found - ' + AppConfig.SITE_TITLE;
      SEOController.setMetaTag('dynamic-robots', 'content', 'noindex, nofollow');
      SEOController.removeJsonLdScripts();
    }
  };

  /* -------------------------------------------------------------------------
     MODULE D: API CLIENT (CORS-direct fetch + priority control + cache)
     ------------------------------------------------------------------------- */
  var ApiClient = {
    cache: {},

    fetchJson: function(path, useCache, priorityLevel) {
      var fullUrl = AppConfig.API_BASE + path;
      if (useCache && ApiClient.cache[fullUrl]) {
        return Promise.resolve(ApiClient.cache[fullUrl]);
      }
      var opts = {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      };
      if (priorityLevel) {
        opts.priority = priorityLevel;
      }
      return fetch(fullUrl, opts).then(function(response) {
        if (!response.ok) {
          var err = new Error('HTTP ' + response.status);
          err.status = response.status;
          throw err;
        }
        return response.json();
      }).then(function(data) {
        if (useCache) {
          ApiClient.cache[fullUrl] = data;
        }
        return data;
      });
    },

    getHomepageOrSearch: function(query) {
      var qParam = query ? '&q=' + encodeURIComponent(query) : '';
      return ApiClient.fetchJson('/api/articles/random?limit=' + AppConfig.HOMEPAGE_LIMIT + qParam, false, 'high');
    },

    getCategoryListing: function(categorySlug, query) {
      var qParam = query ? '&q=' + encodeURIComponent(query) : '';
      return ApiClient.fetchJson('/api/category/' + encodeURIComponent(categorySlug) + '?limit=' + AppConfig.CATEGORY_LIMIT + qParam, false, 'high');
    },

    getCategories: function() {
      return ApiClient.fetchJson('/api/categories', true, 'low');
    },

    getSingleArticle: function(categorySlug, articleSlug) {
      var path = '/api/article?category=' + encodeURIComponent(categorySlug) + '&slug=' + encodeURIComponent(articleSlug);
      return ApiClient.fetchJson(path, true, 'high');
    },

    /* Upgrade 3: Low-priority fetch for secondary sidebar widgets */
    getRandomArticlesLowPriority: function(limit) {
      return ApiClient.fetchJson('/api/articles/random?limit=' + (limit || 10), false, 'low');
    },

    getActiveDomainsLowPriority: function() {
      return ApiClient.fetchJson('/api/domains/status', false, 'low');
    }
  };

  /* Helper to schedule secondary sidebar fetches after main article DOM & hero image settle */
  function scheduleAfterPrimaryArticlePaint(taskFn) {
    var executed = false;
    function runOnce() {
      if (executed) return;
      executed = true;
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(taskFn, { timeout: 2000 });
      } else {
        setTimeout(taskFn, 200);
      }
    }

    var heroImg = document.getElementById('bbs-primary-article-img');
    if (heroImg && !heroImg.complete) {
      heroImg.addEventListener('load', runOnce, { once: true });
      heroImg.addEventListener('error', runOnce, { once: true });
      setTimeout(runOnce, 1200);
    } else {
      runOnce();
    }
  }

  /* -------------------------------------------------------------------------
     MODULE E: ROUTER & VIEW STATE MACHINE
     ------------------------------------------------------------------------- */
  var Router = {
    activeRequestId: 0,

    parseCurrentRoute: function() {
      var params = new URLSearchParams(window.location.search);
      var category = (params.get('category') || '').trim();
      var slug = (params.get('slug') || '').trim();
      var query = (params.get('q') || params.get('keyword') || '').trim();

      if (category && slug) {
        return { view: 'article', category: category, slug: slug, query: '' };
      }
      if (category) {
        return { view: 'category', category: category, slug: '', query: query };
      }
      return { view: 'home', category: '', slug: '', query: query };
    },

    renderCategoryBar: function(categories, activeCategorySlug, shouldShow) {
      var barEl = document.getElementById('bbs-catbar');
      var listEl = document.getElementById('bbs-catbar-list');
      if (!barEl || !listEl) return;

      if (!shouldShow || !Array.isArray(categories) || categories.length === 0) {
        barEl.setAttribute('hidden', 'hidden');
        return;
      }

      var totalArticles = 0;
      for (var i = 0; i < categories.length; i++) {
        totalArticles += (categories[i].count || 0);
      }

      var html = ThemeTemplates.categoryPill(
        { category: 'all', label: 'All Specifications', count: totalArticles },
        activeCategorySlug || 'all'
      );

      for (var j = 0; j < categories.length; j++) {
        html += ThemeTemplates.categoryPill(categories[j], activeCategorySlug);
      }

      listEl.innerHTML = html;
      barEl.removeAttribute('hidden');
    },

    render404: function(mountEl, title, message) {
      Router.renderCategoryBar([], '', false);
      SEOController.apply404SEO();
      mountEl.innerHTML = ThemeTemplates.error404View(title, message);
    },

    loadHomepageView: function(route, reqId, mountEl) {
      mountEl.innerHTML = ThemeTemplates.gridSkeleton(8);
      var searchInput = document.getElementById('bbs-search-input');
      if (searchInput) searchInput.value = route.query || '';

      ApiClient.getHomepageOrSearch(route.query)
        .then(function(data) {
          if (reqId !== Router.activeRequestId) return;
          var articles = (data && Array.isArray(data.articles)) ? data.articles : [];
          var categories = (data && Array.isArray(data.categories)) ? data.categories : [];

          if (articles.length === 0) {
            Router.render404(
              mountEl,
              route.query ? 'No Matching Specifications' : 'No Specifications Available',
              route.query ? 'No technical records matched "' + route.query + '". Try a broader sensor or system keyword.' : 'The in-memory specification database returned an empty listing.'
            );
            return;
          }

          Router.renderCategoryBar(categories, 'all', true);
          SEOController.applyHomepageSEO(articles, route.query);

          var eyebrow = route.query ? 'GLOBAL KEYWORD SEARCH' : 'RANDOMIZED MULTI-SQLITE SAMPLING';
          var heading = route.query ? 'Search Results for "' + route.query + '"' : 'Technical Specification Directory';
          var metaBadge = Utils.escapeHtml(articles.length + ' articles loaded · ' + categories.length + ' DBs');

          var cardsHtml = '';
          for (var i = 0; i < articles.length; i++) {
            cardsHtml += ThemeTemplates.articleCard(articles[i]);
          }

          mountEl.innerHTML =
            ThemeTemplates.listingBanner(eyebrow, heading, metaBadge) +
            '<section class="bbs-grid" aria-label="Technical specification cards">' + cardsHtml + '</section>';
        })
        .catch(function() {
          if (reqId !== Router.activeRequestId) return;
          Router.render404(mountEl, 'Page Not Found', 'Unable to load specifications from the backend engine.');
        });
    },

    loadCategoryView: function(route, reqId, mountEl) {
      mountEl.innerHTML = ThemeTemplates.gridSkeleton(8);

      ApiClient.getCategoryListing(route.category, route.query)
        .then(function(data) {
          if (reqId !== Router.activeRequestId) return;
          var articles = (data && Array.isArray(data.articles)) ? data.articles : [];
          if (articles.length === 0) {
            Router.render404(
              mountEl,
              'Category Not Found or Empty',
              'No technical specifications were found in category "' + route.category + '".'
            );
            return;
          }

          var catLabel = data.categoryLabel || route.category;
          SEOController.applyCategorySEO(route.category, catLabel, data.totalInCategory);

          var cardsHtml = '';
          for (var i = 0; i < articles.length; i++) {
            cardsHtml += ThemeTemplates.articleCard(articles[i]);
          }

          var metaBadge = Utils.escapeHtml((data.totalInCategory || articles.length) + ' total records in memory');
          mountEl.innerHTML =
            ThemeTemplates.listingBanner('CATEGORY DATABASE // ' + route.category.toUpperCase(), catLabel, metaBadge) +
            '<section class="bbs-grid" aria-label="Category specification cards">' + cardsHtml + '</section>';

          ApiClient.getCategories()
            .then(function(catResp) {
              if (reqId !== Router.activeRequestId) return;
              if (catResp && Array.isArray(catResp.categories)) {
                Router.renderCategoryBar(catResp.categories, route.category, true);
              }
            })
            .catch(function() {});
        })
        .catch(function() {
          if (reqId !== Router.activeRequestId) return;
          Router.render404(
            mountEl,
            'Category Database Not Found',
            'The category database "' + route.category + '" does not exist in memory.'
          );
        });
    },

    loadSingleArticleView: function(route, reqId, mountEl) {
      Router.renderCategoryBar([], '', false);
      /* Upgrade 2: Render matching 2-column articleSkeleton instead of 3-column gridSkeleton */
      mountEl.innerHTML = ThemeTemplates.articleSkeleton();

      ApiClient.getSingleArticle(route.category, route.slug)
        .then(function(article) {
          if (reqId !== Router.activeRequestId) return;
          if (!article || !article.title) {
            Router.render404(mountEl, 'Article Not Found', 'The requested specification could not be located.');
            return;
          }

          SEOController.applySingleArticleSEO(article);
          mountEl.innerHTML = ThemeTemplates.singleArticleView(article);
          window.scrollTo(0, 0);

          /* Upgrade 3: Defer low-priority sidebar fetches until after primary article paint/hero image settles */
          scheduleAfterPrimaryArticlePaint(function() {
            if (reqId !== Router.activeRequestId) return;

            ApiClient.getRandomArticlesLowPriority(AppConfig.RELATED_POSTS_LIMIT)
              .then(function(relData) {
                if (reqId !== Router.activeRequestId) return;
                var relMount = document.getElementById('bbs-related-posts-mount');
                if (relMount) {
                  var list = (relData && Array.isArray(relData.articles)) ? relData.articles : [];
                  relMount.innerHTML = ThemeTemplates.relatedPostsList(list);
                }
              })
              .catch(function() {
                var relMount = document.getElementById('bbs-related-posts-mount');
                if (relMount) relMount.innerHTML = '<p class="bbs-rel-item__meta">Unable to load related posts.</p>';
              });

            Promise.all([
              ApiClient.getRandomArticlesLowPriority(AppConfig.CROSS_DOMAIN_LINKS_LIMIT),
              ApiClient.getActiveDomainsLowPriority()
            ]).then(function(results) {
              if (reqId !== Router.activeRequestId) return;
              var randomFive = (results[0] && Array.isArray(results[0].articles)) ? results[0].articles : [];
              var domainInfo = results[1] || {};
              var domainPool = Array.isArray(domainInfo.activeDomains) && domainInfo.activeDomains.length > 0
                ? domainInfo.activeDomains
                : (Array.isArray(domainInfo.activeHttp200Domains) ? domainInfo.activeHttp200Domains : []);

              var crossMount = document.getElementById('bbs-cross-domain-mount');
              if (crossMount) {
                crossMount.innerHTML = ThemeTemplates.crossDomainLinksList(randomFive, domainPool);
              }
            }).catch(function() {
              var crossMount = document.getElementById('bbs-cross-domain-mount');
              if (crossMount) crossMount.innerHTML = '<p class="bbs-rel-item__meta">Unable to load network links.</p>';
            });
          });
        })
        .catch(function() {
          if (reqId !== Router.activeRequestId) return;
          Router.render404(
            mountEl,
            'Specification Not Found',
            'No article matched category "' + route.category + '" and slug "' + route.slug + '".'
          );
        });
    },

    dispatch: function() {
      var mountEl = document.getElementById('bbs-view-mount');
      if (!mountEl) return;

      Router.activeRequestId += 1;
      var currentReqId = Router.activeRequestId;
      var route = Router.parseCurrentRoute();

      if (route.view === 'article') {
        Router.loadSingleArticleView(route, currentReqId, mountEl);
      } else if (route.view === 'category') {
        Router.loadCategoryView(route, currentReqId, mountEl);
      } else {
        Router.loadHomepageView(route, currentReqId, mountEl);
      }
    },

    navigate: function(href) {
      if (!href) return;
      var targetUrl = new URL(href, window.location.origin);
      if (targetUrl.origin !== window.location.origin) {
        window.location.href = href;
        return;
      }
      window.history.pushState({}, '', targetUrl.pathname + targetUrl.search);
      Router.dispatch();
    },

    initEvents: function() {
      document.addEventListener('click', function(e) {
        var anchor = e.target.closest ? e.target.closest('a[data-csr-link="true"]') : null;
        if (!anchor) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        var href = anchor.getAttribute('href');
        if (!href) return;
        e.preventDefault();
        Router.navigate(href);
      });

      var searchForm = document.getElementById('bbs-search-form');
      if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
          e.preventDefault();
          var input = document.getElementById('bbs-search-input');
          var q = input ? input.value.trim() : '';
          Router.navigate(q ? '/?q=' + encodeURIComponent(q) : '/');
        });
      }

      window.addEventListener('popstate', function() {
        Router.dispatch();
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      Router.initEvents();
      Router.dispatch();
    });
  } else {
    Router.initEvents();
    Router.dispatch();
  }

})(window, document);
