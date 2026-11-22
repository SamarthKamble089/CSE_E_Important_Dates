async function showScheduleLoading(panel, button, message, load) {
  const pixels = panel.querySelector('.schedule-pixels');
  const region = panel.querySelector('[data-schedule-table]');
  if (!pixels.children.length) {
    for (let index = 0; index < 18; index++) {
      const tile = document.createElement('span');
      tile.style.setProperty('--pixel-delay', index % 6 + Math.floor(index / 6));
      pixels.append(tile);
    }
  }
  button.disabled = true;
  panel.setAttribute('data-loading', '');
  region.setAttribute('aria-busy', 'true');
  panel.querySelector('.schedule-loader span[data-load-message]').textContent = message;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    const [result] = await Promise.allSettled([
      load(),
      new Promise(resolve => setTimeout(resolve, reducedMotion ? 0 : 520))
    ]);
    if (result.status === 'rejected') throw result.reason;
  } finally {
    panel.removeAttribute('data-loading');
    region.setAttribute('aria-busy', 'false');
    button.disabled = false;
  }
}
