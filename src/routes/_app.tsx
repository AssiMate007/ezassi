import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { Compass, MessageSquare, User } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="min-h-[100dvh] bg-zinc-50/60 pb-16 dark:bg-zinc-950">
      
      {/* Main Content Viewport */}
      <main className="w-full">
        <Outlet />
      </main>

      {/* Global Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-100 bg-white/90 backdrop-blur-md px-6 py-2 dark:border-zinc-900 dark:bg-zinc-950/90" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
        <nav className="mx-auto flex max-w-md justify-between items-center">
          
          {/* Explore / Dashboard Tab */}
          <Link 
            to="/dashboard" 
            className="flex flex-col items-center gap-1 text-zinc-400 transition-colors hover:text-zinc-600 [&.active]:text-zinc-900 dark:hover:text-zinc-300 dark:[&.active]:text-zinc-50"
          >
            <Compass className="h-5 w-5" />
            <span className="text-[10px] font-bold tracking-wide">Explore</span>
          </Link>

          {/* Chats List Tab - Fixed to align with the singular route structure */}
          <Link 
            to="/chat" 
            className="flex flex-col items-center gap-1 text-zinc-400 transition-colors hover:text-zinc-600 [&.active]:text-zinc-900 dark:hover:text-zinc-300 dark:[&.active]:text-zinc-50"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px] font-bold tracking-wide">Chats</span>
          </Link>

          {/* Profile Tab - Fixed path alignment */}
          <Link 
            to="/profile" 
            className="flex flex-col items-center gap-1 text-zinc-400 transition-colors hover:text-zinc-600 [&.active]:text-zinc-900 dark:hover:text-zinc-300 dark:[&.active]:text-zinc-50"
          >
            <User className="h-5 w-5" />
            <span className="text-[10px] font-bold tracking-wide">Profile</span>
          </Link>

        </nav>
      </div>

    </div>
  );
}
