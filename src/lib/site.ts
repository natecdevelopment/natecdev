/** Live website address (Lovable custom domain). Used for canonical URLs, sitemaps, share links and email links. */
export const SITE_URL = "https://natecdev.com";

export const company = {
  name: "Natec Development Ltd.",
  founded: 2023,
  address:
    "1st Floor, Vai Vai Market, opposite Walton showroom, Dhaka–Kapasia Road, Rajendrapur Bazar, Sreepur, Gazipur 1741, Bangladesh",
  locationShort: "Rajendrapur, Sreepur, Gazipur",
  whatsapp: "+880 1990-665923",
  whatsappLink: "https://wa.me/8801990665923",
  phone: "01354-252400",
  phoneLink: "tel:+8801354252400",
  email: "natecdevelopment@gmail.com",
  facebook: "https://facebook.com/natecltd",
  website: "natecdev.com",
};

/**
 * The office as it exists on Google Maps: the place "NATEC development ltd."
 * https://maps.app.goo.gl/v7J6wkiyw15PP8n57
 * Embeds and directions point at this place, not at a free-text address.
 */
export const office = {
  name: "Natec Development Office",
  /** Exact Google Maps place name — used so the embed shows the business card. */
  mapsName: "NATEC development ltd.",
  lat: 24.0988041,
  lng: 90.4527001,
  mapsUrl: "https://maps.app.goo.gl/v7J6wkiyw15PP8n57",
};

/** Embedded map showing the office pin with its business card. */
export const officeEmbed = `https://www.google.com/maps?q=${encodeURIComponent(office.mapsName)}&output=embed`;

/** Turn-by-turn directions to the office. */
export const officeDirections = `https://www.google.com/maps/dir/?api=1&destination=${office.lat},${office.lng}`;


export const services = [
  { title: "Land Acquisition", body: "We assist clients in identifying and acquiring land suited to their development objectives, including initial property research, coordination, and guidance on reviewing land documents and project requirements." },
  { title: "Project Planning", body: "We help clients define project goals, scope, requirements, and development stages. Careful planning supports informed decisions and effective coordination throughout a project." },
  { title: "Project Financing", body: "We help clients understand key financial considerations of a real estate project and provide guidance on financing options suited to the project's needs." },
  { title: "Permits and Approvals", body: "We coordinate the documentation and application process for relevant permits and approvals, according to the requirements applicable to each project." },
  { title: "Building Design", body: "We support building design planning based on the project's purpose, site conditions, and client requirements, coordinated with qualified professionals where required." },
  { title: "Construction Management", body: "We coordinate construction activities and monitor progress in line with agreed plans — organized work, clear communication, and attention to quality throughout." },
  { title: "Marketing and Sales", body: "We support the marketing and sale of real estate projects by presenting property information clearly and coordinating communication with prospective buyers." },
  { title: "Property Management", body: "We assist property owners with the coordination and ongoing management of their real estate assets, addressing operational needs and maintaining usability." },
  { title: "Sustainable Development", body: "We advise on planning projects with long-term value in mind — responsible land use, efficient use of resources, practical design choices, and needs over time." },
];

export const values = [
  { title: "Integrity", body: "We communicate honestly, act responsibly, and work to build trust." },
  { title: "Quality", body: "We give careful attention to planning, coordination, and project delivery." },
  { title: "Innovation", body: "We consider practical ideas and suitable technologies that may improve project outcomes." },
  { title: "Sustainability", body: "We consider responsible land use, efficient use of resources, and the long-term impact of development." },
  { title: "Client Focus", body: "We listen to our clients and keep their requirements in view throughout the project." },
  { title: "Professionalism", body: "We approach our work with respect, accountability, and clear communication." },
];

export const directors = [
  { name: "Md. Nazim Uddin", gender: "male", role: "Chairman", bio: "Provides leadership and strategic direction, supporting responsible decision-making and the company's long-term goals.", email: "asmmusa6984@gmail.com", phone: "+880 1927-080648" },
  { name: "Musa", gender: "male", role: "Managing Director", bio: "Leads day-to-day operations and works with the team to advance the company's business and development objectives.", email: "asmmusa6984@gmail.com", phone: "+880 1738-614256" },
  { name: "Sanjida Akter", gender: "female", role: "Director", bio: "Contributes to company governance and strategic planning, supporting the effective delivery of its services.", email: "asmmusa6984@gmail.com", phone: "+880 1990-665923" },
  { name: "Mahamudul Hasan Khan", gender: "male", role: "Director", bio: "Supports company planning and decision-making in line with its business goals and development priorities.", email: "mahamudulhasankhan247@gmail.com", phone: "+880 1626-653992" },
  { name: "Shahin", gender: "male", role: "Director, Technical Support & Business Development", bio: "Supports technical coordination and business development, helping identify opportunities and strengthen the company's project capabilities.", email: "10shahin28@gmail.com", phone: "+880 1949-675132" },
];
