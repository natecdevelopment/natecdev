import { UnderConstruction } from "@/components/UnderConstruction";
import { SITE_URL } from "@/lib/site";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, Phone, Mail, Clock, Navigation, Route as RouteIcon, School, GraduationCap, Hospital, Landmark, Store, Trees, PawPrint, Shield, ShoppingBag, Leaf, TrendingUp, Car } from "lucide-react";
import { PageHero, Reveal, WhatsAppIcon } from "@/components/SiteChrome";
import { mapEmbed, waMessage } from "@/components/ProjectsGrid";
import { publicProjectsQuery } from "@/lib/projects-data";
import { company } from "@/lib/site";

const SITE = SITE_URL;
const TITLE = "Location — Rajendrapur Bazar, Sreepur, Gazipur | Natec Development";
const DESC = "Natec Development's office and projects at Rajendrapur Bazar, Sreepur, Gazipur — near the Dhaka–Mymensingh Highway. Map, directions and nearby places.";
const OFFICE_Q = "Vai Vai Market, Rajendrapur Bazar, Sreepur, Gazipur";
const DIRECTIONS = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(OFFICE_Q)}`;
const WA_VISIT = waMessage("Hi Natec, I'd like to book a site visit at Rajendrapur Bazar.");

export const Route = createFileRoute("/location")({
  loader: ({ context }) => context.queryClient.ensureQueryData(publicProjectsQuery),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/location` },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: `${SITE}/hero-natec/d/0018.webp` },
      { name: "twitter:image", content: `${SITE}/hero-natec/d/0018.webp` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/location` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: company.name,
          url: SITE,
          telephone: "+8801354252400",
          email: company.email,
          address: { "@type": "PostalAddress", streetAddress: "1st Floor, Vai Vai Market, opposite Walton showroom, Dhaka–Kapasia Road, Rajendrapur Bazar", addressLocality: "Sreepur", addressRegion: "Gazipur", postalCode: "1741", addressCountry: "BD" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org", "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
            { "@type": "ListItem", position: 2, name: "Location", item: `${SITE}/location` },
          ],
        }),
      },
    ],
  }),
  component: () => <UnderConstruction title="Location" real={LocationPage} />,
  errorComponent: () => <p className="p-10 pt-32 text-center">This page could not be loaded. Please refresh.</p>,
  notFoundComponent: () => <p className="p-10 pt-32 text-center">Not found.</p>,
});

/** Directions and nearby places. Distances are approximate road figures (Dhaka–Rajendrapur ≈ 36 km on the N3). */
const ROUTES = [
  {
    from: "From Dhaka",
    via: "Via the Dhaka–Mymensingh Highway",
    note: "Head north through Tongi and Gazipur Chowrasta to Rajendrapur Chowrasta, about 36 km from Dhaka, then follow the Kapasia road to Rajendrapur Bazar. Allow 1½–2½ hours depending on traffic.",
  },
  {
    from: "From Gazipur Chowrasta",
    via: "Towards Rajendrapur",
    note: "Stay on the highway north to Rajendrapur Chowrasta and turn towards Kapasia for the bazar. Buses heading to Sreepur, Mawna and Mymensingh pass Rajendrapur Chowrasta.",
  },
  {
    from: "By train",
    via: "Rajendrapur railway station",
    note: "Trains on the Dhaka–Mymensingh line stop at Rajendrapur station, north of Joydebpur. From the station, a CNG or rickshaw brings you to Rajendrapur Bazar.",
  },
];
const NEARBY = [
  { icon: Store, name: "Rajendrapur Bazar", note: "Our office, plus daily shops and bank branches" },
  { icon: RouteIcon, name: "Dhaka–Mymensingh Highway", note: "Joined at Rajendrapur Chowrasta" },
  { icon: School, name: "Schools", note: "Local primary and secondary schools around the bazar" },
  { icon: GraduationCap, name: "Colleges", note: "Including Rajendrapur Cantonment Public School & College" },
  { icon: Hospital, name: "Hospital / clinic", note: "Local clinics nearby; larger hospitals in Gazipur city" },
  { icon: Landmark, name: "Mosques", note: "Mosques throughout the neighbourhood" },
  { icon: ShoppingBag, name: "Markets", note: "Fresh produce and groceries at Rajendrapur Bazar" },
  { icon: PawPrint, name: "Gazipur Safari Park", note: "Wildlife park off the highway, north of Rajendrapur" },
  { icon: Trees, name: "Bhawal National Park", note: "Sal forest park on the highway at Rajendrapur" },
  { icon: Shield, name: "Rajendrapur Cantonment", note: "Home to CMH Rajendrapur and the cantonment school" },
];
const WHY = [
  { icon: Leaf, title: "Green surroundings", body: "Rajendrapur and Sreepur sit among the forests of the Bhawal area, with trees and open land around them." },
  { icon: TrendingUp, title: "A growing town", body: "Rajendrapur Bazar is an active local market town with daily shops and services close by." },
  { icon: Car, title: "Road access to Dhaka", body: "The Dhaka–Mymensingh Highway connects the area to Gazipur and Dhaka by road." },
];

function LocationPage() {
  const { data } = useSuspenseQuery(publicProjectsQuery);
  const places = [{ id: "office", name: "Natec office", sub: "Vai Vai Market, Rajendrapur Bazar", q: OFFICE_Q }, ...data.map((p) => ({ id: p.id, name: p.name, sub: p.location_short || p.address, q: p.map_url || p.address }))];
  const [sel, setSel] = useState("office");
  const active = places.find((p) => p.id === sel) ?? places[0]!;

  return (
    <>
      <PageHero
        image="/hero-natec/d/0018.webp"
        imageAlt="Morning drone view over green Rajendrapur, Sreepur, Gazipur"
        imagePosition="center 55%"
        crumbs={[{ label: "Home", to: "/" }, { label: "Location" }]}
        eyebrow="Location"
        title={<>Close to Dhaka, surrounded by <em className="accent-dark">green</em></>}
        intro="Our projects and office are at Rajendrapur Bazar, Sreepur, Gazipur."
      >
        <a href={DIRECTIONS} target="_blank" rel="noreferrer" className="btn btn-primary"><Navigation className="h-4 w-4" /> Get directions</a>
        <a href={WA_VISIT} target="_blank" rel="noreferrer" className="btn btn-ghost-dark">Book a site visit</a>
      </PageHero>

      {/* Map + places */}
      <section className="section-pad bg-ivory">
        <div className="container-x">
          <Reveal><h2 className="text-primary">Find us on the map</h2></Reveal>
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Reveal className="min-w-0">
              <iframe key={active.id} title={`Map: ${active.name}`} src={mapEmbed(active.q)} className="h-[420px] w-full rounded-2xl border-0 shadow-lg md:h-[560px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              <p className="mt-3 text-sm text-muted-foreground">Showing: <span className="font-semibold text-navy">{active.name}</span></p>
            </Reveal>
            <Reveal delay={120}>
              <h3 className="!text-xl text-navy">Places</h3>
              <ul className="mt-4 space-y-2">
                {places.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => setSel(p.id)} aria-pressed={p.id === sel}
                      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${p.id === sel ? "border-navy bg-navy text-white" : "border-border bg-white text-navy hover:border-navy"}`}>
                      <MapPin className={`mt-0.5 h-5 w-5 shrink-0 ${p.id === sel ? "text-white" : "text-brand-red"}`} />
                      <span><span className="block font-semibold">{p.name}</span><span className={`block text-sm ${p.id === sel ? "text-white/75" : "text-muted-foreground"}`}>{p.sub}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Office card */}
      <section className="section-pad bg-white">
        <div className="container-x grid gap-10 md:grid-cols-2 md:items-center">
          <Reveal>
            <p className="eyebrow text-brand-red">Our office</p>
            <h2 className="mt-2 text-primary">Visit us at Rajendrapur Bazar</h2>
            <p className="mt-4 text-muted-foreground">Meet our team, see the plans and arrange a visit to the sites.</p>
          </Reveal>
          <Reveal delay={120} className="rounded-2xl border border-border bg-ivory p-7 md:p-9">
            <ul className="space-y-4 text-navy">
              <li className="flex gap-3"><MapPin className="mt-1 h-5 w-5 shrink-0 text-brand-red" /><span>{company.address}</span></li>
              <li className="flex gap-3"><Phone className="mt-1 h-5 w-5 shrink-0 text-brand-red" /><a href={company.phoneLink} className="hover:underline">{company.phone}</a></li>
              <li className="flex gap-3"><span className="mt-1 shrink-0 text-brand-red"><WhatsAppIcon /></span><a href={company.whatsappLink} target="_blank" rel="noreferrer" className="hover:underline">{company.whatsapp}</a></li>
              <li className="flex gap-3"><Mail className="mt-1 h-5 w-5 shrink-0 text-brand-red" /><a href={`mailto:${company.email}`} className="break-all hover:underline">{company.email}</a></li>
              <li className="flex gap-3"><Clock className="mt-1 h-5 w-5 shrink-0 text-brand-red" /><span>Please call or WhatsApp before you visit so the right person can meet you.</span></li>
            </ul>
            <a href={DIRECTIONS} target="_blank" rel="noreferrer" className="btn btn-primary mt-7"><Navigation className="h-4 w-4" /> Get directions</a>
          </Reveal>
        </div>
      </section>

      {/* Getting here */}
      <section className="section-pad bg-ivory">
        <div className="container-x">
          <Reveal><h2 className="text-primary">Getting here</h2></Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {ROUTES.map((r, i) => (
              <Reveal key={r.from} delay={i * 100} className="rounded-2xl border border-border bg-white p-7">
                <RouteIcon className="h-7 w-7 text-brand-red" aria-hidden />
                <h3 className="mt-4 !text-xl text-navy">{r.from}</h3>
                <p className="eyebrow mt-1 !text-[11px] text-muted-foreground">{r.via}</p>
                <p className="mt-4 text-muted-foreground">{r.note}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Nearby */}
      <section className="section-pad bg-white">
        <div className="container-x">
          <Reveal><h2 className="text-primary">Nearby</h2></Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {NEARBY.map((n, i) => (
              <Reveal key={n.name} delay={(i % 5) * 70} className="rounded-2xl border border-border bg-ivory p-5">
                <n.icon className="h-6 w-6 text-brand-red" aria-hidden />
                <p className="mt-3 font-semibold text-navy">{n.name}</p>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">{n.note}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Why this area */}
      <section className="section-pad bg-navy text-white">
        <div className="container-x">
          <Reveal><h2>Why this area</h2></Reveal>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {WHY.map((w, i) => (
              <Reveal key={w.title} delay={i * 100} className="border-l-2 border-brand-red pl-5">
                <w.icon className="h-6 w-6 text-white/80" aria-hidden />
                <h3 className="mt-3 !text-xl">{w.title}</h3>
                <p className="mt-2 text-muted-dark">{w.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-pad bg-ivory">
        <Reveal className="container-x flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-primary">Visit the site</h2>
            <p className="mt-3 text-muted-foreground">See the buildings and the neighbourhood for yourself.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={WA_VISIT} target="_blank" rel="noreferrer" className="btn btn-primary"><WhatsAppIcon /> WhatsApp</a>
            <a href={company.phoneLink} className="btn border border-navy text-navy"><Phone className="h-4 w-4" /> Call {company.phone}</a>
          </div>
        </Reveal>
      </section>
    </>
  );
}
