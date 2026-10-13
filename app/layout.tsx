import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app-name";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} · Ideas to designs`,
  description: "Plan campaigns, write the content once, and produce on-brand emails and print-ready posters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("brand-engine-theme");if(!t){t=JSON.parse(localStorage.getItem("brand-engine-app2-v1")).state.theme}document.documentElement.className=t==="light"?"light":"dark"}catch(e){}`,
          }}
        />
      </head>
      <body className="bg-slate-950 font-sans text-slate-200 antialiased">{children}</body>
    </html>
  );
}
