"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  type AcademyCategory,
  type AcademyPlan,
  type AcademySession,
  createAcademyPlan,
  createAcademySession,
  enqueueAcademyPlan,
  getAcademyCatalog,
  sendAcademyMessage,
} from "../api/academy-service";

export function AcademyPlanner() {
  const t = useTranslations("academy");
  const [categories, setCategories] = useState<AcademyCategory[]>([]);
  const [session, setSession] = useState<AcademySession | null>(null);
  const [message, setMessage] = useState("");
  const [categoryId, setCategoryId] = useState("english");
  const [levelId, setLevelId] = useState("a1");
  const [learnerProfile, setLearnerProfile] = useState("Adultos principiantes");
  const [voiceProvider, setVoiceProvider] = useState("gemini");
  const [voiceModel, setVoiceModel] = useState("gemini-2.5-flash-preview-tts");
  const [plan, setPlan] = useState<AcademyPlan | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAcademyCatalog()
      .then((response) => setCategories(response.categories))
      .catch(() => setError(t("catalogError")));
  }, [t]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId],
  );

  useEffect(() => {
    const firstLevel = selectedCategory?.levels[0]?.id;
    if (firstLevel && !selectedCategory?.levels.some((level) => level.id === levelId)) {
      setLevelId(firstLevel);
    }
  }, [selectedCategory, levelId]);

  async function startSession() {
    setIsBusy(true);
    setError(null);
    try {
      const response = await createAcademySession();
      setSession(response.session);
    } catch {
      setError(t("sessionError"));
    } finally {
      setIsBusy(false);
    }
  }

  async function sendMessage() {
    if (!session || !message.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await sendAcademyMessage(session.id, message);
      setSession(response.session);
      setMessage("");
      if (response.session.category_id) setCategoryId(response.session.category_id);
      if (response.session.level_id) setLevelId(response.session.level_id);
    } catch {
      setError(t("messageError"));
    } finally {
      setIsBusy(false);
    }
  }

  async function generatePlan() {
    setIsBusy(true);
    setError(null);
    try {
      const response = await createAcademyPlan({
        category_id: categoryId,
        level_id: levelId,
        learner_profile: learnerProfile,
        lesson_count: 10,
        pilot_count: 3,
        pilot_duration_seconds: 15,
        target_duration_seconds: 900,
        voice_provider: voiceProvider,
        voice_model: voiceModel,
        template_id: undefined,
      });
      setPlan(response.plan);
    } catch {
      setError(t("planError"));
    } finally {
      setIsBusy(false);
    }
  }

  async function queuePlan() {
    if (!plan) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await enqueueAcademyPlan(plan.id, plan.lesson_count);
      setBatchId(response.batch.id);
    } catch {
      setError(t("queueError"));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-24 pt-28 md:px-10">
      <div className="max-w-[850px]">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-nb-mute">
          {t("eyebrow")}
        </p>
        <h1 className="font-nb-sans text-[clamp(32px,5vw,68px)] font-extrabold leading-[0.96] tracking-[-0.05em] text-nb-ink">
          {t("heading")}
        </h1>
        <p className="mt-6 max-w-[720px] text-lg leading-7 text-nb-ink-soft">{t("intro")}</p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="nb-glass-panel p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-nb-mute">01</p>
              <h2 className="mt-2 text-2xl font-bold text-nb-ink">{t("conversationTitle")}</h2>
            </div>
            {!session && (
              <button
                type="button"
                onClick={startSession}
                disabled={isBusy}
                className="nb-btn-pill px-5 py-3 text-sm font-semibold"
              >
                {t("startConversation")}
              </button>
            )}
          </div>

          {session && (
            <>
              <div className="mt-6 max-h-[330px] space-y-3 overflow-y-auto rounded-2xl bg-white/60 p-4">
                {session.messages.map((item, index) => (
                  <div
                    key={`${item.role}-${index}`}
                    className={
                      item.role === "user"
                        ? "ml-10 rounded-xl bg-nb-ink px-4 py-3 text-sm text-white"
                        : "mr-10 rounded-xl border border-nb-line bg-white px-4 py-3 text-sm leading-6 text-nb-ink-soft"
                    }
                  >
                    {item.content}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-3">
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void sendMessage();
                  }}
                  placeholder={t("messagePlaceholder")}
                  className="min-w-0 flex-1 rounded-xl border border-nb-line bg-white px-4 py-3 text-sm outline-none focus:border-nb-ink"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={isBusy || !message.trim()}
                  className="rounded-xl bg-nb-green-dark px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {t("send")}
                </button>
              </div>
            </>
          )}
        </section>

        <section className="nb-glass-panel p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-nb-mute">02</p>
          <h2 className="mt-2 text-2xl font-bold text-nb-ink">{t("planTitle")}</h2>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-nb-ink-soft">
              {t("category")}
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="rounded-xl border border-nb-line bg-white px-4 py-3 font-normal text-nb-ink"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-nb-ink-soft">
              {t("level")}
              <select
                value={levelId}
                onChange={(event) => setLevelId(event.target.value)}
                className="rounded-xl border border-nb-line bg-white px-4 py-3 font-normal text-nb-ink"
              >
                {(selectedCategory?.levels ?? []).map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-nb-ink-soft">
              {t("learner")}
              <input
                value={learnerProfile}
                onChange={(event) => setLearnerProfile(event.target.value)}
                className="rounded-xl border border-nb-line bg-white px-4 py-3 font-normal text-nb-ink"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-nb-ink-soft">
                {t("voiceProvider")}
                <select
                  value={voiceProvider}
                  onChange={(event) => setVoiceProvider(event.target.value)}
                  className="rounded-xl border border-nb-line bg-white px-4 py-3 font-normal text-nb-ink"
                >
                  <option value="gemini">Google AI Studio</option>
                  <option value="novita">Novita AI</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-nb-ink-soft">
                {t("voiceModel")}
                <input
                  value={voiceModel}
                  onChange={(event) => setVoiceModel(event.target.value)}
                  className="rounded-xl border border-nb-line bg-white px-4 py-3 font-normal text-nb-ink"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={generatePlan}
              disabled={isBusy}
              className="mt-2 rounded-xl bg-nb-ink px-5 py-3.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {t("generatePlan")}
            </button>
          </div>
        </section>
      </div>

      {error && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {plan && (
        <section className="nb-glass-panel mt-6 p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-nb-mute">03</p>
              <h2 className="mt-2 text-2xl font-bold text-nb-ink">{plan.title}</h2>
              <p className="mt-2 text-sm text-nb-ink-soft">
                {t("planSummary", { count: plan.lesson_count, pilot: plan.pilot_count })}
              </p>
            </div>
            <button
              type="button"
              onClick={queuePlan}
              disabled={isBusy || Boolean(batchId)}
              className="rounded-xl bg-nb-green-dark px-5 py-3.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {batchId ? t("queued", { id: batchId }) : t("queuePlan")}
            </button>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {plan.lessons.map((lesson) => (
              <article
                key={lesson.id}
                className="rounded-2xl border border-nb-line bg-white/70 p-4"
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-nb-mute">
                  {String(lesson.order).padStart(2, "0")}
                </p>
                <h3 className="mt-3 font-bold text-nb-ink">{lesson.title}</h3>
                <p className="mt-2 text-sm leading-5 text-nb-ink-soft">{lesson.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
