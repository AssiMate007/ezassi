import { Outlet, createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      <main className="w-full max-w-md mx-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
