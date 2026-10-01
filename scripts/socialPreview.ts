import type { Plugin } from 'vite';

export function socialImageUrl(siteUrl: string): string {
  const url = new URL(siteUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('VITE_SITE_URL must be a public HTTP or HTTPS URL without credentials.');
  }
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return new URL('social-preview.png', url).href;
}

export function socialPreviewPlugin(env: Record<string, string>): Plugin {
  const siteUrl = env.VITE_SITE_URL || env.URL;
  return {
    name: 'social-preview',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!siteUrl && !context.server) {
          this.warn('Set VITE_SITE_URL (or Netlify URL) for an absolute social-preview image URL.');
        }
        const imageUrl = siteUrl
          ? socialImageUrl(siteUrl)
          : context.server
            ? socialImageUrl(context.server.resolvedUrls?.local[0] || 'http://localhost:5173/')
            : '/social-preview.png';
        return html.replaceAll('https://social-preview.invalid/social-preview.png', imageUrl.replaceAll('&', '&amp;').replaceAll('"', '&quot;'));
      },
    },
  };
}