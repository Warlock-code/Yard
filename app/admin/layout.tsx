import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  manifest: "/admin-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "yard admin",
  },
}

export const viewport: Viewport = {
  themeColor: "#050505",
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}