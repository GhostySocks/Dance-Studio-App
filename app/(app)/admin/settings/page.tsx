"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { studioSchema, type StudioFormData } from "@/lib/validations/account";

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

function timezoneOptions(current: string): string[] {
  let all: string[] = [];
  try {
    all = Intl.supportedValuesOf("timeZone");
  } catch {
    // Older browsers: fall back to the short list
  }
  return Array.from(new Set([...COMMON_TIMEZONES, current, ...all])).filter(Boolean);
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  const form = useForm<StudioFormData>({
    resolver: zodResolver(studioSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      email: "",
      website: "",
      timezone: "America/New_York",
      billingCycleDay: 1,
    },
  });
  const { register, handleSubmit, reset, watch, formState } = form;
  const { errors, isSubmitting, isDirty } = formState;
  const timezone = watch("timezone");
  const zones = useMemo(() => timezoneOptions(timezone), [timezone]);

  useEffect(() => {
    setOrigin(window.location.origin);
    async function load() {
      try {
        const res = await fetch("/api/studio");
        if (!res.ok) throw new Error("Failed");
        const { data } = await res.json();
        if (data) {
          reset({
            name: data.name ?? "",
            address: data.address ?? "",
            phone: data.phone ?? "",
            email: data.email ?? "",
            website: data.website ?? "",
            timezone: data.timezone ?? "America/New_York",
            billingCycleDay: data.billingCycleDay ?? 1,
          });
        }
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reset]);

  async function onSubmit(values: StudioFormData) {
    try {
      const res = await fetch("/api/studio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not save settings");
        return;
      }
      reset(values);
      toast.success("Settings saved");
    } catch {
      toast.error("Could not save settings. Please try again.");
    }
  }

  const embedCode = `<iframe src="${origin}/widget" title="Class schedule" loading="lazy" style="width:100%;height:600px;border:0"></iframe>`;

  async function copyEmbed() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the code and copy it manually.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" />
        <p className="text-muted-foreground">Failed to load studio settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Studio details shown on the public site, emails and invoices" />

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Studio profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="name" label="Studio name" error={errors.name?.message}>
                <Input
                  id="name"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  {...register("name")}
                />
              </Field>
              <Field id="email" label="Contact email" error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  {...register("email")}
                />
              </Field>
              <Field id="phone" label="Phone" error={errors.phone?.message}>
                <Input
                  id="phone"
                  type="tel"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  {...register("phone")}
                />
              </Field>
              <Field id="website" label="Website" error={errors.website?.message}>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://"
                  aria-invalid={!!errors.website}
                  aria-describedby={errors.website ? "website-error" : undefined}
                  {...register("website")}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field id="address" label="Address" error={errors.address?.message}>
                  <Input
                    id="address"
                    aria-invalid={!!errors.address}
                    aria-describedby={errors.address ? "address-error" : undefined}
                    {...register("address")}
                  />
                </Field>
              </div>
              <Field
                id="timezone"
                label="Timezone"
                error={errors.timezone?.message}
                hint="Class times are shown in this timezone."
              >
                <select
                  id="timezone"
                  aria-describedby={errors.timezone ? "timezone-error" : "timezone-hint"}
                  className="h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  {...register("timezone")}
                >
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id="billingCycleDay"
                label="Billing day of month"
                error={errors.billingCycleDay?.message}
                hint="1 to 28, so it exists in every month."
              >
                <Input
                  id="billingCycleDay"
                  type="number"
                  min={1}
                  max={28}
                  aria-invalid={!!errors.billingCycleDay}
                  aria-describedby={errors.billingCycleDay ? "billingCycleDay-error" : "billingCycleDay-hint"}
                  {...register("billingCycleDay", { valueAsNumber: true })}
                />
              </Field>
            </div>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Embed the schedule on your website</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste this code into any page of your website to show upcoming classes with live
            availability. Add <code className="rounded bg-muted px-1">?days=30</code> after{" "}
            <code className="rounded bg-muted px-1">/widget</code> to change how far ahead it looks
            (1 to 56 days, 14 by default).
          </p>
          <pre
            tabIndex={0}
            aria-label="Embed code"
            className="overflow-x-auto rounded-xl bg-muted p-4 text-xs leading-relaxed"
          >
            <code>{embedCode}</code>
          </pre>
          <Button type="button" variant="outline" onClick={copyEmbed}>
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Copied" : "Copy code"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
