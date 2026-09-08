"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { getEngines } from "@/features/home/api/engine-status";
import { submitJob } from "@/features/jobs/api/jobs";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/infrastructure/api/api-error";
import type { EngineName, TemplateDetail } from "@/infrastructure/api/types";
import { Button } from "@/shared/components/ui/Button";
import { cn } from "@/shared/lib/utils";
import { useTemplateEditorState } from "../hooks/useTemplateEditorState";
import { CodePanels } from "./CodePanels";
import { LivePreview } from "./LivePreview";
import { ReactComponentPanel } from "./ReactComponentPanel";
import { RemotionPreview } from "./RemotionPreview";
import "./RenderEditor.css";

export function RenderEditor({
  template,
  engineNav,
  layout = "default",
}: {
  template: TemplateDetail;
  engineNav?: ReactNode;
  layout?: "default" | "studio";
}) {
  const t = useTranslations("templateDetail");
  const router = useRouter();
  const editor = useTemplateEditorState(template);
  const isReact = template.engine === "remotion";

  const { data: engines } = useQuery({ queryKey: ["engines"], queryFn: getEngines });

  const mutation = useMutation({
    mutationFn: () =>
      submitJob({
        input: isReact
          ? {
              kind: "react",
              componentSource: editor.componentSource,
              props: JSON.parse(editor.propsJson || "{}"),
            }
          : { kind: "html", html: editor.html, css: editor.css, js: editor.js },
        engine: editor.engine,
        worker: editor.worker,
        fps: editor.fps,
        durationSeconds: editor.durationSeconds,
        formats: editor.formats,
      }),
    onSuccess: ({ jobId }) => router.push(`/trabajos/${jobId}`),
  });

  const isImplemented = (name: EngineName) =>
    engines?.find((e) => e.name === name)?.implemented ?? false;
  const canRecord =
    (editor.engine === "auto" || isImplemented(editor.engine)) &&
    !(editor.worker === "aws" && editor.engine === "playwright") &&
    editor.formats.length > 0;

  return (
    <div className={cn("nr-editor", layout === "studio" && "nr-editor--studio")}>
      <div className="nr-editor__main">
        {isReact ? (
          <>
            <ReactComponentPanel
              componentSource={editor.componentSource}
              propsJson={editor.propsJson}
              onComponentSourceChange={editor.setComponentSource}
              onPropsJsonChange={editor.setPropsJson}
              toolbarContent={engineNav}
            />
            <RemotionPreview
              componentSource={editor.componentSource}
              propsJson={editor.propsJson}
              fps={editor.fps}
              durationSeconds={editor.durationSeconds}
              format={editor.formats[0] ?? "desktop"}
            />
          </>
        ) : (
          <>
            <CodePanels
              html={editor.html}
              css={editor.css}
              js={editor.js}
              onHtmlChange={editor.setHtml}
              onCssChange={editor.setCss}
              onJsChange={editor.setJs}
              toolbarContent={engineNav}
              stacked={layout === "studio"}
            />

            <LivePreview doc={editor.previewDoc} />
          </>
        )}
      </div>

      <aside className="nr-editor__aside">
        <div className="nr-editor__worker-picker">
          <div className="nr-editor__section-label">{t("config.worker")}</div>
          <div className="nr-editor__seg-row">
            <Button
              variant="seg"
              active={editor.worker === "local"}
              onClick={() => editor.setWorker("local")}
            >
              {t("config.workerLocal")}
            </Button>
            <Button
              variant="seg"
              active={editor.worker === "aws"}
              onClick={() => editor.setWorker("aws")}
            >
              {t("config.workerAws")}
            </Button>
          </div>
        </div>

        <div className="nr-editor__fps-picker">
          <div className="nr-editor__section-label">{t("config.fps")}</div>
          <div className="nr-editor__seg-row">
            <Button variant="seg" active={editor.fps === 30} onClick={() => editor.setFps(30)}>
              30
            </Button>
            <Button variant="seg" active={editor.fps === 60} onClick={() => editor.setFps(60)}>
              60
            </Button>
          </div>
        </div>

        <div className="nr-editor__duration-picker">
          <label className="nr-editor__section-label" htmlFor={`duration-${template.slug}`}>
            {t("config.duration")}
          </label>
          <input
            id={`duration-${template.slug}`}
            className="nr-editor__duration-input"
            type="number"
            min="1"
            max="3600"
            step="1"
            value={editor.durationSeconds}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value))
                editor.setDurationSeconds(Math.min(3600, Math.max(1, value)));
            }}
          />
        </div>

        <div className="nr-editor__format-picker">
          <div className="nr-editor__section-label">{t("config.format")}</div>
          <div className="nr-editor__seg-row">
            <Button
              variant="seg"
              active={editor.formats.includes("desktop")}
              onClick={() => editor.toggleFormat("desktop")}
            >
              {t("config.formatDesktop")}
            </Button>
            <Button
              variant="seg"
              active={editor.formats.includes("mobile")}
              onClick={() => editor.toggleFormat("mobile")}
            >
              {t("config.formatMobile")}
            </Button>
          </div>
        </div>

        <Button
          variant="accent-solid"
          disabled={!canRecord || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? t("recordingCta") : t("recordCta")}
        </Button>

        {editor.engine !== "auto" && !isImplemented(editor.engine) && (
          <p className="nr-editor__notice">{t("notImplementedNotice")}</p>
        )}

        {mutation.isError && (
          <p className="nr-editor__error">
            {mutation.error instanceof ApiError ? mutation.error.message : t("submitError")}
          </p>
        )}
      </aside>
    </div>
  );
}
