import { Hanken_Grotesk, Space_Mono } from "next/font/google";

import "./design.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

export const metadata = {
  title: "Lingua",
  description: "Personal fluency practice: Yoruba & Mandarin",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${hanken.variable} ${spaceMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
