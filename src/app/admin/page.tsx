import { redirect } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, clearSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { SuggestionForm } from "./SuggestionForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

async function quickStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as
    | "DRAFT"
    | "APPROVED"
    | "SCHEDULED"
    | "PUBLISHED"
    | "ARCHIVED";
  const data: { status: typeof status; publishedAt?: Date | null; scheduledFor?: Date | null } = {
    status,
  };
  if (status === "PUBLISHED") data.publishedAt = new Date();
  if (status === "DRAFT" || status === "ARCHIVED") {
    data.publishedAt = null;
    data.scheduledFor = null;
  }
  await prisma.article.update({ where: { id }, data });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/football");
  revalidatePath("/cricket");
}

async function logout() {
  "use server";
  await clearSessionCookie();
  redirect("/admin/login");
}

const STATUSES = ["DRAFT", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
const SPORT_COLORS: Record<string, string> = {
  FOOTBALL: "text-football",
  CRICKET: "text-cricket",
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-line text-ink-dim",
  APPROVED: "bg-accent/20 text-accent",
  SCHEDULED: "bg-football/20 text-football",
  PUBLISHED: "bg-cricket/30 text-cricket",
  ARCHIVED: "bg-line/50 text-ink-dim",
};

export default async function AdminDashboard() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const articles = await prisma.article.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const counts = await prisma.article.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  return (
    <div className="max-w-5xl mx-auto px-5 pt-8 pb-16">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-accent text-xs uppercase tracking-[0.2em] font-bold">Editorial</p>
          <h1 className="text-2xl font-bold">Article queue</h1>
        </div>
        <form action={logout}>
          <button className="text-xs text-ink-dim uppercase tracking-widest hover:text-ink">
            Sign out
          </button>
        </form>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {STATUSES.map((s) => (
          <div key={s} className="card px-4 py-3">
            <div className="text-2xl font-extrabold font-mono">{countMap[s] ?? 0}</div>
            <div className="text-[10px] uppercase tracking-widest text-ink-dim">{s}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-3 mb-6">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent mb-2">
            Suggest a story
          </h2>
          <p className="text-xs text-ink-dim mb-3 leading-relaxed">
            Pick a slot, optionally refine with a prompt, click queue. Your laptop's Claude Code
            poller picks it up next time you run{" "}
            <code className="text-accent">npm run process:queue</code> (or while{" "}
            <code className="text-accent">--watch</code> mode is running).
          </p>
          <SuggestionForm />
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent mb-2">
            Local commands
          </h2>
          <pre className="bg-panel-2 border border-line rounded-lg p-3 text-[11px] font-mono leading-relaxed overflow-x-auto">
{`# pick up queued requests
npm run process:queue
npm run process:queue -- --watch

# direct one-off (no queue)
npm run generate -- --slot=on-this-day

# auto-publish SCHEDULED
npm run publish:scheduled`}
          </pre>
        </div>
      </div>

      {/* Recent generation requests */}
      {await renderRequestsTable()}


      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-ink-dim text-[11px] uppercase tracking-widest">
            <tr>
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Sport</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Updated</th>
              <th className="text-left px-4 py-3">Quick set</th>
            </tr>
          </thead>
          <tbody>
            {articles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-dim">
                  No articles yet. Run <code className="text-accent">npm run db:seed</code> for the
                  starter pieces, or <code className="text-accent">npm run generate -- --slot=on-this-day</code>.
                </td>
              </tr>
            )}
            {articles.map((a) => (
              <tr key={a.id} className="border-t border-line hover:bg-panel-2/50">
                <td className="px-4 py-3 max-w-xs">
                  <Link
                    href={`/admin/article/${a.id}`}
                    className="font-semibold hover:text-accent block truncate"
                  >
                    {a.title}
                  </Link>
                  <span className="text-[11px] text-ink-dim font-mono">{a.slug}</span>
                </td>
                <td
                  className={`px-4 py-3 hidden sm:table-cell text-xs uppercase tracking-widest font-bold ${SPORT_COLORS[a.sport]}`}
                >
                  {a.sport}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${STATUS_COLORS[a.status]}`}
                  >
                    {a.status}
                  </span>
                  {a.scheduledFor && a.status === "SCHEDULED" && (
                    <div className="text-[10px] text-ink-dim font-mono mt-1">
                      {a.scheduledFor.toISOString().slice(0, 16).replace("T", " ")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-dim font-mono hidden md:table-cell">
                  {a.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-4 py-3">
                  <form action={quickStatus} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={a.id} />
                    <select
                      name="status"
                      defaultValue={a.status}
                      className="bg-panel-2 border border-line rounded px-2 py-1 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button className="text-xs bg-accent text-bg px-2 py-1 rounded font-bold">
                      Set
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const REQ_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-line text-ink-dim",
  PROCESSING: "bg-accent/20 text-accent",
  DONE: "bg-cricket/30 text-cricket",
  FAILED: "bg-football/30 text-football",
};

async function renderRequestsTable() {
  const reqs = await prisma.generationRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  if (reqs.length === 0) return null;
  return (
    <div className="card overflow-hidden mb-6">
      <div className="bg-panel-2 px-4 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-accent">
          Recent generation requests
        </h2>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-panel-2 text-ink-dim text-[11px] uppercase tracking-widest">
          <tr>
            <th className="text-left px-4 py-2 hidden sm:table-cell">When</th>
            <th className="text-left px-4 py-2">Slot</th>
            <th className="text-left px-4 py-2">Prompt</th>
            <th className="text-left px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {reqs.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="px-4 py-2 text-xs text-ink-dim font-mono hidden sm:table-cell">
                {r.createdAt.toISOString().slice(5, 16).replace("T", " ")}
              </td>
              <td className="px-4 py-2 text-xs">{r.slot}</td>
              <td className="px-4 py-2 text-xs text-ink-dim max-w-md truncate">
                {r.prompt.length > 90 ? r.prompt.slice(0, 90) + "…" : r.prompt}
                {r.errorMessage && (
                  <span className="block text-football text-[10px] mt-0.5">
                    {r.errorMessage.slice(0, 140)}
                  </span>
                )}
              </td>
              <td className="px-4 py-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${REQ_STATUS_COLORS[r.status]}`}
                >
                  {r.status}
                </span>
                {r.articleId && r.status === "DONE" && (
                  <Link
                    href={`/admin/article/${r.articleId}`}
                    className="ml-2 text-xs underline text-accent"
                  >
                    open
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
