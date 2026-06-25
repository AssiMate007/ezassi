import { Link } from "@tanstack/react-router";
import { Clock, IndianRupee, MessageSquare, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { UserProfileModal } from "@/components/UserProfileModal";

export interface AssignmentCardData {
  id: string; title: string; subject: string;
  budget_min: number; budget_max: number;
  deadline: string; bid_count?: number;
  student?: { id: string; display_name: string; avatar_url: string | null } | null;
}

const subjectConfig: Record<string, { bg: string; text: string; emoji: string }> = {
  Math:    { bg: "bg-blue-50/80 border-blue-100/60 dark:bg-blue-950/40 dark:border-blue-900/40",     text: "text-blue-600 dark:text-blue-400",    emoji: "📐" },
  Science: { bg: "bg-emerald-50/80 border-emerald-100/60 dark:bg-emerald-950/40 dark:border-emerald-900/40", text: "text-emerald-600 dark:text-emerald-400", emoji: "🔬" },
  English: { bg: "bg-pink-50/80 border-pink-100/60 dark:bg-pink-950/40 dark:border-pink-900/40",     text: "text-pink-600 dark:text-pink-400",    emoji: "📝" },
  History: { bg: "bg-amber-50/80 border-amber-100/60 dark:bg-amber-950/40 dark:border-amber-900/40",   text: "text-amber-600 dark:text-amber-400",   emoji: "📜" },
  Coding:  { bg: "bg-indigo-50/80 border-indigo-100/60 dark:bg-indigo-950/40 dark:border-indigo-900/40", text: "text-indigo-600 dark:text-indigo-400",  emoji: "💻" },
  Art:     { bg: "bg-rose-50/80 border-rose-100/60 dark:bg-rose-950/40 dark:border-rose-900/40",     text: "text-rose-600 dark:text-rose-400",    emoji: "🎨" },
};
const DEFAULT = { bg: "bg-purple-50/80 border-purple-100/60 dark:bg-purple-950/40 dark:border-purple-900/40", text: "text-purple-600 dark:text-purple-400", emoji: "📚" };

function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["bg-violet-500","bg-fuchsia-500","bg-pink-500","bg-indigo-500","bg-cyan-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${color} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

export function AssignmentCard({ a }: { a: AssignmentCardData }) {
  const cfg = subjectConfig[a.subject] ?? DEFAULT;
  const deadline = new Date(a.deadline);
  const isUrgent = deadline.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const bidCount = a.bid_count ?? 0;
  const [showProfile, setShowProfile] = useState(false);

  return (
    <>
      <Link to="/assignment/$id" params={{ id: a.id }}
        className="group block rounded-2xl bg-card border border-border shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text}`}>
                <span>{cfg.emoji}</span>{a.subject}
              </span>
              {isUrgent && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40">
                  <Zap className="h-2.5 w-2.5" />URGENT
                </span>
              )}
            </div>
          </div>
          <h3 className="font-semibold text-foreground line-clamp-2 leading-snug text-[15px] mb-3 group-hover:text-primary transition-colors">
            {a.title}
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5 font-bold text-foreground">
              <IndianRupee className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm">{a.budget_min}–{a.budget_max}</span>
            </div>
            <div className="flex items-center gap-3">
              {a.student && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowProfile(true);
                  }}
                  className="flex items-center gap-1.5 hover:opacity-80 transition focus:outline-none"
                  title="View Student Profile"
                >
                  <Avatar name={a.student.display_name} size={20} />
                  <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
                    {a.student.display_name.split(" ")[0]}
                  </span>
                </button>
              )}
              <div className={`flex items-center gap-1 text-xs ${isUrgent ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(deadline, { addSuffix: true })}
              </div>
              {bidCount > 0 && (
                <div className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/8 px-2 py-0.5 rounded-full">
                  <MessageSquare className="h-3 w-3" />{bidCount}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
      {a.student && (
        <UserProfileModal
          isOpen={showProfile}
          onClose={() => setShowProfile(false)}
          userId={a.student.id}
        />
      )}
    </>
  );
}
