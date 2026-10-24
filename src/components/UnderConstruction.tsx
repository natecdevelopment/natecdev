import { Link } from "@tanstack/react-router";

// All pages are now live: renders the real page whenever one is provided.
export function UnderConstruction({ title, real: Real }: { title: string; real?: React.ComponentType }) {
  if (Real) return <Real />;
  return (
    <section className="bg-navy-deep text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-5 py-24 text-center">
        <p className="eyebrow text-muted-dark">{title}</p>
        <h1 className="mt-4 text-4xl font-semibold md:text-6xl">Coming soon</h1>
        <Link to="/" className="btn btn-primary mt-8">Back to home</Link>
      </div>
    </section>
  );
}
