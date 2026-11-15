import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeToggle from "./components/theme-toggle";
import OceanBackground from "./components/ocean-background";
import { SessionProvider } from "./components/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Academic Compass",
  description:
    "Find UC San Diego research, internships, programs and events in one place — with every requirement quoted from its source.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t;try{t=localStorage.getItem("academic-compass-theme")}catch{}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t})()` }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeToggle />
        <OceanBackground />
        <SessionProvider>
          <div className="compass-content">{children}</div>
        </SessionProvider>
      </body>
    </html>
  );
}