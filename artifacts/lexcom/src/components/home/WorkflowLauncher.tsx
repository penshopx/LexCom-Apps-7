import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowUpRight,
  BellRing,
  FileSearch,
  FolderKanban,
  PenLine,
  Search,
  Users,
} from "lucide-react";

const WORKFLOWS = [
  {
    icon: Search,
    title: "Riset masalah hukum",
    desc: "Bangun analisis awal dari beberapa perspektif AI dan periksa dasar hukumnya.",
    href: "/riset-ai",
    label: "Mulai riset",
  },
  {
    icon: FileSearch,
    title: "Telaah dokumen",
    desc: "Minta agen drafting, korporasi, ketenagakerjaan, riset, dan notarial meninjau teks yang sama.",
    href: "/telaah-dokumen",
    label: "Telaah sekarang",
  },
  {
    icon: PenLine,
    title: "Susun dokumen",
    desc: "Buat draf awal gugatan, kontrak, perjanjian, atau surat kuasa untuk ditinjau kembali.",
    href: "/documents",
    label: "Buat draf",
  },
  {
    icon: FolderKanban,
    title: "Kelola perkara",
    desc: "Simpan perkara, status, deskripsi, dan jadwal sidang dalam satu ruang kerja.",
    href: "/cases",
    label: "Buka perkara",
  },
  {
    icon: BellRing,
    title: "Tinjau isu regulasi",
    desc: "Jelajahi snapshot isu kepatuhan dan checklist tindakan yang dikurasi LexCom.",
    href: "/intelijen-regulasi",
    label: "Lihat snapshot",
  },
  {
    icon: Users,
    title: "Cari bantuan manusia",
    desc: "Jelajahi profil praktisi dan forum ketika persoalan membutuhkan pemeriksaan profesional.",
    href: "/pengacara",
    label: "Cari praktisi",
  },
];

export function WorkflowLauncher() {
  return (
    <section className="relative border-y border-white/5 bg-card/30 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.75fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Mulai dari pekerjaan Anda
            </p>
            <h2 className="font-display text-3xl font-bold leading-tight md:text-4xl">
              Satu alur dari pertanyaan hingga tindakan.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              LexCom menghubungkan riset, telaah multi-agen, drafting, perkara, kepatuhan, dan bantuan praktisi—tanpa memaksa Anda memulai dari chatbot kosong.
            </p>
            <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/8 p-4">
              <p className="text-sm font-semibold text-foreground">Pembeda LexCom</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Orkestrasi 19 spesialis AI dengan lapisan pemeriksaan sumber dan jalur kerja hukum dalam satu workspace.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {WORKFLOWS.map((workflow, index) => (
              <motion.div
                key={workflow.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
              >
                <Link href={workflow.href} className="group block h-full">
                  <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-background/55 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:bg-background/80">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <workflow.icon className="h-5 w-5" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-foreground">{workflow.title}</h3>
                    <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{workflow.desc}</p>
                    <p className="mt-5 text-xs font-semibold text-primary">{workflow.label}</p>
                  </article>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}