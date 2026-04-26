import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { DeleteSocialButton } from "./DeleteSocialButton";
import { PostSocialButton } from "./PostSocialButton";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
const TYPES = ["ON_THIS_DAY", "STAT_MOMENT", "QUICK_TAKE", "TRANSFER_FLASH", "OTHER"] as const;
const MAX_TWEET_CHARS = 280;

async function saveSocial(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const tweetText = String(formData.get("tweetText") ?? "");
  const status = String(formData.get("status") ?? "DRAFT") as (typeof STATUSES)[number];
  const type = String(formData.get("type") ?? "ON_THIS_DAY") as (typeof TYPES)[number];
  const sport = String(formData.get("sport") ?? "FOOTBALL") as "FOOTBALL" | "CRICKET";
  const scheduledForRaw = String(formData.get("scheduledFor") ?? "").trim();

  const data: {
    title: string;
    tweetText: string;
    status: typeof status;
    type: typeof type;
    sport: typeof sport;
    scheduledFor?: Date | null;
    publishedAt?: Date | null;
  } = { title, tweetText, status, type, sport };

  if (status === "SCHEDULED" && scheduledForRaw) {
    data.scheduledFor = new Date(scheduledForRaw);
  } else if (status !== "SCHEDULED") {
    data.scheduledFor = null;
  }
  if (status === "PUBLISHED") data.publishedAt = new Date();
  else if (status === "DRAFT" || status === "ARCHIVED") data.publishedAt = null;

  await prisma.socialPost.update({ where: { id }, data });
  revalidatePath("/admin");
  redirect("/admin");
}

async function deleteSocial(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await prisma.socialPost.delete({ where: { id } });
  revalidatePath("/admin");
  redirect("/admin");
}

async function postSocial(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const post = await prisma.socialPost.findUnique({ where: { id } });
  if (!post) return;
  const { postSocialPost } = await import("@/lib/twitter");
  try {
    const tweetImages = Array.isArray(post.tweetImages)
      ? (post.tweetImages as Array<{ slot: number; alt: string; base64: string }>)
      : null;
    const result = await postSocialPost({ tweetText: post.tweetText, tweetImages });
    await prisma.socialPost.update({
      where: { id },
      data: { tweetIds: result.tweetIds.join(","), tweetedAt: new Date() },
    });
  } catch (e) {
    throw e;
  }
  revalidatePath(`/admin/social/${id}`);
  revalidatePath("/admin");
}

export default async function SocialEditor({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const { id } = await params;
  const post = await prisma.socialPost.findUnique({ where: { id } });
  if (!post) notFound();

  const scheduledLocal = post.scheduledFor
    ? new Date(post.scheduledFor.getTime() - post.scheduledFor.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";

  const tweets = post.tweetText.split(/\r?\n\s*\r?\n+/).map((t) => t.trim()).filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto px-5 pt-8 pb-16">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="text-xs text-ink-dim uppercase tracking-widest hover:text-ink">
            ← Queue
          </Link>
          <h1 className="text-2xl font-bold mt-2">Edit social post</h1>
          <p className="text-xs text-ink-dim font-mono mt-1">id: {post.id}</p>
          {post.tweetIds && post.tweetedAt && (
            <p className="text-xs text-[#1d9bf0] mt-1">
              Posted to X{" "}
              <a
                href={`https://x.com/i/status/${post.tweetIds.split(",")[0]}`}
                target="_blank"
                rel="noopener"
                className="underline"
              >
                {post.tweetedAt.toISOString().slice(0, 16).replace("T", " ")}
              </a>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <form action={postSocial}>
            <input type="hidden" name="id" value={post.id} />
            <PostSocialButton alreadyPosted={!!post.tweetIds} />
          </form>
          <form action={deleteSocial}>
            <input type="hidden" name="id" value={post.id} />
            <DeleteSocialButton />
          </form>
        </div>
      </header>

      <form action={saveSocial} className="space-y-5">
        <input type="hidden" name="id" value={post.id} />

        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">Internal title (admin only)</span>
            <input
              name="title"
              defaultValue={post.title}
              required
              className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">Type</span>
            <select
              name="type"
              defaultValue={post.type}
              className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">Sport</span>
          <select
            name="sport"
            defaultValue={post.sport}
            className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent"
          >
            <option value="FOOTBALL">Football</option>
            <option value="CRICKET">Cricket</option>
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">
            Tweet text — separate tweets with a blank line (max 3 tweets, 270 chars each)
          </span>
          <textarea
            name="tweetText"
            defaultValue={post.tweetText}
            rows={10}
            required
            className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">Status</span>
            <select
              name="status"
              defaultValue={post.status}
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
            <span className="text-[11px] uppercase tracking-widest text-ink-dim font-bold">Schedule for</span>
            <input
              type="datetime-local"
              name="scheduledFor"
              defaultValue={scheduledLocal}
              className="w-full mt-1 bg-panel-2 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent"
            />
          </label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-line">
          <button type="submit" className="bg-accent text-bg font-bold px-5 py-2.5 rounded-lg">
            Save changes
          </button>
          <Link href="/admin" className="text-ink-dim hover:text-ink px-5 py-2.5">
            Cancel
          </Link>
        </div>
      </form>

      {/* Preview */}
      <div className="card p-5 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent">Preview</h2>
          <span className="text-[11px] text-ink-dim">
            {tweets.length} tweet{tweets.length === 1 ? "" : "s"}
          </span>
        </div>
        <ol className="space-y-3">
          {tweets.map((t, i) => (
            <li key={i} className="border border-line bg-panel-2 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2 text-[11px] text-ink-dim font-mono">
                <span>tweet {i + 1}</span>
                <span className={t.length > MAX_TWEET_CHARS ? "text-football font-bold" : ""}>
                  {t.length}/{MAX_TWEET_CHARS}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap text-ink leading-relaxed">{t}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
