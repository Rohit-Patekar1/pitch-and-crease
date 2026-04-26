"use client";

export function PostSocialButton({ alreadyPosted }: { alreadyPosted: boolean }) {
  return (
    <button
      type="submit"
      className="text-xs bg-[#1d9bf0] text-white px-3 py-2 rounded-lg font-bold"
      onClick={(e) => {
        const msg = alreadyPosted
          ? "This post has already been tweeted. Post again?"
          : "Post to X now?";
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      {alreadyPosted ? "Re-post" : "Post to X"}
    </button>
  );
}
