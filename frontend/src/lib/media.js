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
    if (shouldRewriteToBackend(parsed.pathname) && backendOrigin) {
      return `${backendOrigin}${parsed.pathname}${parsed.search}`;
    }
    return parsed.toString();
  } catch (error) {
    return raw;
  }
};
