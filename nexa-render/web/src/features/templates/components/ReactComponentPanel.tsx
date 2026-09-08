"use client";

import { javascript } from "@codemirror/lang-javascript";
import { json as jsonLang } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import "./ReactComponentPanel.css";
import "./CodePanels.css";

interface ReactComponentPanelProps {
  componentSource: string;
  propsJson: string;
  onComponentSourceChange: (value: string) => void;
  onPropsJsonChange: (value: string) => void;
  toolbarContent?: ReactNode;
}

const jsxExtension = javascript({ jsx: true });

/**
 * Editor de Remotion — un componente React (JSX) + sus props (JSON), en vez
 * de HTML/CSS/JS (eso es CodePanels, para Playwright/HyperFrames). Mismo
 * patrón visual que CodePanels (columnas con head+dot+label) pero con 2
 * columnas en vez de 3 — no hay "CSS" ni "JS" sueltos, todo vive en el JSX.
 */
export function ReactComponentPanel({
  componentSource,
  propsJson,
  onComponentSourceChange,
  onPropsJsonChange,
  toolbarContent,
}: ReactComponentPanelProps) {
  const t = useTranslations("templateDetail");
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const codeMirrorTheme = mounted && resolvedTheme === "dark" ? "dark" : "light";

  function handleComponentUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onComponentSourceChange(String(reader.result ?? ""));
    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <div className="nr-react-component-panel">
      <div className="nr-code-panels__toolbar">
        {toolbarContent}
        <label className="nr-code-panels__upload">
          {t("uploadComponent")}
          <input
            className="nr-code-panels__upload-input"
            type="file"
            accept=".jsx,.tsx,.js,.ts,text/javascript"
            onChange={handleComponentUpload}
          />
        </label>
      </div>
      <div className="nr-react-component-panel__col">
        <div className="nr-react-component-panel__head">
          <span className="nr-react-component-panel__dot" />
          <span className="nr-react-component-panel__label">Component.jsx</span>
        </div>
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <CodeMirror
            value={componentSource}
            height="300px"
            extensions={[jsxExtension, EditorView.lineWrapping]}
            onChange={onComponentSourceChange}
            theme={codeMirrorTheme}
            basicSetup={{ foldGutter: false, lineNumbers: true }}
            style={{ fontSize: 13 }}
          />
        </div>
        <p className="nr-react-component-panel__note">
          Exportá un componente por default — `export default function Component(props) {"{"}...{"}"}`. El
          El preview de Remotion se actualiza debajo al pausar la escritura. Usá &quot;Grabar&quot; para renderizar el MP4 final.
        </p>
      </div>

      <div className="nr-react-component-panel__col">
        <div className="nr-react-component-panel__head">
          <span className="nr-react-component-panel__dot" />
          <span className="nr-react-component-panel__label">props.json</span>
        </div>
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <CodeMirror
            value={propsJson}
            height="300px"
            extensions={[jsonLang(), EditorView.lineWrapping]}
            onChange={onPropsJsonChange}
            theme={codeMirrorTheme}
            basicSetup={{ foldGutter: false, lineNumbers: true }}
            style={{ fontSize: 13 }}
          />
        </div>
      </div>
    </div>
  );
}
