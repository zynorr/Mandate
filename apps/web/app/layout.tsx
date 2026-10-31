import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/manrope";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mandate — Agent authorization evidence for BOT Chain",
    template: "%s · Mandate",
  },
  description:
    "Mandate compares approved agent intents with BOT Chain evidence, then keeps the result in a reviewable ledger.",
  applicationName: "Mandate",
  keywords: [
    "BOT Chain",
    "agent authorization",
    "ERC-4337",
    "smart account",
    "evidence ledger",
  ],
};

export const viewport: Viewport = {
  themeColor: "#f7f3eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
