import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rajagiri Election System",
  description: "Offline localhost election kiosk and admin panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className="font-sans">{children}</body>
    </html>
  );
}
