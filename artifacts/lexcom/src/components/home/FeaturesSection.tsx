import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Bot, Database, Wrench, GraduationCap, Users, Building2, ArrowRight,
  Sparkles, BookOpen, Calculator, Scale, Globe, FileText
} from "lucide-react";

const PILLARS = [
  {
    icon: Bot,
    title: "Konsultasi AI",
    subtitle: "Chaesa Lexbot · 19 Agen Langsung · 11 Agen Kolaboratif",
    desc: "Orkestrasi multi-agen yang memilih spesialis relevan, menyusun analisis awal, dan menampilkan rujukan yang masih perlu diperiksa.",
    features: ["Chaesa Lexbot sebagai pengarah", "19 profil agen spesialis", "Kolaborasi 11 agen inti", "Sintesis lintas perspektif"],
    link: "/lexbot",
    color: "from-violet-500 to-purple-600",
    border: "hover:border-violet-500/40",
    glow: "group-hover:shadow-violet-500/20",
  },
  {
    icon: Database,
    title: "Knowledge Base Hukum",
    subtitle: "Peraturan · Putusan · Panduan · Glosarium",
    desc: "Katalog referensi internal untuk eksplorasi awal, dilengkapi tautan menuju portal pemerintah agar status sumber dapat diperiksa.",
    features: ["Katalog UU, PP, Perpres, dan Permen", "Koleksi putusan kurasi", "Panduan prosedur hukum", "Glosarium istilah hukum"],
    link: "/peraturan",
    color: "from-blue-500 to-cyan-500",
    border: "hover:border-blue-500/40",
    glow: "group-hover:shadow-blue-500/20",
  },
  {
    icon: Wrench,
    title: "Alat Bantu Hukum",
    subtitle: "Kalkulator · Dokumen AI · Manajemen Kasus",
    desc: "Alat praktis yang mengotomatiskan pekerjaan hukum sehari-hari — hitung pesangon, buat draf dokumen, kelola perkara.",
    features: ["6 kalkulator hukum (pesangon, waris, dll)", "Generator dokumen AI dengan streaming", "Manajemen kasus & jadwal sidang", "Copy, simpan & kelola arsip"],
    link: "/kalkulator",
    color: "from-emerald-500 to-teal-500",
    border: "hover:border-emerald-500/40",
    glow: "group-hover:shadow-emerald-500/20",
  },
  {
    icon: GraduationCap,
    title: "Pendidikan Hukum",
    subtitle: "Kursus · Panduan · Glosarium · Mentoring AI",
    desc: "Materi belajar, panduan langkah demi langkah, glosarium, dan latihan interaktif untuk memahami konsep hukum.",
    features: ["Modul kursus online", "Panduan praktis hukum", "Glosarium istilah", "Latihan tanya jawab AI"],
    link: "/kursus",
    color: "from-orange-500 to-amber-500",
    border: "hover:border-orange-500/40",
    glow: "group-hover:shadow-orange-500/20",
  },
  {
    icon: Users,
    title: "Jaringan Profesional",
    subtitle: "Pengacara · Forum · Komunitas",
    desc: "Temukan profil praktisi dan ruang diskusi ketika persoalan membutuhkan konteks manusia atau pemeriksaan profesional.",
    features: ["Direktori profil praktisi", "Forum diskusi hukum", "Komunitas lintas peran", "Jalur menuju bantuan profesional"],
    link: "/pengacara",
    color: "from-pink-500 to-rose-500",
    border: "hover:border-pink-500/40",
    glow: "group-hover:shadow-pink-500/20",
  },
  {
    icon: Building2,
    title: "Sumber Resmi Pemerintah",
    subtitle: "MA · MK · KPK · Kemenkum · JDIH",
    desc: "Akses langsung ke seluruh portal hukum resmi pemerintah Indonesia — putusan, peraturan, perkara, dan layanan publik.",
    features: ["Direktori Putusan MA (putusan3.mahkamahagung.go.id)", "Putusan & perkara MK (mkri.id)", "Data perkara KPK & sidang tipikor", "JDIH MA & Peraturan.go.id"],
    link: "/layanan",
    color: "from-yellow-500 to-orange-500",
    border: "hover:border-yellow-500/40",
    glow: "group-hover:shadow-yellow-500/20",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-card/30 border-y border-white/5 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/15 rounded-full blur-[120px] -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-5">
            <Sparkles className="w-4 h-4" /> Sistem Kerja AI Hukum Indonesia
          </div>
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-5">
            6 Pilar Ekosistem <span className="text-gradient">LexCom</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Dari konsultasi AI hingga sumber resmi pemerintah — semua terintegrasi dalam satu platform hukum digital.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PILLARS.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
            >
              <Link href={p.link} className="block h-full">
                <div className={`glass-card rounded-2xl p-6 h-full flex flex-col group border border-white/10 ${p.border} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${p.glow}`}>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                    <p.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground mb-0.5">{p.title}</h3>
                  <p className="text-[10px] text-primary font-semibold uppercase tracking-wide mb-3">{p.subtitle}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{p.desc}</p>
                  <ul className="space-y-1.5 mb-4">
                    {p.features.map((f, fi) => (
                      <li key={fi} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${p.color} shrink-0 mt-1.5`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Jelajahi <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
