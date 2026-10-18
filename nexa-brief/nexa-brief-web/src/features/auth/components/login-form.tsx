"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "@/i18n/navigation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { type LoginInput, loginSchema } from "../schema";

const darkFieldClass =
  "h-auto rounded-xl border-white/14 bg-white/6 px-[15px] py-3 text-sm text-[#fafaf7] placeholder:text-[#fafaf7]/35 focus-visible:border-nb-green focus-visible:ring-nb-green/18";

export function LoginForm() {
  const t = useTranslations("access");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function doSignIn(values: LoginInput) {
    setFormError(null);
    setIsPending(true);
    try {
      const result = await signIn("credentials", { ...values, redirect: false });
      if (result?.error) {
        setFormError(t("loginError"));
        return;
      }
      router.push("/dashboard");
    } catch {
      setFormError(t("loginError"));
    } finally {
      setIsPending(false);
    }
  }

  function onSubmit(values: LoginInput) {
    return doSignIn(values);
  }

  // Development-only shortcut for the local seeded admin. Production Docker builds use
  // NODE_ENV=production, so this control is not rendered there.
  const showQuickLogin = process.env.NODE_ENV === "development";
  function quickLogin() {
    return doSignIn({ email: "admin@nexabrief.com", password: "admin123" });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-[#fafaf7]/72">
                {t("emailLabel")}
              </FormLabel>
              <FormControl>
                <Input type="email" autoComplete="username" className={darkFieldClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-[#fafaf7]/72">
                {t("passwordLabel")}
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  className={darkFieldClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {formError && (
          <p className="-mt-1.5 text-[12.5px] font-semibold text-[#ff9686]">{formError}</p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="mt-1.5 rounded-full bg-[#fafaf7] px-5 py-3.5 font-nb-sans text-sm font-semibold text-nb-ink shadow-[0_12px_22px_-8px_rgba(0,0,0,0.55),0_4px_8px_-2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_3px_rgba(0,0,0,0.08)] transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
        >
          {isPending ? "..." : t("loginButton")}
        </button>

        {showQuickLogin && (
          <button
            type="button"
            onClick={quickLogin}
            disabled={isPending}
            className="rounded-full border border-dashed border-white/25 px-5 py-3 font-nb-sans text-xs font-semibold text-[#fafaf7]/60 transition-colors hover:border-white/45 hover:text-[#fafaf7] disabled:pointer-events-none disabled:opacity-60"
          >
            ⚡ Entrar directo (solo en desarrollo)
          </button>
        )}
      </form>
    </Form>
  );
}
