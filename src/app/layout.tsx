import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { AuthProvider } from "@/lib/AuthContext";
import { ToastProvider } from "@/components/ToastContext";

export const metadata: Metadata = {
  title: "OptiCore - Network Management",
  description: "Sistema avanzado de gestión de fibra óptica",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('webyun-theme');
                  if (theme === 'dark' || theme === 'light') {
                    document.documentElement.dataset.theme = theme;
                    return;
                  }
                } catch(_) {}
                if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                  document.documentElement.dataset.theme = 'dark';
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
