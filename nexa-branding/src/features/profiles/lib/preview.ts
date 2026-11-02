import { channels } from '@/features/channels/model/registry';
import { platforms, type Channel, type Platform } from '@/features/channels/model/types';
import { channelPath, type Locale } from '@/shared/lib/locale';
import { downloadFile, downloadCover } from './downloads';

export function initializePreview() {
  const dialog = document.querySelector<HTMLDialogElement>('#channel-preview');
  if (!dialog) return;
  const locale: Locale = dialog.dataset.locale === 'en' ? 'en' : 'es';
  let current: Channel | undefined;
  let platform: Platform = 'youtube';
  let trigger: HTMLElement | null = null;
  const status = dialog.querySelector<HTMLElement>('[data-preview-status]');
  const message = (es: string, en: string) => {
    if (status) status.textContent = locale === 'es' ? es : en;
  };
  const copyText = async (value: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;left:0;top:0;opacity:0;width:1px;height:1px';
    dialog.append(area);
    area.focus();
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    previous?.focus();
    if (!copied) throw new Error('Copy unavailable');
  };
  const tabs = [...dialog.querySelectorAll<HTMLButtonElement>('[data-platform]')];
  const panels = [...dialog.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  const syncUrl = () => {
    if (!current) return;
    const url = new URL(location.href);
    url.searchParams.set('canal', current.id);
    url.searchParams.set('red', platform);
    history.replaceState(null, '', url);
  };
  const selectPlatform = (next: Platform) => {
    platform = next;
    tabs.forEach((tab) => {
      const selected = tab.dataset.platform === platform;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.id !== `panel-${platform}`;
    });
    if (current) {
      const profile = current.socials[platform];
      const visit = dialog.querySelector<HTMLAnchorElement>('[data-visit-profile]');
      if (visit) {
        visit.hidden = !profile.url;
        if (profile.url) visit.href = profile.url;
        else visit.removeAttribute('href');
      }
    }
    message('', '');
    syncUrl();
  };
  const open = (id: string, source: HTMLElement | null = null) => {
    current = channels.find((channel) => channel.id === id);
    if (!current) return;
    trigger = source;
    dialog
      .querySelectorAll<HTMLElement>('[data-profile-channel]')
      .forEach((profile) => (profile.hidden = profile.dataset.profileChannel !== id));
    dialog
      .querySelectorAll<HTMLElement>('[data-outro-channel]')
      .forEach((el) => (el.hidden = el.dataset.outroChannel !== id));
    const title = dialog.querySelector('#preview-title');
    if (title) title.textContent = current.name;
    const detail = dialog.querySelector<HTMLAnchorElement>('[data-channel-detail]');
    if (detail) detail.href = channelPath(id, locale);
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('dialog-open');
    selectPlatform(platform);
  };
  document
    .querySelectorAll<HTMLElement>('[data-open-channel]')
    .forEach((button) =>
      button.addEventListener('click', () => open(button.dataset.openChannel || '', button)),
    );
  dialog.querySelector('[data-close-preview]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      const pointer = event as MouseEvent;
      if (
        pointer.clientX < rect.left ||
        pointer.clientX > rect.right ||
        pointer.clientY < rect.top ||
        pointer.clientY > rect.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('dialog-open');
    const url = new URL(location.href);
    url.searchParams.delete('canal');
    url.searchParams.delete('red');
    history.replaceState(null, '', url);
    trigger?.focus();
  });
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectPlatform(tab.dataset.platform as Platform));
    tab.addEventListener('keydown', (event) => {
      let target = index;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = tabs.length - 1;
      else return;
      event.preventDefault();
      const next = tabs[target];
      if (next) {
        selectPlatform(next.dataset.platform as Platform);
        next.focus();
      }
    });
  });
  dialog.querySelector('[data-copy-name]')?.addEventListener('click', async () => {
    if (!current) return;
    try {
      await copyText(current.name);
      message('Nombre copiado.', 'Name copied.');
    } catch {
      message('No se pudo copiar el nombre.', 'Name could not be copied.');
    }
  });
  dialog.querySelector('[data-copy-description]')?.addEventListener('click', async () => {
    if (!current) return;
    try {
      await copyText(current.description[locale]);
      message('Descripción copiada.', 'Description copied.');
    } catch {
      message(
        'No se pudo copiar. Selecciona la descripción del perfil.',
        'Copy unavailable. Select the profile description.',
      );
    }
  });
  for (const [selector, key, suffix] of [
    ['[data-download-logo]', 'medallion', 'logo'],
    ['[data-download-symbol]', 'symbol', 'transparent'],
  ] as const) {
    dialog.querySelector(selector)?.addEventListener('click', () => {
      if (!current) return;
      const asset = current[key];
      downloadFile(asset, `${current.id}-${suffix}.${asset.split('.').pop()}`);
      message('Descarga iniciada.', 'Download started.');
    });
  }
  dialog.querySelector('[data-download-cover]')?.addEventListener('click', async () => {
    if (!current) return;
    try {
      await downloadCover(current, platform, locale);
      message('Portada descargada.', 'Cover downloaded.');
    } catch {
      message(
        'No se pudo crear la portada. Inténtalo de nuevo.',
        'Cover could not be created. Try again.',
      );
    }
  });
  const params = new URLSearchParams(location.search);
  const requested = params.get('red');
  if (platforms.includes(requested as Platform)) platform = requested as Platform;
  const id = params.get('canal');
  if (id) open(id);
}
