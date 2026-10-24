import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";
import { publicProjectsQuery, publicVideosQuery } from "@/lib/projects-data";
import { CinematicHero } from "@/components/CinematicHero";
import { Intro, ProjectsShowcase, VideosSection, FloorPlan, WhyNatec, HowWeBuild, BuyingSteps, Location, Board, Faq, FAQS, ContactCTA } from "@/components/HomeSections";
import { company } from "@/lib/site";

const SITE = SITE_URL;
const TITLE = "Natec Development Ltd. | Apartments & Flats in Rajendrapur, Sreepur, Gazipur";
const DESC = "Real estate developer in Rajendrapur, Sreepur, Gazipur. 75 homes built and sold. Register for upcoming apartment projects in Gazipur.";
const OG_IMAGE = `${SITE}/hero-natec/d/0042.webp`;

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": ["Organization", "RealEstateAgent"],
    "@id": `${SITE}/#organization`,
    name: company.name,
    url: SITE,
    logo: `${SITE}/brand/natec-logo-transparent.png`,
    image: OG_IMAGE,
    foundingDate: "2023",
    telephone: "+8801354252400",
    email: company.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: "1st Floor, Vai Vai Market, opposite Walton showroom, Dhaka–Kapasia Road, Rajendrapur Bazar",
      addressLocality: "Sreepur",
      addressRegion: "Gazipur",
      postalCode: "1741",
      addressCountry: "BD",
    },
    areaServed: { "@type": "AdministrativeArea", name: "Rajendrapur, Sreepur, Gazipur" },
    sameAs: [company.facebook],
  },
  { "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE}/#website`, name: company.name, url: SITE, inLanguage: "en", publisher: { "@id": `${SITE}/#organization` } },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/` },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1920" },
      { property: "og:image:height", content: "1080" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE}/` }],
    scripts: jsonLd.map((j) => ({ type: "application/ld+json", children: JSON.stringify(j) })),
  }),
  loader: async ({ context }) => {
    await Promise.all([context.queryClient.ensureQueryData(publicProjectsQuery), context.queryClient.ensureQueryData(publicVideosQuery)]);
  },
  component: Index,
  errorComponent: () => <p className="p-10 text-center">Something went wrong loading this page. Please refresh.</p>,
  notFoundComponent: () => <p className="p-10 text-center">Not found.</p>,
});

function Index() {
  return (
    <>
      <CinematicHero />
      <Intro />
      <ProjectsShowcase />
      <VideosSection />
      <WhyNatec />
      <HowWeBuild />
      <BuyingSteps />
      <FloorPlan />
      <Location />
      <Board />
      <Faq />
      <ContactCTA />
    </>
  );
}
