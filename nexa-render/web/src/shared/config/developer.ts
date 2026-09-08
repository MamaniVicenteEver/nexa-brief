// Datos del desarrollador mostrados en el footer — configurables vía
// variables de entorno (NEXT_PUBLIC_DEV_*) en .env.local / .env.example,
// sin tocar código para cambiarlos.
export const developer = {
  name: process.env.NEXT_PUBLIC_DEV_NAME ?? "Ever Mamani Vicente",
  website: process.env.NEXT_PUBLIC_DEV_WEBSITE ?? "https://everdev.space/",
  email: process.env.NEXT_PUBLIC_DEV_EMAIL ?? "evermamanivicente@gmail.com",
  github: process.env.NEXT_PUBLIC_DEV_GITHUB ?? "https://github.com/evermamani",
  linkedin: process.env.NEXT_PUBLIC_DEV_LINKEDIN ?? "https://linkedin.com/in/evermamani",
  whatsapp: process.env.NEXT_PUBLIC_DEV_WHATSAPP ?? "591639801212",
};
