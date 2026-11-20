export function initializeSiteControls() {
  const toggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  const update = () =>
    toggle?.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));
  update();
  toggle?.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('node-brand-theme', theme);
    } catch {
      /* Storage can be unavailable. */
    }
    update();
  });
  const menuButton = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = document.querySelector<HTMLElement>('#mobile-navigation');
  const closeMenu = () => {
    if (menu) menu.hidden = true;
    menuButton?.setAttribute('aria-expanded', 'false');
  };
  menuButton?.addEventListener('click', () => {
    if (!menu) return;
    menu.hidden = !menu.hidden;
    menuButton.setAttribute('aria-expanded', String(!menu.hidden));
  });
  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
}
