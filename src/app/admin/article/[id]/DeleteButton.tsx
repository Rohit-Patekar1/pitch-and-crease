"use client";

export function DeleteButton() {
  return (
    <button
      type="submit"
      className="text-xs bg-football text-white px-3 py-2 rounded-lg font-bold"
      onClick={(e) => {
        if (!confirm("Delete this article? This cannot be undone.")) e.preventDefault();
      }}
    >
      Delete
    </button>
  );
}
