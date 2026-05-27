import { Link } from "@tanstack/react-router";
import { Clock, IndianRupee, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const subjectColors: Record<string, string> = {
  Math: "bg-blue-100 text-blue-700",
  Science: "bg-green-100 text-green-700",
  English: "bg-pink-100 text-pink-700",
  History: "bg-amber-100 text-amber-700",
  Coding: "bg-indigo-100 text-indigo-700",
  Art: "bg-rose-100 text-rose-700",
};

export function AssignmentCard({ a }: { a: AssignmentCardData }) {
  const tone = subjectColors[a.subject] ?? "bg-purple-100 text-purple-700";
  const deadline = new Date(a.deadline);
  return (
    <Link
      to="/assignment/$id"
      params={{ id: a.id }}
      className="block rounded-2xl bg-card p-4 shadow-card hover:shadow-soft transition-all hover:-translate-y-0.5 border border-border"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tone}`}>
              {a.subject}
            </span>
            {a.student && (
              <span className="text-xs text-muted-foreground truncate">by {a.student.display_name}</span>
            )}
          </div>
          <h3 className="font-semibold text-foreground line-clamp-2 leading-snug">{a.title}</h3>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-1 font-bold text-foreground">
          <IndianRupee className="h-4 w-4" />
          {a.budget_min}–{a.budget_max}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDistanceToNow(deadline, { addSuffix: true })}
          </span>
          {typeof a.bid_count === "number" && (
            <Badge variant="secondary" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              {a.bid_count}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
