/**
 * Twitter / X posting client.
 *
 * Uses OAuth 1.0a (user context) which is what's needed to post tweets on
 * behalf of an account. Reads four env vars set in Railway:
 *   TWITTER_API_KEY        (a.k.a. consumer key)
 *   TWITTER_API_SECRET     (a.k.a. consumer secret)
 *   TWITTER_ACCESS_TOKEN
 *   TWITTER_ACCESS_SECRET
 *
 * If any are missing, calls return a clear "not configured" error so the rest
 * of the app keeps working — useful for local dev and pre-Twitter days.
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

export interface PostThreadInput {
  sport: "FOOTBALL" | "CRICKET";
  slug: string;
  title: string;
  dek: string;
  /** Optional: explicit thread, one tweet per line. If absent, a default 2-tweet thread is generated. */
  twitterThread?: string | null;
}

export interface PostThreadResult {
  tweetIds: string[];
  firstTweetUrl: string;
}

function defaultThread(input: PostThreadInput): string[] {
  const path = input.sport === "FOOTBALL" ? "football" : "cricket";
  const url = `${SITE_URL}/${path}/${input.slug}`;
  // Tweet 1: punchy headline + URL
  const t1 = truncateForTweet(`${input.title}\n\n${url}`);
  // Tweet 2: dek (the supporting line)
  const t2 = truncateForTweet(input.dek);
  return [t1, t2];
}

function truncateForTweet(text: string): string {
  if (text.length <= MAX_TWEET_CHARS) return text;
  return text.slice(0, MAX_TWEET_CHARS - 1) + "…";
}

function parseThread(threadText: string, fallback: PostThreadInput): string[] {
  // One tweet per non-empty line. Lines longer than 280 chars get truncated.
  const lines = threadText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return defaultThread(fallback);
  return lines.map(truncateForTweet);
}

/**
 * Post an article as a Twitter thread. Each tweet replies to the previous one.
 * Returns the tweet IDs in order. The first tweet ID is the canonical "this article on Twitter" link.
 */
export async function postArticleThread(input: PostThreadInput): Promise<PostThreadResult> {
  const client = getClient();
  if (!client) {
    throw new Error(
      "Twitter not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET in Railway env vars.",
    );
  }
  const tweets = input.twitterThread ? parseThread(input.twitterThread, input) : defaultThread(input);

  const ids: string[] = [];
  let replyTo: string | undefined;
  for (const text of tweets) {
    const params: Parameters<typeof client.v2.tweet>[0] = { text };
    if (replyTo) {
      // Type intentionally loose — twitter-api-v2 SDK type union is wide.
      (params as { reply?: { in_reply_to_tweet_id: string } }).reply = {
        in_reply_to_tweet_id: replyTo,
      };
    }
    const res: TweetV2PostTweetResult = await client.v2.tweet(params);
    const id = res?.data?.id;
    if (!id) throw new Error("Twitter API returned no tweet id");
    ids.push(id);
    replyTo = id;
  }
  // Twitter URL pattern: https://x.com/i/status/<id>  (works without username)
  const firstTweetUrl = `https://x.com/i/status/${ids[0]}`;
  return { tweetIds: ids, firstTweetUrl };
}
