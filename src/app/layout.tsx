import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { AuthProvider } from "@/lib/AuthContext";
import { ToastProvider } from "@/components/ToastContext";

/**
 * Metadatos globales de la aplicación Next.js.
 */
export const metadata: Metadata = {
  title: "OptiCore - Network Management",
  description: "Sistema avanzado de gestión de fibra óptica",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

/**
 * Componente `RootLayout`.
 *
 * Diseño raíz (Root Layout) que envuelve todas las páginas de la aplicación WebYun.
 * Inyecta el script inline anti-flicker de preferencia de tema (`dark`/`light`),
 * e integra los proveedores de contexto globales `AuthProvider` y `ToastProvider`.
 */
export default function RootLayout({
  children,
}: {
  /** Nodos hijos a renderizar dentro de la plantilla */
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Script de inicialización de tema anti-parpadeo (FOUC) */}
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

