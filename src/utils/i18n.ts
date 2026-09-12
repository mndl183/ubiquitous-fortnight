export type Locale = 'en' | 'es' | 'fr' | 'de';

export const locales: Locale[] = ['en', 'es', 'fr', 'de'];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch'
};

export function getLocaleFromPath(pathname: string): Locale {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && locales.includes(segments[0] as Locale)) {
    return segments[0] as Locale;
  }
  return defaultLocale;
}

export function getLocalizedPath(pathname: string, locale: Locale): string {
  const segments = pathname.split('/').filter(Boolean);
  const withoutLocale = segments[0] && locales.includes(segments[0] as Locale)
    ? segments.slice(1).join('/')
    : segments.join('/');

  if (!withoutLocale) return `/${locale}/`;
  return `/${locale}/${withoutLocale}`;
}

export function getAlternateUrls(pathname: string): { locale: Locale; url: string }[] {
  return locales.map(locale => ({
    locale,
    url: getLocalizedPath(pathname, locale)
  }));
}

// Paths (normalized: leading and trailing slash) that have real, fully
// translated content in every locale. Everything else only exists in `en`,
// so links for other locales fall back to the English page.
const FULLY_TRANSLATED_PATHS = new Set([
  '/',
  '/privacy/',
  '/terms/',
  '/contact/',
  '/tools/compress-pdf/',
]);

export function isFullyTranslated(path: string): boolean {
  return FULLY_TRANSLATED_PATHS.has(path);
}

export function normalizePath(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean.endsWith('/') ? clean : `${clean}/`;
}

// Href for content links (nav, footer, related tools, breadcrumbs, ...).
// Uses the localized version when it exists, otherwise falls back to English.
export function getContentHref(locale: Locale | string, path: string): string {
  const suffix = normalizePath(path);
  const root = suffix === '/';
  if (root) return `/${locale}/`;
  if (locale === 'en' || isFullyTranslated(suffix)) {
    return `/${locale}${suffix}`;
  }
  return `/en${suffix}`;
}

// Href for the language switcher. Uses the localized version when it exists,
// otherwise falls back to the locale homepage.
export function getSwitcherHref(locale: Locale | string, pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const withoutLocale = segments[0] && locales.includes(segments[0] as Locale)
    ? segments.slice(1).join('/')
    : segments.join('/');
  const suffix = normalizePath(withoutLocale);
  if (suffix === '/' || locale === 'en') {
    return suffix === '/' ? `/${locale}/` : `/${locale}${suffix}`;
  }
  if (isFullyTranslated(suffix)) {
    return `/${locale}${suffix}`;
  }
  return `/${locale}/`;
}

import es from '../i18n/es.json';
import fr from '../i18n/fr.json';
import de from '../i18n/de.json';

export const translations = { es, fr, de, en: {} };

export function t(locale: Locale, key: string): string {
  if (locale === 'en') return key;
  const keys = key.split('.');
  let value: any = translations[locale];
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key;
    }
  }
  return typeof value === 'string' ? value : key;
}