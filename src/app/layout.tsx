import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DoD Market Analysis Dashboard | Go-to-Market Solutions",
  description: "Comprehensive Department of Defense contract spending analysis powered by USASpending.gov",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
