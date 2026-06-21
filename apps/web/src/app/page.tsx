import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  Code2,
  FileSearch2,
  MessageSquareMore,
  ShieldCheck,
} from "lucide-react";
import { RoleQMark } from "@/components/RoleQLogo";

const features = [
  [FileSearch2, "Resume Intelligence", "See document alignment, grounded evidence, gaps, and practical improvements."],
  [BrainCircuit, "Personalized assessments", "Generate knowledge and coding rounds from the resume and role requirements."],
  [MessageSquareMore, "Humanized voice interviews", "Practice adaptive conversations with spoken questions and technical follow-ups."],
  [Code2, "Live coding", "Work in an eight-language editor and discuss the reasoning behind your solution."],
  [ShieldCheck, "Explainable proctoring", "Capture reviewable events without emotion inference or automatic rejection."],
  [BarChart3, "Separate evidence reports", "Review strengths and gaps by round without a misleading composite score."],
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#17333b] text-white"><RoleQMark className="size-7" /></span>
          <span>
            <span className="block font-serif text-xl font-bold leading-none">RoleQ</span>
            <span className="mt-1 block text-[8px] font-black uppercase tracking-[.16em] text-muted">Measure. Practice. Succeed.</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login?role=student" className="rounded-xl px-4 py-2 text-sm font-bold text-muted hover:text-ink">Student login</Link>
          <Link href="/login?role=employer" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold shadow-sm">Employer login</Link>
        </div>
      </nav>

      <section className="mx-auto grid w-full max-w-7xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
        <div>
          <div className="eyebrow">Measure. Practice. Succeed.</div>
          <h1 className="mt-5 max-w-4xl font-serif text-5xl font-bold leading-[1.02] tracking-[-.035em] sm:text-7xl">
            Prepare with evidence. Interview like a human.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-muted">
            One platform for resume intelligence, technical assessments, live coding, adaptive voice interviews,
            proctoring evidence, and honest coaching.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/10">
              Get started <ArrowRight size={17} />
            </Link>
            <Link href="/login" className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-extrabold shadow-sm">I already have an account</Link>
          </div>
        </div>
        <div className="relative rounded-[2rem] bg-[#17333b] p-7 text-white shadow-2xl sm:p-10">
          <div className="absolute -right-14 -top-14 size-44 rounded-full bg-emerald-300/10 blur-2xl" />
          <BriefcaseBusiness className="text-emerald-300" size={30} />
          <div className="mt-16 font-serif text-3xl font-bold">Two focused workspaces.</div>
          <div className="mt-7 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-5">
              <div className="text-sm font-extrabold">Student</div>
              <p className="mt-2 text-xs leading-6 text-white/55">Analyze a resume, practice role-specific rounds, and receive coaching.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-5">
              <div className="text-sm font-extrabold">Employer</div>
              <p className="mt-2 text-xs leading-6 text-white/55">Create assessments, invite candidates, and review raw evidence dimensions.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-white/65 py-20">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="eyebrow">A complete preparation loop</div>
          <h2 className="mt-3 max-w-2xl font-serif text-4xl font-bold tracking-tight">From source documents to useful evidence.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof FileSearch2;
              return (
                <div key={String(title)} className="card p-6">
                  <div className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><FeatureIcon size={20} /></div>
                  <h3 className="mt-5 text-sm font-extrabold">{String(title)}</h3>
                  <p className="mt-2 text-xs leading-6 text-muted">{String(copy)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
