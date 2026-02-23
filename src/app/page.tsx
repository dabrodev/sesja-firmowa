"use client";

import { motion } from "framer-motion";
import { ArrowRight, Box, Camera, Clock, Layout, Sparkles, UserCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import { MOCK_RESULTS } from "@/components/generation-results";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans">
      {/* Navigation */}
      <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent italic">SesjaFirmowa.pl</span>
          </div>

          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList className="gap-2">
              <NavigationMenuItem>
                <Link href="#problem" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle() + " bg-transparent text-white/70 hover:bg-white/5 hover:text-white transition-all"}>
                    Problem
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href="#solution" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle() + " bg-transparent text-white/70 hover:bg-white/5 hover:text-white transition-all"}>
                    Rozwiązanie
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <div className="flex items-center gap-4">
            <Link href="/generator">
              <Button className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25 px-6">
                Uruchom Kreator
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-6 pt-20">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 -z-20">
            <img
              src="/hero-bg.png"
              alt="Background"
              className="h-full w-full object-cover opacity-40 grayscale-[0.2]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/80 via-[#020617]/40 to-[#020617]" />
          </div>

          {/* Advanced Background Effects */}
          <div className="absolute top-1/4 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/20 blur-[130px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 -z-10 h-[400px] w-[400px] rounded-full bg-indigo-600/10 blur-[120px]" />

          <motion.div
            className="text-center"
            initial="initial"
            animate="animate"
            variants={staggerContainer}
          >
            <motion.div
              variants={fadeInUp}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-5 py-2 text-xs font-bold uppercase tracking-widest text-blue-400"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Rewolucja w Twoim Wizerunku</span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="mb-8 max-w-5xl bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent md:text-7xl lg:text-8xl leading-[1.1]"
            >
              Profesjonalna sesja. <br />
              <span className="text-blue-500">Bez fotografa.</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="mx-auto mb-12 max-w-2xl text-lg text-white/50 md:text-xl leading-relaxed"
            >
              Profesjonalne zdjęcia dla adwokatów, designerów i agentów nieruchomości.
              Zmień kilka selfie w sesję w swoim biurze lub studio, bez stresu i zbędnych kosztów.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col items-center justify-center gap-6 sm:flex-row">
              <Link href="/generator">
                <Button size="lg" className="h-14 border-none bg-blue-600 px-10 text-lg font-bold text-white hover:bg-blue-700 shadow-xl shadow-blue-500/30 transition-all hover:scale-105">
                  Wybierz Swoją Sesję <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="h-14 border-white/10 bg-white/5 px-10 text-lg text-white hover:bg-white/10 transition-all">
                Zobacz Przybiady
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* Problem Section */}
        <section id="problem" className="py-32 px-6 border-t border-white/5 bg-black/40">
          <div className="container mx-auto">
            <div className="mb-20 text-center">
              <h2 className="text-3xl font-bold text-white md:text-5xl">Dlaczego tradycyjna sesja to koszmar?</h2>
              <p className="mt-4 text-white/40 text-lg italic">Organizacja profesjonalnych zdjęć to tygodnie stresu i logistyki.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {[
                { icon: <Clock className="h-6 w-6" />, title: "Czasochłonność", text: "Szukanie fotografa, ustalanie terminów i koordynacja całego zespołu trwa wieki." },
                { icon: <UserCheck className="h-6 w-6" />, title: "Przygotowania", text: "Fryzjer, makijaż, wybór idealnego garnituru czy kostiumu – stres, którego nie potrzebujesz." },
                { icon: <Camera className="h-6 w-6" />, title: "Koszty i Czekanie", text: "Wysokie stawki za dzień zdjęciowy i tygodnie oczekiwania na gotowy retusz." }
              ].map((item, i) => (
                <Card key={i} className="border-white/5 bg-white/[0.02] backdrop-blur-md hover:border-blue-500/30 transition-all duration-500 py-4">
                  <CardContent className="p-8">
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-blue-500 border border-white/5">
                      {item.icon}
                    </div>
                    <h3 className="mb-4 text-2xl font-bold text-white">{item.title}</h3>
                    <p className="text-white/40 leading-relaxed text-base">{item.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Solution Section */}
        <section id="solution" className="relative py-40 px-6 overflow-hidden">
          <div className="absolute top-1/2 left-0 -z-10 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-blue-600/10 blur-[150px]" />

          <div className="container mx-auto max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-8"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-sm font-medium text-emerald-400">
                  <Sparkles className="h-4 w-4" />
                  <span>Twoje Rozwiązanie</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-bold leading-tight">Sesja w Twoim biurze, <br /> <span className="text-blue-500 italic">bez wstawania z fotela.</span></h2>
                <div className="space-y-6 text-lg text-white/50">
                  <div className="flex gap-4">
                    <div className="h-6 w-6 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    </div>
                    <p><strong className="text-white">Wgraj selfie:</strong> Kilka zdjęć z telefonu wystarczy, by AI nauczło się Twoich rysów twarzy.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="h-6 w-6 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    </div>
                    <p><strong className="text-white">Pokaż biuro:</strong> Zdjęcie Twojego workspace'u pozwoli nam zachować autentyczność Twojej firmy.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="h-6 w-6 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    </div>
                    <p><strong className="text-white">Gotowe w minuty:</strong> Otrzymasz profesjonalną sesję biznesową, gotową do publikacji na LinkedIn czy stronie WWW.</p>
                  </div>
                </div>
                <Link href="/generator">
                  <Button size="lg" className="mt-4 h-14 border-none bg-blue-600 px-8 text-lg font-bold text-white hover:bg-blue-700 shadow-xl shadow-blue-500/20">
                    Sprawdź Jak To Działa
                  </Button>
                </Link>
              </motion.div>

              <motion.div
                className="relative"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
              >
                <div className="absolute -inset-4 rounded-[40px] border border-white/5 bg-white/[0.01] backdrop-blur-sm" />
                <div className="relative aspect-square overflow-hidden rounded-[32px] border border-white/10 shadow-3xl bg-zinc-900 group">
                  <img
                    src="/hero-team-kamienica-closer.png"
                    alt="Corporate AI Preview"
                    className="h-full w-full object-cover grayscale-[0.3] transition-all duration-700 group-hover:grayscale-0 group-hover:scale-105"
                  />
                  <div className="absolute bottom-8 left-8 right-8 p-6 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold text-lg">Sesja wygenerowana</p>
                        <p className="text-white/50 text-sm">Model: Business Premium v2</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
                        <UserCheck className="h-5 w-5 text-black" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Showcase Gallery */}
        <section className="py-24 px-6 bg-black/20">
          <div className="container mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold text-white md:text-5xl">Zobacz co potrafi nasz system</h2>
              <p className="mt-4 text-white/40 text-lg">Profesjonalne sesje dopasowane do Twojej branży i stylu pracy.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {MOCK_RESULTS.slice(0, 9).map((url, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="aspect-[4/5] overflow-hidden rounded-[32px] border border-white/5 bg-zinc-900 group shadow-2xl"
                >
                  <img
                    src={url}
                    alt={`Przykładowa sesja ${i}`}
                    className="h-full w-full object-cover grayscale-[0.2] transition-all duration-700 group-hover:grayscale-0 group-hover:scale-105"
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section id="cta" className="py-32 px-6">
          <div className="container mx-auto max-w-4xl text-center border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-20 rounded-[48px] backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-64 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
            <h2 className="text-4xl md:text-6xl font-extrabold mb-8 tracking-tight">Gotowy na profesjonalny <br /> <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">wizerunek biznesowy?</span></h2>
            <p className="text-white/40 text-xl mb-12 max-w-2xl mx-auto leading-relaxed">System AI czeka, by stworzyć Twoją najlepszą sesję w historii. Bez wychodzenia z domu, bez zbędnych kosztów.</p>
            <Link href="/generator">
              <Button size="lg" className="h-16 border-none bg-blue-600 px-12 text-xl font-black text-white hover:bg-blue-700 shadow-2xl shadow-blue-500/40 uppercase tracking-widest transition-all hover:scale-105 active:scale-95">
                Rozpocznij Teraz
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-black/80 backdrop-blur-md py-20 px-6">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20">
              <Sparkles className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white/90 italic">SesjaFirmowa.pl</span>
          </div>
          <div className="flex gap-8 text-white/30 text-sm font-medium">
            <a href="#" className="hover:text-blue-400 transition-colors">Regulamin</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Prywatność</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Kontakt</a>
          </div>
          <p className="text-white/20 text-sm">© 2026 SesjaFirmowa.pl — Napędzane przez AI.</p>
        </div>
      </footer>
    </div>
  );
}
