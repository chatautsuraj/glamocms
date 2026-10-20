import type { MetadataRoute } from "next";

/** Installable counter app: tablets at the till can add GLAMO POS to the home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GLAMO POS",
    short_name: "GLAMO POS",
    description: "GLAMO Nepal point of sale",
    start_url: "/pos",
    display: "standalone",
    background_color: "#f8f4f4",
    theme_color: "#1a1512",
    icons: [
      { src: "/icons/pos-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/pos-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
