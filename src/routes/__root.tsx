import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { name: "theme-color", content: "#9333ea" },
      { title: "AssiMate — Assignment help on your budget" },
      { name: "description", content: "AssiMate is the friendly assignment marketplace. Post your work, get bids from trusted writers, chat, and pick your mate." },
      { property: "og:title", content: "AssiMate — Assignment help on your budget" },
      { name: "twitter:title", content: "AssiMate — Assignment help on your budget" },
      { property: "og:description", content: "AssiMate is the friendly assignment marketplace. Post your work, get bids from trusted writers, chat, and pick your mate." },
      { name: "twitter:description", content: "AssiMate is the friendly assignment marketplace. Post your work, get bids from trusted writers, chat, and pick your mate." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/bc38c8c4-dcf1-4720-a9b3-0edf9b825693" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/bc38c8c4-dcf1-4720-a9b3-0edf9b825693" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
