import type { Metadata } from "next";
import { Database } from "lucide-react";

export const metadata: Metadata = {
  title: "Backend unavailable — wacrm",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SetupRequiredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/10 sm:p-10">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Database aria-hidden="true" className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium tracking-wide text-primary">Preview status</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          CRM backend unavailable
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          This preview has no Supabase connection. Authentication and CRM data
          require that backend, so the app is paused rather than showing an
          incomplete or unauthenticated workspace.
        </p>
        <div className="mt-8 rounded-xl border border-border bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
          No demo data or local-only authentication is being used. The app will
          return to normal when a Supabase connection is available to the
          preview.
        </div>
      </section>
    </main>
  );
}
