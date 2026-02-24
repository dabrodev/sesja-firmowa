import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "SesjaFirmowa.pl - profesjonalna sesja biznesowa i wizerunkowa AI",
  description: "Zmień swoje selfie w profesjonalną sesję firmową bez fotografa. Najlepsza sesja biznesowa i wizerunkowa dla firm, prawników i agentów nieruchomości napędzana przez AI.",
  keywords: ["sesja firmowa", "sesja biznesowa", "sesja wizerunkowa", "sesja AI", "zdjęcia biznesowe"],
};

import { AuthProvider } from "@/components/auth-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
