"use client";

export function TweetButton({ alreadyTweeted }: { alreadyTweeted: boolean }) {
  return (
    <button
      type="submit"
      className="text-xs bg-[#1d9bf0] text-white px-3 py-2 rounded-lg font-bold disabled:opacity-50"
      onClick={(e) => {
        const msg = alreadyTweeted
          ? "This article has already been tweeted. Post again as a fresh thread?"
          : "Post this article to Twitter now?";
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      {alreadyTweeted ? "Re-tweet" : "Post to X"}
    </button>
  );
}
