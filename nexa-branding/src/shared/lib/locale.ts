export type Locale = 'es' | 'en';
export const text = <T>(locale: Locale, es: T, en: T): T => (locale === 'es' ? es : en);
export const homePath = (locale: Locale) => (locale === 'es' ? '/' : '/en/');
export const channelPath = (id: string, locale: Locale) =>
  locale === 'es' ? `/canales/${id}/` : `/en/channels/${id}/`;
export const alternatePath = (pathname: string) => {
  if (pathname.startsWith('/en/channels/')) return pathname.replace('/en/channels/', '/canales/');
  if (pathname.startsWith('/canales/')) return pathname.replace('/canales/', '/en/channels/');
  return pathname.startsWith('/en') ? '/' : '/en/';
};
