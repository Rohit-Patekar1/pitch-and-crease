interface ThreadPreviewProps {
  thread: string | null;
  tweetImages: Array<{ slot: number; alt: string; base64: string }> | null;
  fallbackTitle: string;
  fallbackDek: string;
  articleUrl: string;
}

const MAX_TWEET_CHARS = 280;

function parseLines(thread: string | null): string[] {
  if (!thread) return [];
  return thread
    .split(/\r?\n\r?\n|\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function ThreadPreview(props: ThreadPreviewProps) {
  const { thread, tweetImages, fallbackTitle, fallbackDek, articleUrl } = props;
  let tweets = parseLines(thread);
  let isAuto = false;
  if (tweets.length === 0) {
    tweets = [
      `${fallbackTitle}\n\n${fallbackDek}\n\n🧵👇`,
      `Read the full breakdown 👉 ${articleUrl}`,
    ];
    isAuto = true;
  }
  // Append URL to the last tweet if not already present anywhere
  const hasUrl = tweets.some((t) => t.includes(articleUrl) || /\bhttps?:\/\//.test(t));
  if (!hasUrl && !isAuto) {
    const last = tweets[tweets.length - 1];
    const withUrl = `${last}\n\n${articleUrl}`;
    if (withUrl.length <= MAX_TWEET_CHARS) tweets[tweets.length - 1] = withUrl;
    else tweets.push(`Full breakdown 👉 ${articleUrl}`);
  }

  const imagesBySlot = new Map<number, Array<{ alt: string; base64: string }>>();
  if (tweetImages) {
    for (const img of tweetImages) {
      const a = imagesBySlot.get(img.slot) ?? [];
      a.push(img);
      imagesBySlot.set(img.slot, a);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-accent">
          Thread preview
        </h2>
        <span className="text-[11px] text-ink-dim">
          {tweets.length} tweet{tweets.length === 1 ? "" : "s"}
          {tweetImages && tweetImages.length > 0 ? ` · ${tweetImages.length} image${tweetImages.length === 1 ? "" : "s"}` : ""}
          {isAuto ? " · auto-generated fallback" : ""}
        </span>
      </div>
      <ol className="space-y-3">
        {tweets.map((text, i) => {
          const imgs = imagesBySlot.get(i) ?? [];
          const len = text.length;
          const tooLong = len > MAX_TWEET_CHARS;
          return (
            <li key={i} className="border border-line bg-panel-2 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2 text-[11px] text-ink-dim font-mono">
                <span>tweet {i + 1}</span>
                <span className={tooLong ? "text-football font-bold" : ""}>
                  {len}/{MAX_TWEET_CHARS}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap text-ink leading-relaxed">{text}</p>
              {imgs.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {imgs.map((img, j) => (
                    <figure key={j} className="border border-line rounded overflow-hidden bg-bg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/png;base64,${img.base64}`}
                        alt={img.alt}
                        className="w-full h-auto block"
                      />
                      <figcaption className="text-[10px] text-ink-dim p-1 truncate">
                        {img.alt}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
