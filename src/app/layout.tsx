import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zalo Spam Tool",
  description: "Ứng dụng gửi tin nhắn hàng loạt qua Zalo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased" suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}
