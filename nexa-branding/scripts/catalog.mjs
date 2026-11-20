export const platforms = ['youtube', 'instagram', 'facebook', 'tiktok'];
const domains = {
  youtube: ['www.youtube.com', 'youtube.com'],
  instagram: ['www.instagram.com', 'instagram.com'],
  facebook: ['www.facebook.com', 'facebook.com'],
  tiktok: ['www.tiktok.com', 'tiktok.com'],
};

export function validateCatalog(channels, networks, { assetExists = () => true } = {}) {
  const errors = [];
  const ids = new Set();
  const names = new Set();
  const networkIds = new Set(networks.map((n) => n.id));
  const urls = new Set();
  if (networkIds.size !== networks.length) errors.push('Network IDs must be unique.');
  if (!networks.some((n) => n.active)) errors.push('At least one network must be active.');
  for (const c of channels) {
    const label = c.id || '(missing ID)';
    if (!/^[a-z][a-z0-9-]*$/.test(c.id || '')) errors.push(`${label}: invalid ID.`);
    if (ids.has(c.id)) errors.push(`${label}: duplicate ID.`);
    ids.add(c.id);
    if (names.has(c.name)) errors.push(`${label}: duplicate name.`);
    names.add(c.name);
    if (!networkIds.has(c.networkId)) errors.push(`${label}: unknown network.`);
    if (!/^#[a-f0-9]{6}$/i.test(c.accent || '')) errors.push(`${label}: invalid accent.`);
    if (
      !c.position ||
      !['x', 'y'].every(
        (k) => Number.isFinite(c.position[k]) && c.position[k] >= 0 && c.position[k] <= 100,
      )
    )
      errors.push(`${label}: invalid emblem position.`);
    for (const key of ['category', 'headline', 'description', 'purpose', 'topics'])
      for (const locale of ['es', 'en']) {
        const value = c[key]?.[locale];
        if (
          key === 'topics'
            ? !Array.isArray(value) ||
              value.length < 1 ||
              value.some((x) => typeof x !== 'string' || !x.trim())
            : typeof value !== 'string' || !value.trim()
        )
          errors.push(`${label}: missing ${key}.${locale}.`);
      }
    for (const key of ['medallion', 'symbol']) {
      const path = c[key];
      if (
        typeof path !== 'string' ||
        !path.startsWith('/assets/') ||
        path.includes('..') ||
        !assetExists(path)
      )
        errors.push(`${label}: missing or unsafe ${key} asset.`);
    }
    for (const platform of platforms) {
      const social = c.socials?.[platform];
      if (!social) {
        errors.push(`${label}: missing ${platform} definition.`);
        continue;
      }
      if (social.handle !== null && !/^@[a-z0-9._-]+$/i.test(social.handle || ''))
        errors.push(`${label}: invalid ${platform} handle.`);
      if (!social.url) {
        if (platform === 'youtube') errors.push(`${label}: YouTube URL is required.`);
        continue;
      }
      try {
        const url = new URL(social.url);
        if (
          url.protocol !== 'https:' ||
          url.username ||
          url.password ||
          !domains[platform].includes(url.hostname)
        )
          throw new Error('Unsafe URL');
        if (urls.has(social.url)) errors.push(`${label}: duplicate social URL.`);
        urls.add(social.url);
        if (['youtube', 'instagram', 'tiktok'].includes(platform) && social.handle) {
          const path = url.pathname.replace(/\/$/, '');
          const expected =
            platform === 'instagram' ? `/${social.handle.slice(1)}` : `/${social.handle}`;
          if (path !== expected)
            errors.push(`${label}: ${platform} URL does not match its handle.`);
        }
      } catch {
        errors.push(`${label}: unsafe ${platform} URL.`);
      }
    }
  }
  return errors;
}
