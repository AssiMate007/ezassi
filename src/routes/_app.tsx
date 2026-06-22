import { Outlet, createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/use-auth";
import { useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Don't show the notification bell on chat pages or if not logged in
  const showBell = !!user && !path.includes("/chat/");

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      {/* Global notification bell — top right corner */}
      {showBell && (
        <div className="fixed top-3 right-3 z-30">
          <NotificationBell />
        </div>
      )}
      <main className="w-full max-w-md mx-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
