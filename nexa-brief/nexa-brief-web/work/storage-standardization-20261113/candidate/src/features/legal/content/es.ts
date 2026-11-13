import { LEGAL_ENTITY as E } from "../config";
import type { LegalContent } from "../types";
import { LINKS as L } from "./links";

const mail = `[${E.contactEmail}](mailto:${E.contactEmail})`;

export const es: LegalContent = {
  privacy: {
    slug: "privacy",
    title: "Política de privacidad",
    description: `Cómo ${E.appName} accede, usa, guarda, comparte y elimina la información de las cuentas de YouTube, TikTok y Facebook que conectas para publicar tus videos.`,
    highlights: [
      `Solo usamos los datos de tus cuentas para **publicar los videos que tú eliges** y mostrarte su estado y métricas. Nada más.`,
      "**No vendemos datos, no mostramos publicidad** y no usamos tus datos para entrenar modelos de inteligencia artificial.",
      "Los tokens de acceso se guardan **cifrados** (AES-128 + HMAC-SHA256, Fernet) en un servidor propio.",
      `Puedes desconectar una cuenta en cualquier momento y pedir el borrado total escribiendo a ${mail}.`,
    ],
    sections: [
      {
        id: "responsable",
        title: "Quiénes somos",
        blocks: [
          {
            type: "p",
            text: `${E.appName} (${E.website}) es un servicio web, con acceso solo por invitación, para creadores y equipos de contenido. Genera videos de forma automatizada y los publica en las cuentas de YouTube, TikTok y páginas de Facebook que el propio usuario conecta y autoriza.`,
          },
          {
            type: "p",
            text: `El responsable del tratamiento es **${E.operator}**, desarrollador independiente con domicilio en ${E.country.es}. Contacto para cualquier asunto de privacidad: ${mail}.`,
          },
          {
            type: "p",
            text: `Esta política se aplica al sitio ${E.website}, al panel de ${E.appName} y a las integraciones con las APIs de terceros descritas abajo.`,
          },
        ],
      },
      {
        id: "datos-que-recopilamos",
        title: "Qué información recopilamos",
        blocks: [
          { type: "p", text: "**Información que nos das directamente:**" },
          {
            type: "ul",
            items: [
              "**Solicitud de acceso:** correo electrónico y, si lo escribes, un mensaje opcional (máx. 500 caracteres).",
              "**Cuenta del panel:** nombre, correo electrónico, rol y contraseña. La contraseña se guarda solo como hash bcrypt; nunca en texto plano.",
              "**Contenido de trabajo:** canciones, imágenes, videos, textos y configuraciones que subes o creas para generar videos.",
            ],
          },
          {
            type: "p",
            text: "**Información que recibimos de las plataformas cuando conectas una cuenta (OAuth 2.0).** Pedimos solo los permisos necesarios para publicar:",
          },
          {
            type: "table",
            head: ["Plataforma", "Permisos solicitados", "Datos a los que accedemos", "Para qué"],
            rows: [
              [
                "YouTube (Google)",
                "`youtube.upload`, `youtube.force-ssl`",
                "ID, nombre y avatar del canal; lista de videos subidos por la app, su estado, visibilidad y estadísticas públicas (vistas, me gusta, comentarios); listas de reproducción.",
                "Subir los videos que eliges, asignarlos a una lista, mostrar su estado y métricas, y borrarlos si lo pides desde el panel.",
              ],
              [
                "TikTok",
                "`user.info.basic`, `video.upload`, `video.publish`",
                "open_id, nombre visible y avatar del perfil; estado de procesamiento de cada publicación.",
                "Identificar la cuenta de destino y publicar o enviar a borradores los videos que eliges.",
              ],
              [
                "Facebook (Meta)",
                "`pages_show_list`, `pages_manage_posts`, `pages_read_engagement`",
                "Lista de páginas que administras, ID, nombre y foto de la página elegida; token de página; publicaciones creadas por la app y sus métricas de interacción.",
                "Publicar videos en la página que eliges y mostrar su rendimiento.",
              ],
            ],
          },
          {
            type: "p",
            text:
              "**No** accedemos a tus mensajes privados, contactos, seguidores, contraseñas de las plataformas ni a contenido que no haya sido publicado por " +
              `${E.appName}.`,
          },
          { type: "p", text: "**Información técnica mínima:**" },
          {
            type: "ul",
            items: [
              "Registros del servidor (fecha, ruta solicitada, código de respuesta y errores) para seguridad y diagnóstico. Se conservan hasta 30 días.",
              "La dirección IP la procesa nuestro proveedor de red (Cloudflare) para proteger el sitio; no la usamos para perfilarte.",
            ],
          },
        ],
      },
      {
        id: "como-usamos",
        title: "Cómo usamos la información",
        blocks: [
          {
            type: "ul",
            items: [
              "Publicar en tus cuentas **solo** los videos que tú programas o confirmas, con el título, la descripción y la visibilidad que eliges.",
              "Mostrarte en el panel el estado de cada publicación, el historial y las métricas de tus propios videos.",
              "Renovar automáticamente los tokens para que la publicación programada no se interrumpa.",
              "Responder solicitudes de acceso, soporte y privacidad.",
              "Proteger el servicio contra abusos y cumplir obligaciones legales.",
            ],
          },
          {
            type: "p",
            text: "No usamos la información para publicidad, para crear perfiles de marketing, para tomar decisiones automatizadas sobre ti ni para evaluar tu solvencia. Ningún empleado o tercero lee tus datos, salvo que nos des permiso expreso para un caso de soporte, sea necesario por seguridad o lo exija la ley.",
          },
        ],
      },
      {
        id: "datos-de-google",
        title: "Datos de usuario de Google y YouTube",
        blocks: [
          {
            type: "p",
            text: `${E.appName} usa los **Servicios de la API de YouTube** (YouTube API Services). Al conectar un canal también aceptas la [Política de Privacidad de Google](${L.googlePrivacy}) y los [Términos del Servicio de YouTube](${L.youtubeTerms}).`,
          },
          {
            type: "note",
            text: `El uso y la transferencia a cualquier otra aplicación de la información recibida de las APIs de Google por parte de ${E.appName} cumplirá la [Política de datos de usuario de los servicios de las APIs de Google](${L.googleUserData}), incluidos los requisitos de Uso Limitado (Limited Use).`,
          },
          {
            type: "ul",
            items: [
              "Usamos los datos de Google **solo** para las funciones visibles para ti descritas en esta política: subir, organizar, consultar y borrar tus videos.",
              "**No** vendemos datos de Google, **no** los usamos para publicidad y **no** los transferimos a terceros, salvo que sea necesario para prestar esas funciones, por seguridad o por obligación legal.",
              "**No** usamos datos de usuario de Google para desarrollar, mejorar o entrenar modelos generales de inteligencia artificial o aprendizaje automático.",
              "Ninguna persona lee tus datos de Google, salvo que lo autorices expresamente, sea necesario por seguridad o lo exija la ley.",
              `Puedes revocar el acceso de ${E.appName} a tu cuenta de Google en cualquier momento desde [la página de permisos de seguridad de Google](${L.googleRevoke}), además de desconectar el canal desde el panel.`,
            ],
          },
        ],
      },
      {
        id: "compartir",
        title: "Con quién compartimos información",
        blocks: [
          {
            type: "p",
            text: "No vendemos ni alquilamos información personal. Solo la compartimos en estos casos:",
          },
          {
            type: "table",
            head: ["Destinatario", "Qué recibe", "Motivo"],
            rows: [
              [
                "YouTube, TikTok y Meta",
                "El video, su título, descripción y ajustes de visibilidad.",
                "Es la publicación que tú pides. Cada plataforma trata esos datos según su propia política.",
              ],
              [
                "Cloudflare",
                "Tráfico web cifrado (incluida la IP).",
                "Red, HTTPS y protección contra ataques.",
              ],
              [
                "Proveedores de IA (Google Gemini, DeepSeek)",
                "El tema o guion del video y borradores de título y descripción.",
                "Generar textos y voz para los videos. **Nunca** se les envían tokens, métricas ni otros datos obtenidos de YouTube, TikTok o Facebook.",
              ],
              [
                "Resend",
                "Correo electrónico del solicitante.",
                "Enviar los correos de solicitud y aprobación de acceso.",
              ],
              [
                "Autoridades",
                "Lo estrictamente requerido.",
                "Cuando lo exija una ley u orden válida.",
              ],
            ],
          },
          {
            type: "p",
            text: `El sitio público muestra el **nombre, la foto y el enlace públicos** de los canales conectados, junto con contadores de videos publicados, como muestra de la actividad del servicio. Si no quieres que tu canal aparezca, escríbenos a ${mail} y lo retiramos.`,
          },
        ],
      },
      {
        id: "almacenamiento-seguridad",
        title: "Almacenamiento y seguridad",
        blocks: [
          {
            type: "ul",
            items: [
              `Los datos se guardan en un servidor administrado directamente por el responsable, ubicado en ${E.country.es}. No se alojan en servicios de terceros de almacenamiento.`,
              "Los tokens de acceso y de actualización se cifran antes de guardarse (Fernet: AES-128-CBC + HMAC-SHA256). La clave de cifrado se guarda aparte, en la configuración del servidor, y nunca en el código.",
              "Todas las conexiones usan HTTPS. Los tokens nunca se escriben en los registros ni se envían al navegador.",
              "El panel exige inicio de sesión y el acceso se concede solo por invitación.",
            ],
          },
          {
            type: "p",
            text: "Ningún sistema es 100 % seguro. Si detectamos una brecha que afecte a tus datos, te avisaremos sin demora indebida y tomaremos medidas para contenerla.",
          },
        ],
      },
      {
        id: "conservacion",
        title: "Cuánto tiempo conservamos los datos",
        blocks: [
          {
            type: "table",
            head: ["Dato", "Plazo"],
            rows: [
              [
                "Tokens de acceso de YouTube, TikTok y Facebook",
                "Mientras la cuenta esté conectada. Se borran al desconectarla.",
              ],
              [
                "Datos obtenidos de las APIs (estado, listas y métricas de videos)",
                "Se actualizan o se borran en un plazo máximo de **30 días**.",
              ],
              ["Perfil del canal (nombre, avatar, ID)", "Mientras la cuenta esté conectada."],
              [
                "Cuenta del panel y contenido de trabajo",
                "Mientras la cuenta esté activa, o hasta que pidas el borrado.",
              ],
              ["Solicitudes de acceso no aprobadas", "Hasta 6 meses."],
              ["Registros técnicos del servidor", "Hasta 30 días."],
            ],
          },
          {
            type: "p",
            text: `Si pides el borrado, eliminamos tus datos en un plazo máximo de **7 días**. Si revocas el acceso desde Google, TikTok o Facebook, borramos los datos de esa cuenta en un máximo de **30 días**. Los pasos están en [Eliminación de datos](/data-deletion).`,
          },
        ],
      },
      {
        id: "dispositivo",
        title: "Cookies y almacenamiento en tu dispositivo",
        blocks: [
          {
            type: "ul",
            items: [
              "**Cookie de sesión** (solo si inicias sesión en el panel): es estrictamente necesaria para mantenerte conectado.",
              "**Cookie de idioma:** recuerda si prefieres español o inglés.",
              "**Almacenamiento local del navegador:** guarda borradores de formularios para que no pierdas tu trabajo. Nunca contiene tokens.",
            ],
          },
          {
            type: "p",
            text: "**No** usamos cookies de publicidad ni de analítica de terceros, y ningún tercero sirve anuncios ni contenido en el sitio.",
          },
        ],
      },
      {
        id: "tus-derechos",
        title: "Tus derechos y cómo ejercerlos",
        blocks: [
          {
            type: "p",
            text: "Puedes pedir en cualquier momento acceder a tus datos, corregirlos, exportarlos, borrarlos o limitar su uso, y también retirar el consentimiento que diste al conectar una cuenta.",
          },
          {
            type: "ul",
            items: [
              "**Desde el panel:** Canales → Desconectar. Esto borra los tokens guardados de esa cuenta.",
              `**Revocar el permiso en la plataforma:** [Google](${L.googleRevoke}) · [TikTok](${L.tiktokPermissions}) · [Facebook](${L.facebookBusinessTools}).`,
              `**Por correo:** ${mail}. Respondemos en un máximo de 72 horas y completamos la solicitud en un máximo de 7 días.`,
            ],
          },
        ],
      },
      {
        id: "menores",
        title: "Menores de edad",
        blocks: [
          {
            type: "p",
            text: `${E.appName} es una herramienta profesional para mayores de 18 años y no está dirigida a menores. No recopilamos a sabiendas datos de menores. Si crees que un menor nos ha dado datos, escríbenos y los borraremos.`,
          },
        ],
      },
      {
        id: "transferencias",
        title: "Transferencias internacionales",
        blocks: [
          {
            type: "p",
            text: `Los datos se guardan en ${E.country.es}. Al publicar un video o usar los proveedores mencionados, la información puede tratarse en otros países (por ejemplo, Estados Unidos), según las políticas de cada proveedor: [Google](${L.googlePrivacy}), [TikTok](${L.tiktokPrivacy}) y [Meta](${L.metaPrivacy}).`,
          },
        ],
      },
      {
        id: "cambios",
        title: "Cambios en esta política",
        blocks: [
          {
            type: "p",
            text: "Si cambiamos esta política, publicaremos la nueva versión en esta misma dirección con una nueva fecha de vigencia. Si el cambio es importante, avisaremos a los usuarios del panel por correo antes de que entre en vigor. Si un cambio requiere nuevos permisos, te pediremos de nuevo tu consentimiento.",
          },
        ],
      },
    ],
  },

  terms: {
    slug: "terms",
    title: "Condiciones del servicio",
    description: `Las reglas para usar ${E.appName}: quién puede usarlo, qué se espera de ti al publicar en YouTube, TikTok y Facebook, y los límites de nuestra responsabilidad.`,
    highlights: [
      "El acceso es **solo por invitación** y para mayores de 18 años.",
      "Tú eres el dueño de tu contenido y respondes por tener los derechos de la música, las imágenes y los textos que publicas.",
      "Al conectar cada plataforma, aceptas también sus propias condiciones: [YouTube](" +
        L.youtubeTerms +
        "), [TikTok](" +
        L.tiktokTerms +
        ") y [Meta](" +
        L.metaTerms +
        ").",
      "Nada se publica sin tu decisión: tú eliges el video, la cuenta de destino, el horario y la visibilidad.",
    ],
    sections: [
      {
        id: "aceptacion",
        title: "Aceptación",
        blocks: [
          {
            type: "p",
            text: `Estas condiciones regulan el uso de ${E.appName} (${E.website}), un servicio operado por **${E.operator}** (${E.country.es}). Al crear una cuenta, iniciar sesión o conectar una cuenta de una plataforma, aceptas estas condiciones y la [Política de privacidad](/privacy). Si no estás de acuerdo, no uses el servicio.`,
          },
        ],
      },
      {
        id: "servicio",
        title: "Qué es el servicio",
        blocks: [
          {
            type: "p",
            text: `${E.appName} ayuda a creadores y equipos de contenido a producir videos a partir de plantillas y recursos propios, y a publicarlos o programarlos en las cuentas que el propio usuario conecta: canales de YouTube, cuentas de TikTok y páginas de Facebook.`,
          },
          {
            type: "p",
            text: "El servicio se ofrece por invitación. Podemos añadir, cambiar o retirar funciones, y fijar límites de uso para respetar las cuotas de las APIs de cada plataforma.",
          },
        ],
      },
      {
        id: "cuentas",
        title: "Tu cuenta",
        blocks: [
          {
            type: "ul",
            items: [
              "Debes tener al menos 18 años y la autoridad necesaria para administrar las cuentas que conectas.",
              "Eres responsable de mantener tu contraseña en secreto y de todo lo que ocurra con tu cuenta. Avísanos de inmediato si sospechas un acceso no autorizado.",
              "Debes dar información veraz al solicitar acceso.",
            ],
          },
        ],
      },
      {
        id: "plataformas",
        title: "Plataformas de terceros",
        blocks: [
          {
            type: "p",
            text:
              "Al conectar una cuenta autorizas a " +
              `${E.appName} a actuar en tu nombre solo para las funciones descritas en la [Política de privacidad](/privacy). Debes cumplir en todo momento las condiciones de cada plataforma:`,
          },
          {
            type: "ul",
            items: [
              `**YouTube:** ${E.appName} usa los Servicios de la API de YouTube. Al usar ${E.appName} aceptas quedar obligado por los [Términos del Servicio de YouTube](${L.youtubeTerms}). Google trata tus datos según su [Política de Privacidad](${L.googlePrivacy}).`,
              `**TikTok:** debes cumplir los [Términos del Servicio](${L.tiktokTerms}) y las [Normas de la Comunidad](${L.tiktokGuidelines}) de TikTok. Al publicar en TikTok aceptas la [Confirmación de Uso de Música de TikTok](${L.tiktokMusic}) y, si corresponde, su [Política de Contenido de Marca](${L.tiktokBranded}).`,
              `**Facebook:** debes cumplir las [Condiciones del servicio de Meta](${L.metaTerms}) y las [Políticas de páginas, grupos y eventos](${L.metaPages}).`,
            ],
          },
          {
            type: "p",
            text: `${E.appName} no está afiliado, patrocinado ni respaldado por Google, YouTube, TikTok ni Meta. Las marcas pertenecen a sus dueños. Si una plataforma cambia, limita o retira su API, algunas funciones pueden dejar de estar disponibles.`,
          },
        ],
      },
      {
        id: "contenido",
        title: "Tu contenido y la publicación",
        blocks: [
          {
            type: "ul",
            items: [
              "Conservas todos los derechos sobre tu contenido. Nos das una licencia limitada, no exclusiva y revocable para guardarlo, procesarlo y publicarlo **solo** para prestarte el servicio.",
              "Garantizas que tienes los derechos o licencias necesarios (música, imágenes, voces, marcas) y que tu contenido no infringe derechos de terceros.",
              "Antes de cada publicación verás la cuenta de destino, el título, la descripción y la visibilidad, y podrás editarlos. Solo publicamos con tu confirmación o según la programación que tú configures.",
              "Las plataformas pueden tardar unos minutos en procesar un video y pueden rechazarlo o limitarlo según sus normas. El resultado final no depende de nosotros.",
            ],
          },
        ],
      },
      {
        id: "uso-prohibido",
        title: "Usos prohibidos",
        blocks: [
          {
            type: "p",
            text: "No puedes usar el servicio para:",
          },
          {
            type: "ul",
            items: [
              "Publicar contenido ilegal, engañoso, de odio, violento, sexual que involucre a menores, o que viole las normas de cualquiera de las plataformas.",
              "Hacer spam, inflar métricas de forma artificial, suplantar identidades o publicar en cuentas que no te pertenecen o que no estás autorizado a administrar.",
              "Infringir derechos de autor, de marca o de imagen.",
              "Saturar a propósito las APIs o eludir los límites, la seguridad o las restricciones técnicas del servicio o de las plataformas.",
              "Hacer ingeniería inversa, revender o dar acceso a terceros sin autorización.",
            ],
          },
        ],
      },
      {
        id: "suspension",
        title: "Suspensión y terminación",
        blocks: [
          {
            type: "p",
            text: "Puedes dejar de usar el servicio y pedir el borrado de tus datos cuando quieras (ver [Eliminación de datos](/data-deletion)). Podemos suspender o cerrar una cuenta que incumpla estas condiciones o las normas de una plataforma, o cuando sea necesario para proteger el servicio. Al cerrarse una cuenta, sus tokens se eliminan.",
          },
        ],
      },
      {
        id: "garantias",
        title: "Garantías y responsabilidad",
        blocks: [
          {
            type: "p",
            text: "El servicio se ofrece **«tal cual» y «según disponibilidad»**. No garantizamos que funcione sin interrupciones ni errores, ni ningún resultado de audiencia, alcance o ingresos.",
          },
          {
            type: "p",
            text: "En la medida permitida por la ley, no respondemos por daños indirectos, pérdida de beneficios o de datos, ni por las acciones de las plataformas de terceros (suspensiones, cambios de API, eliminación de contenido). Nuestra responsabilidad total se limita al importe que hayas pagado por el servicio en los 12 meses anteriores al reclamo; si el servicio fue gratuito, ese importe es cero.",
          },
          {
            type: "p",
            text: "Te comprometes a mantenernos indemnes frente a reclamos de terceros causados por tu contenido o por el incumplimiento de estas condiciones.",
          },
        ],
      },
      {
        id: "ley-aplicable",
        title: "Ley aplicable y cambios",
        blocks: [
          {
            type: "p",
            text: `Estas condiciones se rigen por las leyes del Estado Plurinacional de ${E.country.es}. Antes de acudir a la vía judicial, intentaremos resolver cualquier controversia de buena fe escribiéndonos a ${mail}.`,
          },
          {
            type: "p",
            text: "Podemos actualizar estas condiciones. Publicaremos la nueva versión en esta página con su fecha de vigencia y avisaremos de los cambios importantes. Si sigues usando el servicio después de la fecha de vigencia, se entiende que aceptas los cambios.",
          },
        ],
      },
    ],
  },

  "data-deletion": {
    slug: "data-deletion",
    title: "Eliminación de datos",
    description: `Cómo desconectar tus cuentas de YouTube, TikTok o Facebook y pedir que ${E.appName} borre de forma permanente toda la información asociada a ellas.`,
    highlights: [
      "Puedes borrar tus datos en cualquier momento, sin dar explicaciones y sin coste.",
      "Al desconectar una cuenta desde el panel, sus tokens se eliminan **de inmediato**.",
      `Por correo (${mail}): confirmamos en un máximo de 72 horas y completamos el borrado en un máximo de **7 días**.`,
      "Te enviamos un código de confirmación para que puedas consultar el estado de tu solicitud.",
    ],
    sections: [
      {
        id: "que-se-elimina",
        title: "Qué se elimina",
        blocks: [
          {
            type: "ul",
            items: [
              "Tokens de acceso y de actualización de la cuenta conectada.",
              "Perfil guardado de la cuenta: ID, nombre, avatar y enlace.",
              "Historial de publicaciones y métricas obtenidas de la plataforma.",
              "Tu presencia en la muestra pública de canales del sitio.",
              "Si lo pides, también tu cuenta del panel, tus solicitudes de acceso y el contenido de trabajo que subiste.",
            ],
          },
          {
            type: "note",
            text: "Los videos que ya se publicaron en YouTube, TikTok o Facebook pertenecen a tu cuenta en esa plataforma. Borrar tus datos en Nexa Brief no los elimina de allí. Puedes borrarlos desde la propia plataforma o, antes de desconectar, desde el panel.",
          },
        ],
      },
      {
        id: "desde-el-panel",
        title: "Opción 1 — Desde el panel de Nexa Brief",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "Inicia sesión", text: `Entra en ${E.website} con tu cuenta.` },
              {
                title: "Ve a Canales",
                text: "Localiza la cuenta de YouTube, TikTok o Facebook que quieres quitar.",
              },
              {
                title: "Pulsa «Desconectar»",
                text: "Los tokens de esa cuenta se eliminan de inmediato y la app deja de poder publicar en ella.",
              },
              {
                title: "Revoca también en la plataforma",
                text: "Para retirar el permiso por completo, sigue la opción 2 para esa misma cuenta.",
              },
            ],
          },
        ],
      },
      {
        id: "desde-la-plataforma",
        title: "Opción 2 — Revocar el acceso desde cada plataforma",
        blocks: [
          {
            type: "p",
            text: "Al quitar la app desde la plataforma, Nexa Brief pierde el acceso al instante y borra los datos de esa cuenta en un máximo de 30 días.",
          },
          {
            type: "table",
            head: ["Plataforma", "Pasos"],
            rows: [
              [
                "Facebook",
                `Facebook → **Configuración y privacidad** → **Configuración** → **Integraciones comerciales** ([abrir](${L.facebookBusinessTools})) → selecciona **${E.appName}** → **Eliminar**. Marca también la opción de borrar las publicaciones si lo deseas.`,
              ],
              [
                "TikTok",
                `App de TikTok → **Perfil** → **Menú ☰** → **Ajustes y privacidad** → **Seguridad y permisos** → **Permisos de apps** → **${E.appName}** → **Eliminar acceso**. En la web: [Administrar permisos de apps](${L.tiktokPermissions}).`,
              ],
              [
                "YouTube / Google",
                `Abre los [permisos de tu cuenta de Google](${L.googleRevoke}) → **${E.appName}** → **Eliminar todo el acceso**.`,
              ],
            ],
          },
        ],
      },
      {
        id: "por-correo",
        title: "Opción 3 — Solicitud por correo",
        blocks: [
          {
            type: "p",
            text: `Escribe a ${mail} con el asunto **«Eliminación de datos»** e indica:`,
          },
          {
            type: "ul",
            items: [
              "La plataforma (YouTube, TikTok o Facebook) y el nombre del canal, perfil o página.",
              "Si quieres borrar solo esa conexión o todos tus datos, incluida la cuenta del panel.",
              "El correo de tu cuenta del panel, si tienes una.",
            ],
          },
          {
            type: "p",
            text: "Para proteger tu información, podemos pedirte que confirmes la titularidad desde el mismo correo o cuenta. No te pediremos nunca tu contraseña.",
          },
        ],
      },
      {
        id: "plazos-y-confirmacion",
        title: "Plazos y confirmación",
        blocks: [
          {
            type: "table",
            head: ["Paso", "Plazo"],
            rows: [
              ["Acuse de recibo con código de confirmación", "Máximo 72 horas"],
              ["Borrado completo de los datos", "Máximo 7 días desde la solicitud"],
              ["Borrado tras revocar desde la plataforma", "Máximo 30 días"],
              [
                "Copias de seguridad, si existieran",
                "Se purgan en el siguiente ciclo, en un máximo de 30 días",
              ],
            ],
          },
          {
            type: "p",
            text: `Con tu código de confirmación puedes consultar en cualquier momento el estado de tu solicitud escribiendo a ${mail}. Te diremos si está **recibida**, **en proceso** o **completada**.`,
          },
          {
            type: "p",
            text: "Solo conservaremos un dato si la ley nos obliga a hacerlo. En ese caso te explicaremos por escrito qué dato se conserva, por qué y hasta cuándo.",
          },
        ],
      },
    ],
  },
};
