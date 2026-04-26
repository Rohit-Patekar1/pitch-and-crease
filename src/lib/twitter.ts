/**
 * Twitter / X thread-with-images posting client.
 *
 * Uses OAuth 1.0a (user context). Reads four env vars set in Railway:
 *   TWITTER_API_KEY
 *   TWITTER_API_SECRET
 *   TWITTER_ACCESS_TOKEN
 *   TWITTER_ACCESS_SECRET
 *
 * If any are missing, callers get a clear "not configured" error.
 */
import { TwitterApi, type TweetV2PostTweetResult } from "twitter-api-v2";

const SITE_URL = process.env.SITE_URL || "https://pitch-and-crease-production.up.railway.app";
const MAX_TWEET_CHARS = 280;

function getClient(): TwitterApi | null {
  const k = process.env.TWITTER_API_KEY;
  const ks = process.env.TWITTER_API_SECRET;
  const t = process.env.TWITTER_ACCESS_TOKEN;
  const ts = process.env.TWITTER_ACCESS_SECRET;
  if (!k || !ks || !t || !ts) return null;
  return new TwitterApi({
    appKey: k,
    appSecret: ks,
    accessToken: t,
    accessSecret: ts,
  });
}

export function isTwitterConfigured(): boolean {
  return getClient() !== null;
}

/** Each tweet image: which tweet slot it attaches to + the PNG bytes. */
export interface TweetImage {
  slot: number;
  alt: string;
  base64: string;
}

export interface PostThreadInput {
  sport: "FOOTBALL" | "CRICKET";
  slug: string;
  title: string;
  dek: string;
  /** Manual thread text — one tweet per line. Optional. */
  twitterThread?: string | null;
  /** Pre-rendered images mapped to specific tweet slots. Optional. */
  tweetImages?: TweetImage[] | null;
}

export interface PostThreadResult {
  tweetIds: string[];
  firstTweetUrl: string;
}

function articleUrl(input: PostThreadInput): string {
  const path = input.sport === "FOOTBALL" ? "football" : "cricket";
  return `${SITE_URL}/${path}/${input.slug}`;
}

function defaultThread(input: PostThreadInput): string[] {
  const url = articleUrl(input);
  return [
    truncateForTweet(`${input.title}\n\n${input.dek}\n\n🧵👇`),
    truncateForTweet(`Read the full breakdown 👉 ${url}`),
  ];
}

function truncateForTweet(text: string): string {
  if (text.length <= MAX_TWEET_CHARS) return text;
  return text.slice(0, MAX_TWEET_CHARS - 1) + "…";
}

/** Append the article URL to the LAST tweet if no URL is present anywhere in the thread. */
function ensureUrlInThread(tweets: string[], url: string): string[] {
  const hasUrl = tweets.some((t) => t.includes(url) || /\bhttps?:\/\//.test(t));
  if (hasUrl) return tweets;
  const lastIdx = tweets.length - 1;
  const lastWithUrl = `${tweets[lastIdx]}\n\n${url}`;
  if (lastWithUrl.length <= MAX_TWEET_CHARS) {
    tweets[lastIdx] = lastWithUrl;
    return tweets;
  }
  // Otherwise add a new short tweet
  tweets.push(`Full breakdown 👉 ${url}`);
  return tweets;
}

function parseThread(threadText: string, fallback: PostThreadInput): string[] {
  // Tweets are separated by blank lines. Single newlines stay inside a tweet
  // for visual rhythm (multi-line stat lists, line breaks, etc).
  const tweets = threadText
    .split(/\r?\n\s*\r?\n+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tweets.length === 0) return defaultThread(fallback);
  // Sanity check — runaway threads probably mean the writer used single newlines.
  if (tweets.length > 18) return defaultThread(fallback);
  return ensureUrlInThread(tweets.map(truncateForTweet), articleUrl(fallback));
}

/** Group images by slot for fast lookup. */
function groupImagesBySlot(imgs: TweetImage[] | null | undefined): Map<number, TweetImage[]> {
  const map = new Map<number, TweetImage[]>();
  if (!imgs) return map;
  for (const img of imgs) {
    const arr = map.get(img.slot) ?? [];
    arr.push(img);
    map.set(img.slot, arr);
  }
  return map;
}

/**
 * Post a thread with optional images attached at specific tweet slots.
 * Returns the tweet IDs in order. The first tweet ID = canonical thread URL.
 */
export async function postArticleThread(input: PostThreadInput): Promise<PostThreadResult> {
  const client = getClient();
  if (!client) {
    throw new Error(
      "Twitter not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET in Railway env vars.",
    );
  }
  const tweets = input.twitterThread
    ? parseThread(input.twitterThread, input)
    : defaultThread(input);
  const imagesBySlot = groupImagesBySlot(input.tweetImages);

  const ids: string[] = [];
  let replyTo: string | undefined;

  for (let i = 0; i < tweets.length; i++) {
    const text = tweets[i];
    const tweetMedia = imagesBySlot.get(i) ?? [];
    const mediaIds: string[] = [];

    // Twitter v1 media upload — required for attaching to v2 tweets
    for (const img of tweetMedia.slice(0, 4)) {
      // max 4 images per tweet
      try {
        const buf = Buffer.from(img.base64, "base64");
        const id = await client.v1.uploadMedia(buf, { mimeType: "image/png" });
        if (img.alt) {
          try {
            await client.v1.createMediaMetadata(id, { alt_text: { text: img.alt } });
          } catch {
            /* alt-text is best-effort */
          }
        }
        mediaIds.push(id);
      } catch (err) {
        console.warn(`[twitter] media upload failed for slot ${i}:`, err);
        // Fall through — we'd rather post the tweet without image than skip the tweet.
      }
    }

    const params: Parameters<typeof client.v2.tweet>[0] = { text };
    if (replyTo) {
      (params as { reply?: { in_reply_to_tweet_id: string } }).reply = {
        in_reply_to_tweet_id: replyTo,
      };
    }
    if (mediaIds.length > 0) {
      (params as { media?: { media_ids: string[] } }).media = {
        media_ids: mediaIds as unknown as [string, ...string[]],
      };
    }

    const res: TweetV2PostTweetResult = await client.v2.tweet(params);
    const id = res?.data?.id;
    if (!id) throw new Error("Twitter API returned no tweet id");
    ids.push(id);
    replyTo = id;
  }

  const firstTweetUrl = `https://x.com/i/status/${ids[0]}`;
  return { tweetIds: ids, firstTweetUrl };
}
