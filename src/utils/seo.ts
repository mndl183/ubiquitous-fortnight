export interface SeoMeta {
  title: string;
  description: string;
  ogImage?: string;
  canonical?: string;
  noindex?: boolean;
}

export function buildOgImageUrl(title: string, accent?: boolean): string {
  const encodedTitle = encodeURIComponent(title.slice(0, 60));
  const base = 'og:image created at build time';
  return `/og-images/${encodedTitle}.png`;
}

export function truncateDescription(text: string, maxLength = 160): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength - 3);
  return truncated.slice(0, truncated.lastIndexOf(' ')) + '...';
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
