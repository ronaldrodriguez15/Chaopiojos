import { API_BASE_URL } from '@/lib/config';

const backendOrigin = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch (error) {
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }
})();

const shouldRewriteToBackend = (pathname = '') => (
  pathname.startsWith('/api/')
  || pathname.startsWith('/storage/')
);

export const resolveMediaUrl = (value) => {
  if (!value) return '';

  const raw = String(value).trim();
  if (!raw) return '';

  if (raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return shouldRewriteToBackend(raw) && backendOrigin
      ? `${backendOrigin}${raw}`
      : raw;
  }

  try {
    const parsed = new URL(raw);
    console.log('backendOrigin:', backendOrigin);
    console.log('parsed.origin:', parsed.origin);
    console.log('resultado:', `${backendOrigin}${parsed.pathname}`);
    if (shouldRewriteToBackend(parsed.pathname) && backendOrigin) {
      return `${backendOrigin}${parsed.pathname}${parsed.search}`;
    }
    return parsed.toString();
  } catch (error) {
    return raw;
  }
};

export const buildDownloadUrl = (value) => {
  const resolved = resolveMediaUrl(value);
  if (!resolved) return '';

  try {
    const parsed = new URL(resolved, typeof window !== 'undefined' ? window.location.origin : backendOrigin || 'http://localhost');
    parsed.searchParams.set('download', '1');
    return parsed.toString();
  } catch (error) {
    return resolved.includes('?') ? `${resolved}&download=1` : `${resolved}?download=1`;
  }
};
