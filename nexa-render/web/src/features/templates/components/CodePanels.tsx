"use client";

import { css as cssLang } from "@codemirror/lang-css";
import { html as htmlLang } from "@codemirror/lang-html";
import { javascript as jsLang } from "@codemirror/lang-javascript";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import "./CodePanels.css";

interface CodePanelsProps {
  html: string;
  css: string;
  js: string;
  onHtmlChange: (value: string) => void;
  onCssChange: (value: string) => void;
  onJsChange: (value: string) => void;
  toolbarContent?: ReactNode;
  stacked?: boolean;
}

const PANELS = [
  { key: "html" as const, label: "HTML", lang: htmlLang() },
  { key: "css" as const, label: "CSS", lang: cssLang() },
  { key: "js" as const, label: "JS", lang: jsLang() },
];

/**
 * 3 editores simultáneos lado a lado (estilo CodePen), no pestañas.
 * `minmax(0, 1fr)` en vez de `1fr` a propósito (ver .nr-code-panels en
 * ./CodePanels.css): sin ese piso mínimo, una línea larga de CSS/JS
 * empuja el ancho intrínseco del editor y toda la página termina con
 * scroll horizontal.
 */
export function CodePanels({
  html,
  css,
  js,
  onHtmlChange,
  onCssChange,
  onJsChange,
  toolbarContent,
  stacked = false,
}: CodePanelsProps) {
  const t = useTranslations("templateDetail");
  const { resolvedTheme } = useTheme();
  // `resolvedTheme` es undefined en el server y en el primer render del
  // cliente (next-themes recién lo resuelve después de montar) — sin este
  // guard, CodeMirror arranca en "light" en el server y en "dark" en el
  // cliente si el usuario ya tenía el tema oscuro guardado, y React tira
  // un hydration mismatch. Se fuerza "light" hasta montar, después sigue
  // al tema real.
  const [mounted, setMounted] = useState(false);
  const [singleFileMode, setSingleFileMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [singleFileSource, setSingleFileSource] = useState(() => {
    if (!css && !js) return html;
    return `<!DOCTYPE html>\n<html>\n<head>\n<style>\n${css}\n</style>\n</head>\n<body>\n${html}\n<script>\n${js}\n</script>\n</body>\n</html>`;
  });
  useEffect(() => setMounted(true), []);
  const codeMirrorTheme = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const values = { html, css, js };
  const setters = { html: onHtmlChange, css: onCssChange, js: onJsChange };

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const source = String(reader.result ?? "");
      const parts = splitSingleFile(source);
      onHtmlChange(parts.html);
      onCssChange(parts.css);
      onJsChange(parts.js);
      setSingleFileSource(source);
      setSingleFileMode(true);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function copyAllCode() {
    const source = `<!DOCTYPE html>\n<html>\n<head>\n<style>\n${css}\n</style>\n</head>\n<body>\n${html}\n<script>\n${js}\n</script>\n</body>\n</html>`;
    await navigator.clipboard.writeText(source);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="nr-code-panels">
      <div className="nr-code-panels__toolbar">
        {toolbarContent}
        <button type="button" className="nr-code-panels__copy" onClick={() => void copyAllCode()}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar código"}
        </button>
        <button
          type="button"
          className={cn("nr-code-panels__mode-toggle", singleFileMode && "is-active")}
          onClick={() => {
            if (!singleFileMode) {
              setSingleFileSource(
                `<!DOCTYPE html>\n<html>\n<head>\n<style>\n${css}\n</style>\n</head>\n<body>\n${html}\n<script>\n${js}\n</script>\n</body>\n</html>`,
              );
            }
            setSingleFileMode((mode) => !mode);
          }}
        >
          {singleFileMode ? t("splitCode") : t("singleFile")}
        </button>
        <label className="nr-code-panels__upload">
          Subir archivo único (HTML/CSS/JS)
          <input
            className="nr-code-panels__upload-input"
            type="file"
            accept=".html,text/html"
            onChange={handleFileUpload}
          />
        </label>
      </div>

      <div className={cn("nr-code-panels__grid", stacked && "nr-code-panels__grid--stacked", singleFileMode && "nr-code-panels__grid--single")}>
        {(singleFileMode ? [{ key: "single", label: t("singleFileLabel"), lang: htmlLang() }] : PANELS).map((panel) => (
          <div key={panel.key} className="nr-code-panels__col">
            <div className={cn("nr-code-panels__head", panel.key === "single" ? "nr-code-panels__head--html" : `nr-code-panels__head--${panel.key}`)}>
              <span className={cn("nr-code-panels__dot", panel.key === "single" ? "nr-code-panels__dot--html" : `nr-code-panels__dot--${panel.key}`)} />
              <span className="nr-code-panels__label">{panel.label}</span>
            </div>
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <CodeMirror
                value={singleFileMode ? singleFileSource : values[panel.key as keyof typeof values]}
                height={stacked ? (singleFileMode ? "200px" : "100px") : "300px"}
                extensions={[panel.lang, EditorView.lineWrapping]}
                onChange={(value) => {
                  if (singleFileMode) {
                    setSingleFileSource(value);
                    const parts = splitSingleFile(value);
                    onHtmlChange(parts.html);
                    onCssChange(parts.css);
                    onJsChange(parts.js);
                  } else {
                    setters[panel.key as keyof typeof setters](value);
                  }
                }}
                theme={codeMirrorTheme}
                basicSetup={{ foldGutter: false, lineNumbers: true }}
                style={{ fontSize: 13 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Convierte un index.html autocontenido en los tres campos internos sin
 * perder scripts externos (por ejemplo GSAP desde CDN). */
function splitSingleFile(source: string): { html: string; css: string; js: string } {
  const css: string[] = [];
  const js: string[] = [];
  const htmlWithoutStyles = source.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, content: string) => {
    css.push(content.trim());
    return "";
  });
  const html = htmlWithoutStyles.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (match, attributes: string, content: string) => {
    if (/\bsrc\s*=/i.test(attributes)) return match;
    js.push(content.trim());
    return "";
  });
  return { html, css: css.filter(Boolean).join("\n\n"), js: js.filter(Boolean).join("\n\n") };
}
