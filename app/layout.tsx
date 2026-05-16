import type { Metadata } from "next";
import { Provider } from "./provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pierre PRs",
  description: "A minimal GitHub pull request review UI powered by Pierre diffs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
