import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarFix | AI Car Damage Assessment",
  description: "Upload car damage photos and manage repair assessments with CarFix.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
