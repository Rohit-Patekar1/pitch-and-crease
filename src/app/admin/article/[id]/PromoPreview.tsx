interface PromoPreviewProps {
  promoTweet: string | null;
  promoImage: { alt: string; base64: string } | null;
  fallbackTitle: string;
  fallbackDek: string;
  articleUrl: string;
}

const MAX_TWEET_CHARS = 280;

export function PromoPreview(props: PromoPreviewProps) {
  const { promoTweet, promoImage, fallbackTitle, fallbackDek, articleUrl } = props;
  let hook = (promoTweet ?? `${fallbackTitle}\n\n${fallbackDek}`).trim();
  let isAuto = !promoTweet;
  if (!hook.includes(articleUrl) && !/\bhttps?:\/\//.test(hook)) {
    hook = `${hook}\n\n${articleUrl}`;
  }
  const len = hook.length;
  const tooLong = len > MAX_TWEET_CHARS;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-accent">
          Promo tweet preview
        </h2>
        <span className={`text-[11px] font-mono ${tooLong ? "text-football font-bold" : "text-ink-dim"}`}>
          {len}/{MAX_TWEET_CHARS}
          {isAuto ? " · auto-generated fallback" : ""}
        </span>
      </div>
      <div className="border border-line bg-panel-2 rounded-lg p-4 space-y-3">
        {promoImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`data:image/png;base64,${promoImage.base64}`}
            alt={promoImage.alt}
            className="w-full max-h-72 rounded border border-line object-contain bg-bg"
          />
        )}
        <p className="text-sm whitespace-pre-wrap text-ink leading-relaxed">{hook}</p>
      </div>
      <p className="text-[11px] text-ink-dim mt-3">
        This is a single tweet — when posted, the article URL renders as a link card below
        the image and text. Cost: 1 X post = $0.01.
      </p>
    </div>
  );
}
