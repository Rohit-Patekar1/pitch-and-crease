"use client";

export function DeleteSocialButton() {
  return (
    <button
      type="submit"
      className="text-xs bg-football text-white px-3 py-2 rounded-lg font-bold"
      onClick={(e) => {
        if (!confirm("Delete this social post? This cannot be undone.")) e.preventDefault();
      }}
    >
      Delete
    </button>
  );
}
