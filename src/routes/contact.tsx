import { UnderConstruction } from "@/components/UnderConstruction";
import { SITE_URL } from "@/lib/site";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Mail, Clock, Navigation, PhoneCall, CalendarCheck, FileText } from "lucide-react";
import { PageHero, Reveal, WhatsAppIcon } from "@/components/SiteChrome";
import { InquiryForm } from "@/components/InquiryForm";
import { FAQS } from "@/components/HomeSections";
import { mapEmbed } from "@/components/ProjectsGrid";
import { company } from "@/lib/site";

const SITE = SITE_URL;
const TITLE = "Contact Natec Development Ltd. | Rajendrapur, Sreepur, Gazipur";
const DESC = "Call, WhatsApp or visit Natec Development at Rajendrapur Bazar, Sreepur, Gazipur. Send an inquiry about our projects or book a site visit.";
const OFFICE_Q = "Vai Vai Market, Rajendrapur Bazar, Sreepur, Gazipur";
const DIRECTIONS = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(OFFICE_Q)}`;
const WA = `${company.whatsappLink}?text=${encodeURIComponent("Hi Natec, I'd like to know more about your projects.")}`;
const CONTACT_FAQS = [FAQS[2], FAQS[1], FAQS[0]].filter((f): f is NonNullable<typeof f> => !!f);

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/contact` },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: `${SITE}/hero-natec/d/0118.webp` },
      { name: "twitter:image", content: `${SITE}/hero-natec/d/0118.webp` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/contact` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: TITLE,
          url: `${SITE}/contact`,
          mainEntity: {
            "@type": "LocalBusiness",
            name: company.name,
            url: SITE,
            telephone: "+8801354252400",
            email: company.email,
            address: { "@type": "PostalAddress", streetAddress: "1st Floor, Vai Vai Market, opposite Walton showroom, Dhaka–Kapasia Road, Rajendrapur Bazar", addressLocality: "Sreepur", addressRegion: "Gazipur", postalCode: "1741", addressCountry: "BD" },
            contactPoint: [
              { "@type": "ContactPoint", telephone: "+8801354252400", contactType: "sales", areaServed: "BD" },
              { "@type": "ContactPoint", telephone: "+8801990665923", contactType: "customer service", areaServed: "BD" },
            ],
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org", "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
            { "@type": "ListItem", position: 2, name: "Contact", item: `${SITE}/contact` },
          ],
        }),
      },
    ],
  }),
  component: () => <UnderConstruction title="Contact" real={ContactPage} />,
});

const CARDS = [
  { icon: null, label: "WhatsApp", value: company.whatsapp, href: WA, action: "Chat now", ext: true, hot: true },
  { icon: Phone, label: "Phone", value: company.phone, href: company.phoneLink, action: "Call now" },
  { icon: Mail, label: "Email", value: company.email, href: `mailto:${company.email}`, action: "Send email" },
  { icon: MapPin, label: "Office", value: "Vai Vai Market, Rajendrapur Bazar", href: DIRECTIONS, action: "Get directions", ext: true },
];
const NEXT = [
  { icon: PhoneCall, title: "We call you back", body: "Our team calls you to understand what you're looking for." },
  { icon: CalendarCheck, title: "We arrange a site visit", body: "We set a time to show you the building and the area." },
  { icon: FileText, title: "We share plans and documents", body: "You get the floor plan and the documents for the project." },
];

function ContactPage() {
  return (
    <>
      <PageHero
        image="/hero-natec/d/0118.webp"
        imageAlt="Natec residential building at dusk in Rajendrapur, Sreepur, Gazipur"
        imagePosition="center 50%"
        heightClass="min-h-[64svh] md:min-h-[56svh]"
        crumbs={[{ label: "Home", to: "/" }, { label: "Contact" }]}
        eyebrow="Contact"
        title={<>Let's talk about your <em className="accent-dark">next home</em></>}
        intro="Call, WhatsApp or visit our office at Rajendrapur Bazar."
      >
        <a href={WA} target="_blank" rel="noreferrer" className="btn btn-primary"><WhatsAppIcon /> WhatsApp us</a>
        <a href={company.phoneLink} className="btn btn-ghost-dark"><Phone className="h-4 w-4" /> Call now</a>
      </PageHero>

      <section className="bg-ivory pt-12 md:pt-16">
        <div className="container-x grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((c, i) => (
            <Reveal key={c.label} delay={i * 80} className="h-full">
              <a href={c.href} {...(c.ext ? { target: "_blank", rel: "noreferrer" } : {})}
                className={`group flex h-full flex-col rounded-2xl p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${c.hot ? "bg-brand-red text-white" : "border border-border bg-white text-navy"}`}>
                <span className={c.hot ? "text-white" : "text-brand-red"}>{c.icon ? <c.icon className="h-6 w-6" /> : <WhatsAppIcon />}</span>
                <span className={`eyebrow mt-4 !text-[11px] ${c.hot ? "text-white/75" : "text-muted-foreground"}`}>{c.label}</span>
                <span className="mt-1 break-words font-semibold">{c.value}</span>
                <span className={`eyebrow mt-auto pt-5 !text-[11px] ${c.hot ? "text-white" : "text-brand-red"}`}>{c.action} →</span>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section-pad bg-ivory">
        <div className="container-x grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <Reveal><InquiryForm title="Send us a message" /></Reveal>
          <Reveal delay={120} className="flex flex-col gap-6">
            <iframe title="Map of the Natec office" src={mapEmbed(OFFICE_Q)} className="h-80 w-full rounded-2xl border-0 shadow-lg lg:h-full lg:min-h-[360px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5">
              <div className="text-sm text-navy">
                <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" />{company.address}</p>
                <p className="mt-2 flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" />Call or WhatsApp before you visit so we can meet you.</p>
              </div>
              <a href={DIRECTIONS} target="_blank" rel="noreferrer" className="btn btn-primary"><Navigation className="h-4 w-4" /> Get directions</a>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-pad bg-white">
        <div className="container-x">
          <Reveal><h2 className="text-primary">What happens next</h2></Reveal>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {NEXT.map((n, i) => (
              <li key={n.title}>
                <Reveal delay={i * 100} className="h-full rounded-2xl border border-border bg-ivory p-7">
                  <span className="font-display text-3xl text-brand-red">0{i + 1}</span>
                  <n.icon className="mt-4 h-6 w-6 text-navy" aria-hidden />
                  <h3 className="mt-3 !text-xl text-navy">{n.title}</h3>
                  <p className="mt-2 text-muted-foreground">{n.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-pad bg-ivory">
        <div className="container-x grid gap-10 md:grid-cols-[1fr_1.6fr]">
          <Reveal><h2 className="text-primary">Questions</h2></Reveal>
          <div className="divide-y divide-border rounded-2xl border border-border bg-white">
            {CONTACT_FAQS.map((f) => (
              <details key={f.q} className="group p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-navy">
                  {f.q}<span className="text-brand-red transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
