// NEXA BRIEF — configuración central de la composición.
// Cualquier plantilla nueva en src/components/ debería leer estos valores
// en vez de repetir números mágicos.

window.NexaBrief = window.NexaBrief || {};

window.NexaBrief.config = {
  compositionId: "main",
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 30, // extendido de 15s a 30s para la prueba de Lambda (30fps y 60fps)
  colors: {
    accent: "#ffb84d",
    danger: "#ff4d5e",
  },
};
