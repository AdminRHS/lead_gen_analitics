export function initControlsParallax() {
  const controls = document.querySelector('.controls');
  if (!controls) return;

  const updateGlow = (event) => {
    const rect = controls.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    controls.style.setProperty('--glow-x', `${x}%`);
    controls.style.setProperty('--glow-y', `${y}%`);
    controls.style.setProperty('--glow-opacity', '1');
  };

  const fadeGlow = () => {
    controls.style.setProperty('--glow-opacity', '0');
  };

  controls.addEventListener('mousemove', updateGlow);
  controls.addEventListener('mouseleave', fadeGlow);
}
