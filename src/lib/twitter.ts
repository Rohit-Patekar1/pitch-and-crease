/**
 * Twitter / X posting client.
 *
 * Two posting modes:
 *  - postArticlePromo()   single tweet promoting an article (hook + image + URL)
 *  - postSocialPost()     1-3 tweet native social post (no website article behind it)
 *
 * Uses OAuth 1.0a with four env vars: TWITTER_API_KEY, TWITTER_API_SECRET,
 * TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET.
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
  return new TwitterApi({ appKey: k, appSecret: ks, accessToken: t, accessSecret: ts });
}

export function isTwitterConfigured(): boolean {
  return getClient() !== null;
}

export interface SingleImage {
  alt: string;
  base64: string;
}

export interface SlottedImage {
  slot: number;
  alt: string;
  base64: string;
}

export interface PostResult {
  tweetIds: string[];
  firstTweetUrl: string;
}

function truncate(text: string): string {
  if (text.length <= MAX_TWEET_CHARS) return text;
  return text.slice(0, MAX_TWEET_CHARS - 1) + "…";
}

async function uploadImage(client: TwitterApi, img: SingleImage): Promise<string | null> {
  try {
    const buf = Buffer.from(img.base64, "base64");
    const id = await client.v1.uploadMedia(buf, { mimeType: "image/png" });
    if (img.alt) {
      try {
        await client.v1.createMediaMetadata(id, { alt_text: { text: img.alt } });
      } catch {
        /* alt-text best-effort */
      }
    }
    return id;
  } catch (err) {
    console.warn("[twitter] media upload failed:", err);
    return null;
  }
}

/**
 * Post a single tweet promoting an article. Tweet text gets the article URL
 * appended on a new line if it's not already there. The image (if any) is
 * attached as media so it shows full-width above the link.
 */
export async function postArticlePromo(input: {
  sport: "FOOTBALL" | "CRICKET";
  slug: string;
  title: string;
  dek: string;
  promoTweet?: string | null;
  promoImage?: SingleImage | null;
}): Promise<PostResult> {
  const client = getClient();
  if (!client) {
    throw new Error(
      "Twitter not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET in Railway env vars.",
    );
  }
  const path = input.sport === "FOOTBALL" ? "football" : "cricket";
  const url = `${SITE_URL}/${path}/${input.slug}`;
  const hook = (input.promoTweet ?? `${input.title}\n\n${input.dek}`).trim();

  // Append URL on new line unless already present
  const text = hook.includes(url) || /\bhttps?:\/\//.test(hook)
    ? truncate(hook)
    : truncate(`${hook}\n\n${url}`);

  const params: Parameters<typeof client.v2.tweet>[0] = { text };
  if (input.promoImage) {
    const id = await uploadImage(client, input.promoImage);
    if (id) {
      (params as { media?: { media_ids: [string] } }).media = { media_ids: [id] };
    }
  }
  const res: TweetV2PostTweetResult = await client.v2.tweet(params);
  const tid = res?.data?.id;
  if (!tid) throw new Error("Twitter API returned no tweet id");
  return { tweetIds: [tid], firstTweetUrl: `https://x.com/i/status/${tid}` };
}

/**
 * Post a 1-3 tweet native social post. Tweets are separated by blank lines in
 * tweetText. Optional images map to slots (0 = first tweet, etc.).
 */
export async function postSocialPost(input: {
  tweetText: string;
  tweetImages?: SlottedImage[] | null;
}): Promise<PostResult> {
  const client = getClient();
  if (!client) {
    throw new Error("Twitter not configured.");
  }
  const tweets = input.tweetText
    .split(/\r?\n\s*\r?\n+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map(truncate);

  if (tweets.length === 0) throw new Error("tweetText is empty");
  if (tweets.length > 5) throw new Error("Social posts max 5 tweets");

  const imagesBySlot = new Map<number, SlottedImage[]>();
  for (const img of input.tweetImages ?? []) {
    const arr = imagesBySlot.get(img.slot) ?? [];
    arr.push(img);
    imagesBySlot.set(img.slot, arr);
  }

  const ids: string[] = [];
  let replyTo: string | undefined;

  for (let i = 0; i < tweets.length; i++) {
    const text = tweets[i];
    const slotImgs = imagesBySlot.get(i) ?? [];
    const mediaIds: string[] = [];
    for (const img of slotImgs.slice(0, 4)) {
      const id = await uploadImage(client, img);
      if (id) mediaIds.push(id);
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
    const tid = res?.data?.id;
    if (!tid) throw new Error("Twitter API returned no tweet id");
    ids.push(tid);
    replyTo = tid;
  }
  return { tweetIds: ids, firstTweetUrl: `https://x.com/i/status/${ids[0]}` };
}
