import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Repositorio de Proyectos de Grado · UDABOL",
    short_name: "Proyectos UDABOL",
    description: "Consulta de proyectos y tesis de grado de la Universidad de Aquino Bolivia.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8f8",
    theme_color: "#1a3838",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
