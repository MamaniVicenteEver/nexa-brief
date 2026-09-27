"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { useRequestAccess } from "../hooks/use-request-access";
import { type AccessRequestInput, accessRequestSchema } from "../schema";

const darkFieldClass =
  "h-auto rounded-xl border-white/14 bg-white/6 px-[15px] py-3 text-sm text-[#fafaf7] placeholder:text-[#fafaf7]/35 focus-visible:border-nb-green focus-visible:ring-nb-green/18";

export function AccessRequestForm() {
  const t = useTranslations("access");
  const form = useForm<AccessRequestInput>({
    resolver: zodResolver(accessRequestSchema),
    defaultValues: { email: "", message: "" },
  });
  const { mutate, isPending, isSuccess } = useRequestAccess();

  function onSubmit(values: AccessRequestInput) {
    mutate(values, {
      onSuccess: () => {
        toast.success(t("requestSuccess"));
        form.reset();
      },
      onError: () => {
        toast.error(t("requestError"));
      },
    });
  }

  if (isSuccess) {
    return <p className="text-sm font-semibold text-nb-green">{t("requestSuccess")}</p>;
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
                <Input
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  className={darkFieldClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-[#fafaf7]/72">
                {t("messageLabel")}{" "}
                <span className="font-normal text-[#fafaf7]/40">{t("messageOptional")}</span>
              </FormLabel>
              <FormControl>
                <Textarea rows={3} className={darkFieldClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button
          type="submit"
          disabled={isPending}
          className="mt-1.5 rounded-full bg-[#fafaf7] px-5 py-3.5 font-nb-sans text-sm font-semibold text-nb-ink shadow-[0_12px_22px_-8px_rgba(0,0,0,0.55),0_4px_8px_-2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_3px_rgba(0,0,0,0.08)] transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
        >
          {isPending ? "Enviando..." : t("requestButton")}
        </button>
      </form>
    </Form>
  );
}
