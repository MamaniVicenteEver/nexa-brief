import { LEGAL_ENTITY as E } from "../config";
import type { LegalContent } from "../types";
import { LINKS as L } from "./links";

const mail = `[${E.contactEmail}](mailto:${E.contactEmail})`;

export const en: LegalContent = {
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    description: `How ${E.appName} accesses, uses, stores, shares and deletes information from the YouTube, TikTok and Facebook accounts you connect to publish your videos.`,
    highlights: [
      "We use your account data **only to publish the videos you choose** and to show you their status and metrics. Nothing else.",
      "**We do not sell data, we do not show ads,** and we do not use your data to train artificial intelligence models.",
      "Access tokens are stored **encrypted** (AES-128 + HMAC-SHA256, Fernet) on a self-managed server.",
      `You can disconnect an account at any time and request full deletion by writing to ${mail}.`,
    ],
    sections: [
      {
        id: "responsable",
        title: "Who we are",
        blocks: [
          {
            type: "p",
            text: `${E.appName} (${E.website}) is an invitation-only web service for creators and content teams. It produces videos automatically and publishes them to the YouTube channels, TikTok accounts and Facebook Pages that the user connects and authorizes.`,
          },
          {
            type: "p",
            text: `The data controller is **${E.operator}**, an independent developer based in ${E.country.en}. Contact for any privacy matter: ${mail}.`,
          },
          {
            type: "p",
            text: `This policy applies to the ${E.website} website, the ${E.appName} dashboard and the third-party API integrations described below.`,
          },
        ],
      },
      {
        id: "datos-que-recopilamos",
        title: "Information we collect",
        blocks: [
          { type: "p", text: "**Information you give us directly:**" },
          {
            type: "ul",
            items: [
              "**Access request:** your email address and, if you write one, an optional message (up to 500 characters).",
              "**Dashboard account:** name, email address, role and password. The password is stored only as a bcrypt hash, never in plain text.",
              "**Work content:** songs, images, videos, text and settings you upload or create to produce videos.",
            ],
          },
          {
            type: "p",
            text: "**Information we receive from the platforms when you connect an account (OAuth 2.0).** We request only the permissions needed to publish:",
          },
          {
            type: "table",
            head: ["Platform", "Scopes requested", "Data we access", "Purpose"],
            rows: [
              [
                "YouTube (Google)",
                "`youtube.upload`, `youtube.force-ssl`",
                "Channel ID, title and avatar; the videos uploaded by the app, with their status, visibility and public statistics (views, likes, comments); playlists.",
                "Upload the videos you choose, add them to a playlist, show their status and metrics, and delete them when you ask from the dashboard.",
              ],
              [
                "TikTok",
                "`user.info.basic`, `video.upload`, `video.publish`",
                "Profile open_id, display name and avatar; the processing status of each post.",
                "Identify the destination account and publish, or send to drafts, the videos you choose.",
              ],
              [
                "Facebook (Meta)",
                "`pages_show_list`, `pages_manage_posts`, `pages_read_engagement`",
                "The list of Pages you manage; the chosen Page's ID, name and picture; a Page token; posts created by the app and their engagement metrics.",
                "Publish videos to the Page you choose and show how they perform.",
              ],
            ],
          },
          {
            type: "p",
            text: `We do **not** access your private messages, contacts, followers, platform passwords, or any content that was not published by ${E.appName}.`,
          },
          { type: "p", text: "**Minimal technical information:**" },
          {
            type: "ul",
            items: [
              "Server logs (date, requested path, response code and errors) for security and troubleshooting. We keep them for up to 30 days.",
              "Your IP address is processed by our network provider (Cloudflare) to protect the site. We do not use it to profile you.",
            ],
          },
        ],
      },
      {
        id: "como-usamos",
        title: "How we use information",
        blocks: [
          {
            type: "ul",
            items: [
              "To publish to your accounts **only** the videos you schedule or confirm, with the title, description and visibility you choose.",
              "To show you, in the dashboard, the status of each post and the history and metrics of your own videos.",
              "To refresh tokens automatically so that scheduled publishing is not interrupted.",
              "To answer access, support and privacy requests.",
              "To protect the service against abuse and to comply with legal obligations.",
            ],
          },
          {
            type: "p",
            text: "We do not use information for advertising, marketing profiles, automated decisions about you, or credit assessment. No employee or third party reads your data unless you give us explicit permission for a support case, it is needed for security, or the law requires it.",
          },
        ],
      },
      {
        id: "datos-de-google",
        title: "Google and YouTube user data",
        blocks: [
          {
            type: "p",
            text: `${E.appName} uses the **YouTube API Services**. When you connect a channel, you also agree to the [Google Privacy Policy](${L.googlePrivacy}) and the [YouTube Terms of Service](${L.youtubeTerms}).`,
          },
          {
            type: "note",
            text: `${E.appName}'s use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](${L.googleUserData}), including the Limited Use requirements.`,
          },
          {
            type: "ul",
            items: [
              "We use Google data **only** for the user-facing features described in this policy: uploading, organizing, reviewing and deleting your videos.",
              "We do **not** sell Google data, do **not** use it for advertising, and do **not** transfer it to third parties, except when needed to provide those features, for security, or to comply with the law.",
              "We do **not** use Google user data to develop, improve or train generalized artificial intelligence or machine learning models.",
              "No person reads your Google data unless you explicitly authorize it, it is needed for security, or the law requires it.",
              `You can revoke ${E.appName}'s access to your Google account at any time from [Google's security permissions page](${L.googleRevoke}), in addition to disconnecting the channel from the dashboard.`,
            ],
          },
        ],
      },
      {
        id: "compartir",
        title: "Who we share information with",
        blocks: [
          {
            type: "p",
            text: "We do not sell or rent personal information. We share it only in these cases:",
          },
          {
            type: "table",
            head: ["Recipient", "What they receive", "Why"],
            rows: [
              [
                "YouTube, TikTok and Meta",
                "The video, its title, description and visibility settings.",
                "This is the post you asked for. Each platform handles that data under its own policy.",
              ],
              [
                "Cloudflare",
                "Encrypted web traffic (including your IP address).",
                "Networking, HTTPS and attack protection.",
              ],
              [
                "AI providers (Google Gemini, DeepSeek)",
                "The video's topic or script, and draft titles and descriptions.",
                "To generate text and voice-over for the videos. We **never** send them tokens, metrics or any other data obtained from YouTube, TikTok or Facebook.",
              ],
              [
                "Resend",
                "The requester's email address.",
                "To send access request and approval emails.",
              ],
              [
                "Authorities",
                "Only what is strictly required.",
                "When a valid law or order requires it.",
              ],
            ],
          },
          {
            type: "p",
            text: `The public website shows the **public name, picture and link** of connected channels, together with counts of published videos, as a showcase of the service's activity. If you do not want your channel to appear, write to ${mail} and we will remove it.`,
          },
        ],
      },
      {
        id: "almacenamiento-seguridad",
        title: "Storage and security",
        blocks: [
          {
            type: "ul",
            items: [
              `Data is stored on a server managed directly by the data controller, located in ${E.country.en}. It is not hosted with third-party storage services.`,
              "Access and refresh tokens are encrypted before they are stored (Fernet: AES-128-CBC + HMAC-SHA256). The encryption key is kept separately, in the server configuration, and never in the source code.",
              "All connections use HTTPS. Tokens are never written to logs or sent to the browser.",
              "The dashboard requires sign-in, and access is granted by invitation only.",
            ],
          },
          {
            type: "p",
            text: "No system is 100% secure. If we detect a breach that affects your data, we will notify you without undue delay and take steps to contain it.",
          },
        ],
      },
      {
        id: "conservacion",
        title: "How long we keep data",
        blocks: [
          {
            type: "table",
            head: ["Data", "Retention"],
            rows: [
              [
                "YouTube, TikTok and Facebook access tokens",
                "While the account is connected. Deleted when you disconnect it.",
              ],
              [
                "Data obtained from the APIs (video status, lists and metrics)",
                "Refreshed or deleted within **30 days** at most.",
              ],
              ["Channel profile (name, avatar, ID)", "While the account is connected."],
              [
                "Dashboard account and work content",
                "While the account is active, or until you request deletion.",
              ],
              ["Access requests that were not approved", "Up to 6 months."],
              ["Server technical logs", "Up to 30 days."],
            ],
          },
          {
            type: "p",
            text: "If you request deletion, we delete your data within **7 days** at most. If you revoke access from Google, TikTok or Facebook, we delete that account's data within **30 days** at most. The steps are on the [Data Deletion](/data-deletion) page.",
          },
        ],
      },
      {
        id: "dispositivo",
        title: "Cookies and storage on your device",
        blocks: [
          {
            type: "ul",
            items: [
              "**Session cookie** (only when you sign in to the dashboard): strictly necessary to keep you signed in.",
              "**Language cookie:** remembers whether you prefer Spanish or English.",
              "**Browser local storage:** keeps form drafts so you do not lose your work. It never contains tokens.",
            ],
          },
          {
            type: "p",
            text: "We do **not** use advertising or third-party analytics cookies, and no third party serves ads or content on the site.",
          },
        ],
      },
      {
        id: "tus-derechos",
        title: "Your rights and how to exercise them",
        blocks: [
          {
            type: "p",
            text: "At any time you can ask to access, correct, export or delete your data, or to restrict how it is used. You can also withdraw the consent you gave when you connected an account.",
          },
          {
            type: "ul",
            items: [
              "**From the dashboard:** Channels → Disconnect. This deletes the stored tokens for that account.",
              `**Revoke the permission on the platform:** [Google](${L.googleRevoke}) · [TikTok](${L.tiktokPermissions}) · [Facebook](${L.facebookBusinessTools}).`,
              `**By email:** ${mail}. We reply within 72 hours at most and complete the request within 7 days at most.`,
            ],
          },
        ],
      },
      {
        id: "menores",
        title: "Children",
        blocks: [
          {
            type: "p",
            text: `${E.appName} is a professional tool for people aged 18 or over and is not directed at children. We do not knowingly collect data from minors. If you believe a minor has given us data, contact us and we will delete it.`,
          },
        ],
      },
      {
        id: "transferencias",
        title: "International transfers",
        blocks: [
          {
            type: "p",
            text: `Data is stored in ${E.country.en}. When you publish a video or use the providers listed above, information may be processed in other countries (for example, the United States) under each provider's policy: [Google](${L.googlePrivacy}), [TikTok](${L.tiktokPrivacy}) and [Meta](${L.metaPrivacy}).`,
          },
        ],
      },
      {
        id: "cambios",
        title: "Changes to this policy",
        blocks: [
          {
            type: "p",
            text: "If we change this policy, we will publish the new version at this same address with a new effective date. If the change is significant, we will email dashboard users before it takes effect. If a change requires new permissions, we will ask for your consent again.",
          },
        ],
      },
    ],
  },

  terms: {
    slug: "terms",
    title: "Terms of Service",
    description: `The rules for using ${E.appName}: who can use it, what we expect from you when you publish to YouTube, TikTok and Facebook, and the limits of our liability.`,
    highlights: [
      "Access is **by invitation only** and for people aged 18 or over.",
      "You own your content and are responsible for holding the rights to the music, images and text you publish.",
      `By connecting each platform, you also accept its own terms: [YouTube](${L.youtubeTerms}), [TikTok](${L.tiktokTerms}) and [Meta](${L.metaTerms}).`,
      "Nothing is published without your decision: you choose the video, the destination account, the schedule and the visibility.",
    ],
    sections: [
      {
        id: "aceptacion",
        title: "Acceptance",
        blocks: [
          {
            type: "p",
            text: `These terms govern the use of ${E.appName} (${E.website}), a service operated by **${E.operator}** (${E.country.en}). By creating an account, signing in or connecting a platform account, you accept these terms and the [Privacy Policy](/privacy). If you do not agree, do not use the service.`,
          },
        ],
      },
      {
        id: "servicio",
        title: "What the service is",
        blocks: [
          {
            type: "p",
            text: `${E.appName} helps creators and content teams produce videos from templates and their own assets, and publish or schedule them to the accounts the user connects: YouTube channels, TikTok accounts and Facebook Pages.`,
          },
          {
            type: "p",
            text: "The service is offered by invitation. We may add, change or remove features, and we may set usage limits to respect each platform's API quotas.",
          },
        ],
      },
      {
        id: "cuentas",
        title: "Your account",
        blocks: [
          {
            type: "ul",
            items: [
              "You must be at least 18 years old and have the authority to manage the accounts you connect.",
              "You are responsible for keeping your password secret and for all activity on your account. Tell us immediately if you suspect unauthorized access.",
              "You must give accurate information when you request access.",
            ],
          },
        ],
      },
      {
        id: "plataformas",
        title: "Third-party platforms",
        blocks: [
          {
            type: "p",
            text: `By connecting an account, you authorize ${E.appName} to act on your behalf only for the features described in the [Privacy Policy](/privacy). You must comply with each platform's terms at all times:`,
          },
          {
            type: "ul",
            items: [
              `**YouTube:** ${E.appName} uses the YouTube API Services. By using ${E.appName}, you agree to be bound by the [YouTube Terms of Service](${L.youtubeTerms}). Google handles your data under the [Google Privacy Policy](${L.googlePrivacy}).`,
              `**TikTok:** you must comply with TikTok's [Terms of Service](${L.tiktokTerms}) and [Community Guidelines](${L.tiktokGuidelines}). By posting to TikTok, you agree to TikTok's [Music Usage Confirmation](${L.tiktokMusic}) and, where applicable, its [Branded Content Policy](${L.tiktokBranded}).`,
              `**Facebook:** you must comply with [Meta's Terms of Service](${L.metaTerms}) and the [Pages, Groups and Events Policies](${L.metaPages}).`,
            ],
          },
          {
            type: "p",
            text: `${E.appName} is not affiliated with, sponsored by or endorsed by Google, YouTube, TikTok or Meta. All trademarks belong to their owners. If a platform changes, limits or withdraws its API, some features may stop being available.`,
          },
        ],
      },
      {
        id: "contenido",
        title: "Your content and publishing",
        blocks: [
          {
            type: "ul",
            items: [
              "You keep all rights to your content. You give us a limited, non-exclusive, revocable license to store, process and publish it **only** to provide the service to you.",
              "You confirm that you hold the necessary rights or licenses (music, images, voices, trademarks) and that your content does not infringe anyone else's rights.",
              "Before each post you will see the destination account, title, description and visibility, and you can edit them. We publish only with your confirmation or according to the schedule you set up.",
              "Platforms may take a few minutes to process a video, and they may reject or restrict it under their own rules. The final outcome is not under our control.",
            ],
          },
        ],
      },
      {
        id: "uso-prohibido",
        title: "Prohibited uses",
        blocks: [
          { type: "p", text: "You may not use the service to:" },
          {
            type: "ul",
            items: [
              "Publish content that is illegal, misleading, hateful, violent, sexual content involving minors, or that breaks any platform's rules.",
              "Spam, artificially inflate metrics, impersonate others, or post to accounts you do not own or are not authorized to manage.",
              "Infringe copyright, trademark or image rights.",
              "Deliberately overload the APIs, or get around the limits, security or technical restrictions of the service or the platforms.",
              "Reverse-engineer, resell or give others access without authorization.",
            ],
          },
        ],
      },
      {
        id: "suspension",
        title: "Suspension and termination",
        blocks: [
          {
            type: "p",
            text: "You can stop using the service and request deletion of your data at any time (see [Data Deletion](/data-deletion)). We may suspend or close an account that breaks these terms or a platform's rules, or when needed to protect the service. When an account is closed, its tokens are deleted.",
          },
        ],
      },
      {
        id: "garantias",
        title: "Warranties and liability",
        blocks: [
          {
            type: "p",
            text: 'The service is provided **"as is" and "as available"**. We do not guarantee that it will run without interruptions or errors, or any audience, reach or revenue outcome.',
          },
          {
            type: "p",
            text: "To the extent permitted by law, we are not liable for indirect damages, lost profits or lost data, or for actions taken by third-party platforms (suspensions, API changes, content removal). Our total liability is limited to the amount you paid for the service in the 12 months before the claim; if the service was free, that amount is zero.",
          },
          {
            type: "p",
            text: "You agree to hold us harmless from third-party claims caused by your content or by your breach of these terms.",
          },
        ],
      },
      {
        id: "ley-aplicable",
        title: "Governing law and changes",
        blocks: [
          {
            type: "p",
            text: `These terms are governed by the laws of the Plurinational State of ${E.country.en}. Before going to court, we will try to resolve any dispute in good faith; write to us at ${mail}.`,
          },
          {
            type: "p",
            text: "We may update these terms. We will publish the new version on this page with its effective date and announce significant changes. If you keep using the service after the effective date, you are deemed to accept the changes.",
          },
        ],
      },
    ],
  },

  "data-deletion": {
    slug: "data-deletion",
    title: "Data Deletion",
    description: `How to disconnect your YouTube, TikTok or Facebook accounts and ask ${E.appName} to permanently delete all the information linked to them.`,
    highlights: [
      "You can delete your data at any time, without giving a reason and at no cost.",
      "When you disconnect an account from the dashboard, its tokens are deleted **immediately**.",
      `By email (${mail}): we confirm within 72 hours at most and complete the deletion within **7 days** at most.`,
      "We send you a confirmation code so you can check the status of your request.",
    ],
    sections: [
      {
        id: "que-se-elimina",
        title: "What gets deleted",
        blocks: [
          {
            type: "ul",
            items: [
              "The connected account's access and refresh tokens.",
              "The stored account profile: ID, name, avatar and link.",
              "Post history and metrics obtained from the platform.",
              "Your entry in the site's public channel showcase.",
              "If you ask, also your dashboard account, your access requests and the work content you uploaded.",
            ],
          },
          {
            type: "note",
            text: "Videos already published on YouTube, TikTok or Facebook belong to your account on that platform. Deleting your data in Nexa Brief does not remove them there. You can delete them on the platform itself or, before disconnecting, from the dashboard.",
          },
        ],
      },
      {
        id: "desde-el-panel",
        title: "Option 1 — From the Nexa Brief dashboard",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "Sign in", text: `Go to ${E.website} and sign in with your account.` },
              {
                title: "Open Channels",
                text: "Find the YouTube, TikTok or Facebook account you want to remove.",
              },
              {
                title: 'Click "Disconnect"',
                text: "That account's tokens are deleted immediately, and the app can no longer publish to it.",
              },
              {
                title: "Also revoke on the platform",
                text: "To withdraw the permission completely, follow Option 2 for the same account.",
              },
            ],
          },
        ],
      },
      {
        id: "desde-la-plataforma",
        title: "Option 2 — Revoke access from each platform",
        blocks: [
          {
            type: "p",
            text: "When you remove the app from the platform, Nexa Brief loses access instantly and deletes that account's data within 30 days at most.",
          },
          {
            type: "table",
            head: ["Platform", "Steps"],
            rows: [
              [
                "Facebook",
                `Facebook → **Settings & privacy** → **Settings** → **Business integrations** ([open](${L.facebookBusinessTools})) → select **${E.appName}** → **Remove**. You can also tick the option to delete the posts.`,
              ],
              [
                "TikTok",
                `TikTok app → **Profile** → **Menu ☰** → **Settings and privacy** → **Security & permissions** → **App permissions** → **${E.appName}** → **Remove access**. On the web: [Manage app permissions](${L.tiktokPermissions}).`,
              ],
              [
                "YouTube / Google",
                `Open your [Google Account permissions](${L.googleRevoke}) → **${E.appName}** → **Delete all access**.`,
              ],
            ],
          },
        ],
      },
      {
        id: "por-correo",
        title: "Option 3 — Request by email",
        blocks: [
          {
            type: "p",
            text: `Write to ${mail} with the subject **"Data deletion"** and include:`,
          },
          {
            type: "ul",
            items: [
              "The platform (YouTube, TikTok or Facebook) and the name of the channel, profile or Page.",
              "Whether you want to delete only that connection or all your data, including your dashboard account.",
              "Your dashboard account's email address, if you have one.",
            ],
          },
          {
            type: "p",
            text: "To protect your information, we may ask you to confirm ownership from the same email address or account. We will never ask for your password.",
          },
        ],
      },
      {
        id: "plazos-y-confirmacion",
        title: "Timelines and confirmation",
        blocks: [
          {
            type: "table",
            head: ["Step", "Timeline"],
            rows: [
              ["Acknowledgement with a confirmation code", "Within 72 hours"],
              ["Full deletion of the data", "Within 7 days of the request"],
              ["Deletion after revoking from the platform", "Within 30 days"],
              ["Backups, if any", "Purged in the next cycle, within 30 days"],
            ],
          },
          {
            type: "p",
            text: `With your confirmation code, you can check the status of your request at any time by writing to ${mail}. We will tell you whether it is **received**, **in progress** or **completed**.`,
          },
          {
            type: "p",
            text: "We keep data only when the law requires it. In that case we will explain to you in writing which data we keep, why, and until when.",
          },
        ],
      },
    ],
  },
};
