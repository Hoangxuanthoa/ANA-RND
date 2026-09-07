import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { RoleProvider } from "@/components/RoleProvider";
import { NotificationsProvider } from "@/components/NotificationsProvider";
import { ProjectsProvider } from "@/components/ProjectsProvider";
import { ProductsProvider } from "@/components/ProductsProvider";
import { SettingsProvider } from "@/components/SettingsProvider";
import { CollectionsProvider } from "@/components/CollectionsProvider";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Design Library — Artex Nam An",
  description: "Thư viện thiết kế nội bộ — quản lý sản phẩm 3D, dự án và phản hồi khách hàng.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} font-sans antialiased`}>
        <RoleProvider>
          <NotificationsProvider>
            <SettingsProvider>
              <ProjectsProvider>
                <ProductsProvider>
                  <CollectionsProvider>{children}</CollectionsProvider>
                </ProductsProvider>
              </ProjectsProvider>
            </SettingsProvider>
          </NotificationsProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
