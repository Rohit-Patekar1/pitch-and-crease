import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function saveArticle(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const dek = String(formData.get("dek") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const status = String(formData.get("status") ?? "DRAFT") as
    | "DRAFT"
    | "APPROVED"
    | "SCHEDULED"
    | "PUBLISHED"
    | "ARCHIVED";
  const sport = String(formData.get("sport") ?? "FOOTBALL") as "FOOTBALL" | "CRICKET";
  const slug = String(formData.get("slug") ?? "").trim();
  const scheduledForRaw = String(formData.get("scheduledFor") ?? "").trim();
  const twitterThread = String(formData.get("twitterThread") ?? "").trim() || null;

  const data: {
    title: string;
    dek: string;
    body: string;
    status: typeof status;
    sport: typeof sport;
    slug: string;
    scheduledFor?: Date | null;
    publishedAt?: Date | null;
    twitterThread?: string | null;
  } = {
    title,
    dek,
    body,
    status,
    sport,
    slug,
    twitterThread,
  };

  if (status === "SCHEDULED" && scheduledForRaw) {
    data.scheduledFor = new Date(scheduledForRaw);
  } else if (status !== "SCHEDULED") {
    data.scheduledFor = null;
  }

  if (status === "PUBLISHED") {
    data.publishedAt = new Date();
  } else if (status === "DRAFT" || status === "ARCHIVED") {
    data.publishedAt = null;
  }

  await prisma.article.update({ where: { id }, data });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/${sport.toLowerCase()}`);
  revalidatePath(`/${sport.toLowerCase()}/${slug}`);
  redirect("/admin");
}

async function deleteArticle(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await prisma.article.delete({ where: { id } });
  revalidatePath("/admin");
  redirect("/admin");
}

const STATUSES = ["DRAFT", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;

export default async function ArticleEditor({ params }: { params: { id: string } }) {
  if (!isAuthenticated()) redirect("/admin/login");

  const article = await prisma.article.findUnique({ where: { id: params.id } });
  if (!article) notFound();

  const scheduledLocal = article.scheduledFor
    ? new Date(article.scheduledFor.getTime() - article.scheduledFor.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";

  const previewPath = `/${article.sport.toLowerCase()}/${article.slug}`;

  return (
    <div className="max-w-4xl mx-auto px-5 pt-8 pb-16">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="text-xs text-ink-dim uppercase tracking-widest hover:text-ink">
            ← Queue
          </Link>
          <h1 className="text-2xl font-bold mt-2">Edit article</h1>
          <p className="text-xs text-ink-dim font-mono mt-1">id: {article.id}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={previewPath}
            target="_blank"
            className="text-xs bg-panel-2 border border-line px-3 py-2 rounded-lg hover:border-accent"
          >
            Preview ↗
          </Link>
          <form action={deleteArticle}>
            <input type="hidden" name="id" value={article.id} />
            <button
              type="submit"
              className="text-xs bg-football text-white px-3 py-2 rounded-lg font-bold"
              onClick={(e) => {
                if (!confirm("Delete this article? This cannot be undone.")) e.preventDefault();
              }}
            >
              Delete
            </button>
          </form>
        </div>
      </header>

      <form action={saveArticle} className="space-y-5">
        <input type="hidden" name="id" value={article.id} />

        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">Title</span>
            <input
              name="title"
              defaultValue={article.title}
              required
              className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">Sport</span>
            <select
              name="sport"
              defaultValue={article.sport}
              className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent"
            >
              <option value="FOOTBALL">Football</option>
              <option value="CRICKET">Cricket</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">Slug (URL)</span>
          <input
            name="slug"
            defaultValue={article.slug}
            required
            pattern="[a-z0-9-]+"
            className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">Dek (subheadline)</span>
          <textarea
            name="dek"
            defaultValue={article.dek}
            rows={2}
            required
            className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">
            Body — HTML with embedded {"<style>"} and {"<svg>"}
          </span>
          <textarea
            name="body"
            defaultValue={article.body}
            rows={20}
            required
            spellCheck={false}
            className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 font-mono text-xs outline-none focus:border-accent"
          />
          <span className="text-[11px] text-ink-dim mt-1 block">
            {article.body.length.toLocaleString()} characters
          </span>
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">Status</span>
            <select
              name="status"
              defaultValue={article.status}
              className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">
              Schedule for (only used if status = SCHEDULED)
            </span>
            <input
              type="datetime-local"
              name="scheduledFor"
              defaultValue={scheduledLocal}
              className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent"
            />
          </label>
        </div>

        <details>
          <summary className="text-xs text-ink-dim uppercase tracking-widest cursor-pointer hover:text-ink">
            Social copy (optional, used by tomorrow's Twitter integration)
          </summary>
          <label className="block mt-3">
            <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">
              Twitter thread (one tweet per line, blank line = paragraph break)
            </span>
            <textarea
              name="twitterThread"
              defaultValue={article.twitterThread ?? ""}
              rows={6}
              className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 font-mono text-xs outline-none focus:border-accent"
            />
          </label>
        </details>

        <div className="flex gap-3 pt-4 border-t border-line">
          <button
            type="submit"
            className="bg-accent text-bg font-bold px-5 py-2.5 rounded-lg"
          >
            Save changes
          </button>
          <Link
            href="/admin"
            className="text-ink-dim hover:text-ink px-5 py-2.5"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
