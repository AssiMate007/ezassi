import { Link } from "@tanstack/react-router";
import { Clock, IndianRupee, MessageSquare, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface AssignmentCardData {
  id: string;
  title: string;
  subject: string;
  budget_min: number;
  budget_max: number;
  deadline: string;
  bid_count?: number;
  student?: { display_name: string; avatar_url: string | null } | null;
}

// Clean, premium subject config with subtle neutral indicators instead of distracting colored backgrounds
const subjectConfig: Record<string, { emoji: string }> = {
  Math:    { emoji: "📐" },
  Science: { emoji: "🔬" },
  English: { emoji: "📝" },
  History: { emoji: "📜" },
  Coding:  { emoji: "💻" },
  Art:     { emoji: "🎨" },
};

const DEFAULT_CONFIG = { emoji: "📚" };

// Humanized, elegant Monochromatic Initial Avatar (replaces the harsh random neon blobs)
function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div 
      className="flex shrink-0 items-center justify-center rounded-lg bg-zinc-100 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

export function AssignmentCard({ a }: { a: AssignmentCardData }) {
  const cfg = subjectConfig[a.subject] ?? DEFAULT_CONFIG;
  const deadline = new Date(a.deadline);
  const isUrgent = deadline.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const bidCount = a.bid_count ?? 0;

  return (
    <Link
      to="/assignment/$id"
      params={{ id: a.id }}
      className="group block rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-900 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
    >
      <div className="flex flex-col gap-4">
        {/* Meta / Badge Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <span className="text-sm leading-none">{cfg.emoji}</span>
              <span>{a.subject}</span>
            </span>

            {isUrgent && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-amber-700 border border-amber-100/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-none">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>URGENT</span>
              </span>
            )}
          </div>

          {/* Clean, high-contrast Budget display */}
          <div className="flex items-center text-zinc-900 dark:text-zinc-50">
            <IndianRupee className="h-3.5 w-3.5 opacity-80" />
            <span className="text-sm font-bold tracking-tight">
              {a.budget_min === a.budget_max ? a.budget_min : `${a.budget_min}–${a.budget_max}`}
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div>
          <h3 className="text-base font-semibold tracking-tight text-zinc-900 line-clamp-2 transition-colors group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
            {a.title}
          </h3>
        </div>

        {/* Card Footer Structural Layout */}
        <div className="flex items-center justify-between border-t border-zinc-50 pt-3.5 dark:border-zinc-800/50">
          {/* User Profile Info */}
          {a.student ? (
            <div className="flex items-center gap-2">
              <Avatar name={a.student.display_name} size={22} />
              <span className="max-w-[90px] truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {a.student.display_name.split(" ")[0]}
              </span>
            </div>
          ) : (
            <div className="text-xs text-zinc-400">Anonymous student</div>
          )}

          {/* Interactive Live Metrics */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1 text-xs ${isUrgent ? "font-medium text-amber-600 dark:text-amber-400" : "text-zinc-400 dark:text-zinc-500"}`}>
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDistanceToNow(deadline, { addSuffix: true })}</span>
            </div>

            {bidCount > 0 && (
              <div className="flex items-center gap-1 rounded-lg bg-zinc-50 border border-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                <MessageSquare className="h-3 w-3" />
                <span>{bidCount} {bidCount === 1 ? 'bid' : 'bids'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
