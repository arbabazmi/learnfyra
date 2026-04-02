/**
 * @file src/lib/pageMeta.ts
 * @description Lightweight per-page SEO — sets <title>, meta description,
 * and Open Graph tags via DOM manipulation (no react-helmet dependency).
 *
 * Usage:
 *   usePageMeta({
 *     title: 'Dashboard',
 *     description: 'Track your worksheet progress and scores.',
 *   });
 */

import { useEffect } from 'react';

const SITE_NAME = 'Learnfyra';
const DEFAULT_OG_IMAGE = '/images/Logos/colored-logo.png';
const DEFAULT_OG_TYPE = 'website';

export interface PageMetaOptions {
  /** Page-specific title — will be formatted as "{title} | Learnfyra" */
  title: string;
  /** Page-specific meta description (recommended 120–158 chars) */
  description: string;
  /** Override OG title (defaults to title) */
  ogTitle?: string;
  /** Override OG description (defaults to description) */
  ogDescription?: string;
  /** OG image URL — use absolute path or full URL */
  ogImage?: string;
  /** OG type — 'website' | 'article' | 'product' */
  ogType?: string;
  /** Comma-separated keywords for educational SEO */
  keywords?: string;
  /** Canonical URL for this page */
  canonicalUrl?: string;
}

/** Sets or creates a <meta> element with the given attribute=key and content. */
function setMeta(attr: 'name' | 'property', key: string, value: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

/** Sets or updates a <link rel="..."> element. */
function setLink(rel: string, href: string): void {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

const defaults = {
  title: `${SITE_NAME} — Practice. Learn. Grow.`,
  description:
    'Learnfyra generates AI-powered, USA curriculum-aligned worksheets for Grades 1–10. Practice online, get instant feedback, and track every score.',
  ogImage: DEFAULT_OG_IMAGE,
};

/**
 * Hook that updates page-level SEO metadata on mount.
 * Restores defaults on unmount (page navigation).
 */
export function usePageMeta(options: PageMetaOptions): void {
  const {
    title,
    description,
    ogTitle,
    ogDescription,
    ogImage = DEFAULT_OG_IMAGE,
    ogType = DEFAULT_OG_TYPE,
    keywords,
    canonicalUrl,
  } = options;

  useEffect(() => {
    const fullTitle = `${title} | ${SITE_NAME}`;

    // ── Title ──────────────────────────────────────────────────────────
    document.title = fullTitle;

    // ── Standard meta ─────────────────────────────────────────────────
    setMeta('name', 'description', description);
    if (keywords) setMeta('name', 'keywords', keywords);

    // ── Open Graph ────────────────────────────────────────────────────
    setMeta('property', 'og:title', ogTitle ?? title);
    setMeta('property', 'og:description', ogDescription ?? description);
    setMeta('property', 'og:image', ogImage);
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:site_name', SITE_NAME);
    if (canonicalUrl) {
      setMeta('property', 'og:url', canonicalUrl);
      setLink('canonical', canonicalUrl);
    }

    // ── Twitter Card ──────────────────────────────────────────────────
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', ogTitle ?? title);
    setMeta('name', 'twitter:description', ogDescription ?? description);
    setMeta('name', 'twitter:image', ogImage);

    return () => {
      document.title = defaults.title;
      setMeta('name', 'description', defaults.description);
      setMeta('property', 'og:title', SITE_NAME);
      setMeta('property', 'og:description', defaults.description);
      setMeta('property', 'og:image', defaults.ogImage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description]);
}
