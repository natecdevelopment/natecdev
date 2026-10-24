import { createFileRoute } from "@tanstack/react-router";
import { BUILD_TIME, STATIC_PAGES, urlsetXml, xmlResponse } from "@/lib/sitemap";

export const Route = createFileRoute("/page-sitemap.xml")({
  server: {
    handlers: {
      GET: async () =>
        xmlResponse(urlsetXml(STATIC_PAGES.map((p) => ({
          loc: p.path,
          lastmod: p.lastmod ?? BUILD_TIME,
          images: p.path === "/" ? [{ loc: "/hero-natec/d/0042.webp", title: "Shobuj Digonto by Natec Development, Rajendrapur, Sreepur, Gazipur" }] : [],
        })))),
    },
  },
});
