import { redirect } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, clearSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

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
            Generate a story
          </h2>
          <p className="text-xs text-ink-dim mb-3 leading-relaxed">
            Generation runs locally on your laptop using your Claude Max subscription. From your
            terminal, in this project folder, run any of:
          </p>
          <pre className="bg-panel-2 border border-line rounded-lg p-3 text-xs font-mono overflow-x-auto leading-relaxed">
{`npm run generate -- --slot=on-this-day
npm run generate -- --slot=recent-match
npm run generate -- --slot=transfer
npm run generate -- --slot=tactics
npm run generate -- --slot=player
npm run generate -- --slot=custom --custom="Your prompt here"
npm run generate -- --daily              # all 5 in sequence`}
          </pre>
          <p className="text-xs text-ink-dim mt-3">
            Drafts appear here within a few minutes. Click any draft to review and edit before
            approving.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent mb-2">
            Schedule worker
          </h2>
          <p className="text-xs text-ink-dim mb-3 leading-relaxed">
            To auto-publish SCHEDULED articles when their time comes, run on a cron:
          </p>
          <pre className="bg-panel-2 border border-line rounded-lg p-3 text-xs font-mono">
{`npm run publish:scheduled`}
          </pre>
        </div>
      </div>

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
