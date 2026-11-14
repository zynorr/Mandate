import type { SessionUser } from "@/lib/auth";

export function UserBadge({
  user,
  compact = false,
}: {
  user: SessionUser;
  compact?: boolean;
}) {
  const displayName = user.name ?? user.login;
  const initial = displayName.slice(0, 1).toUpperCase();
  return (
    <div className={`user-badge ${compact ? "user-badge-compact" : ""}`}>
      <span className="user-avatar" aria-hidden="true">
        {initial}
      </span>
      <span className="user-identity">
        <strong>{displayName}</strong>
        <small>
          {user.mode === "local" ? "Local workspace" : `@${user.login}`}
        </small>
      </span>
      {user.mode === "local" ? (
        <span className="user-mode">Single operator</span>
      ) : (
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="user-signout">
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}
