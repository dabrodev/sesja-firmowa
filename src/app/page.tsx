"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { useAuth } from "@/components/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { Coins } from "lucide-react";

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
  const { user, userProfile, loading, logout } = useAuth();
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans">
      {/* Navigation */}
      <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
              <Camera className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">SesjaFirmowa.pl</span>
          </div>

          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList className="gap-2">
              <NavigationMenuItem>
                <Link href="#problem">
                  <NavigationMenuLink className={navigationMenuTriggerStyle() + " bg-transparent text-white/70 hover:bg-white/5 hover:text-white transition-all"}>
                    problem
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href="#solution">
                  <NavigationMenuLink className={navigationMenuTriggerStyle() + " bg-transparent text-white/70 hover:bg-white/5 hover:text-white transition-all"}>
                    rozwiązanie
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <div className="flex items-center gap-4">
            {user && userProfile && (
              <div className="mr-2 hidden items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm font-medium sm:flex">
                <Coins className="h-4 w-4 text-blue-400" />
                <span className="text-blue-400">{userProfile.credits}</span>
                <span className="text-[10px] uppercase text-blue-400/60">PKT</span>
              </div>
            )}
            {loading ? (
              <div className="h-9 w-24 animate-pulse rounded-lg bg-white/5" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.photoURL || ""} alt={user.displayName || ""} />
                      <AvatarFallback className="bg-blue-600 text-white">
                        {user.displayName?.charAt(0) || user.email?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-[#0f172a] border-white/10 text-white" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.displayName}</p>
                      <p className="text-xs leading-none text-white/50">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem className="focus:bg-white/5 focus:text-white cursor-pointer" asChild>
                    <Link href="/projekty">moje projekty</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-white/5 focus:text-white cursor-pointer">
                    ustawienia
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    className="focus:bg-red-500/10 focus:text-red-400 cursor-pointer text-red-400"
                    onClick={() => logout()}
                  >
                    wyloguj się
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                className="text-white/70 hover:bg-white/5 hover:text-white"
                onClick={() => router.push("/login")}
              >
                Zaloguj
              </Button>
            )}
            <Link href="/generator">
              <Button className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25 px-6">
                uruchom kreator
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative flex min-h-[100vh] flex-col items-center justify-center overflow-hidden px-6 pt-24">
          {/* Background Image Layer */}
          <div className="absolute inset-0 pointer-events-none">
            <motion.img
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1.05, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              src="/hero-bg.png?v=2"
              alt="Premium Office Background"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[#020617]/70 backdrop-blur-[2px]" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/20 via-transparent to-[#020617]" />
          </div>

          <motion.div
            className="relative z-10 text-center"
            initial="initial"
            animate="animate"
            variants={staggerContainer}
          >
            <motion.div
              variants={fadeInUp}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-5 py-2 text-xs font-bold uppercase tracking-widest text-blue-400"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Rewolucja w twoim wizerunku</span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="mb-8 max-w-5xl bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent md:text-7xl lg:text-8xl leading-[1.1]"
            >
              Wirtualna <br />
              <span className="text-blue-500">sesja firmowa.</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="mx-auto mb-12 max-w-2xl text-lg text-white/70 md:text-xl leading-relaxed"
            >
              Twoja nowa profesjonalna sesja biznesowa i wizerunkowa w kilka minut.
              Zmień kilka selfie w sesję firmową w swoim biurze lub studio, bez stresu i zbędnych kosztów.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col items-center justify-center gap-6 sm:flex-row"
            >
              <Link href="/generator">
                <Button size="lg" className="h-14 border border-white/10 bg-gradient-to-br from-blue-600 to-indigo-700 px-10 text-lg font-bold text-white hover:from-blue-500 hover:to-indigo-600 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all hover:scale-105 active:scale-95 group/btn">
                  wybierz swoją sesję
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
                </Button>
              </Link>
              <Button
                size="lg"
                className="h-14 border border-white/10 bg-white/5 px-10 text-lg text-zinc-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all backdrop-blur-sm shadow-xl"
                onClick={() => document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' })}
              >
                zobacz przykłady
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
                { icon: <Camera className="h-6 w-6" />, title: "Koszty i czekanie", text: "Wysokie stawki za dzień zdjęciowy i tygodnie oczekiwania na gotowy retusz." }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <Card className="border-white/5 bg-white/[0.02] backdrop-blur-md hover:border-blue-500/30 transition-all duration-500 py-4 group/card h-full">
                    <CardContent className="p-8">
                      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-blue-500 border border-white/5 transition-colors group-hover/card:bg-blue-500/10 group-hover/card:text-blue-400">
                        {item.icon}
                      </div>
                      <h3 className="mb-4 text-2xl font-bold text-white group-hover/card:text-blue-400 transition-colors">{item.title}</h3>
                      <p className="text-white/40 leading-relaxed text-base group-hover/card:text-white/60 transition-colors">{item.text}</p>
                    </CardContent>
                  </Card>
                </motion.div>
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
                  <span>twoje rozwiązanie</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-bold leading-tight">Sesja w twoim biurze, <br /> <span className="text-blue-500 italic">bez wstawania z fotela.</span></h2>
                <div className="space-y-6 text-lg text-white/50">
                  {[
                    { title: "Wgrywasz selfie", text: "Kilka zdjęć z telefonu wystarczy, by AI nauczyło się twoich rysów twarzy.", icon: "🤳" },
                    { title: "Pokazujesz biuro", text: "Zdjęcie twojego biura pozwoli nam zachować autentyczność twojej marki.", icon: "🏢" },
                    { title: "Gotowe w minuty", text: "Otrzymasz profesjonalną sesję wizerunkową, gotową do publikacji natychmiast.", icon: "⚡" }
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="group/item flex gap-4 p-4 rounded-2xl transition-all hover:bg-white/5 hover:translate-x-2"
                    >
                      <div className="h-8 w-8 rounded-full bg-blue-600/10 flex items-center justify-center flex-shrink-0 mt-1 group-hover/item:bg-blue-600/30 transition-colors text-lg">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-white font-bold group-hover/item:text-blue-400 transition-colors">{item.title}</p>
                        <p className="text-sm text-white/40 group-hover/item:text-white/60 transition-colors">{item.text}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <Link href="/generator">
                  <Button size="lg" className="mt-4 h-14 border border-white/10 bg-gradient-to-br from-blue-600 to-indigo-700 px-8 text-lg font-bold text-white hover:from-blue-500 hover:to-indigo-600 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all hover:scale-105 active:scale-95">
                    sprawdź, jak to działa
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
        <section id="gallery" className="py-24 px-6 bg-black/20">
          <div className="container mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold text-white md:text-5xl">Sesja firmowa z AI — zobacz efekty</h2>
              <p className="mt-4 text-white/40 text-lg">Profesjonalna sesja biznesowa stworzona specjalnie dla twojej marki.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {MOCK_RESULTS.slice(0, 9).map((url, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.5 }}
                  viewport={{ once: true }}
                  className="aspect-[4/5] overflow-hidden rounded-[32px] border border-white/5 bg-zinc-900 group shadow-2xl relative cursor-pointer"
                  onClick={() => setSelectedImage(url)}
                >
                  <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none" />
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

        {/* Lightbox Modal */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedImage(null)}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md cursor-zoom-out"
            >
              <motion.img
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                src={selectedImage}
                alt="Powiększone zdjęcie"
                className="max-h-[90vh] max-w-full rounded-2xl shadow-2xl"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Final CTA */}
        <section id="cta" className="py-32 px-6">
          <div className="container mx-auto max-w-4xl text-center border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-20 rounded-[48px] backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-64 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
            <h2 className="text-4xl md:text-6xl font-extrabold mb-8 tracking-tight">Gotowy na profesjonalny <br /> <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">wizerunek biznesowy?</span></h2>
            <p className="text-white/40 text-xl mb-12 max-w-2xl mx-auto leading-relaxed">System AI czeka, by stworzyć twoją najlepszą sesję w historii. Bez wychodzenia z domu, bez zbędnych kosztów.</p>
            <Link href="/generator">
              <Button size="lg" className="h-16 border border-white/20 bg-gradient-to-br from-blue-600 to-indigo-700 px-12 text-xl font-black text-white hover:from-blue-500 hover:to-indigo-600 shadow-[0_0_30px_rgba(59,130,246,0.4)] uppercase tracking-widest transition-all hover:scale-105 active:scale-95">
                rozpocznij teraz
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-black/80 backdrop-blur-md py-20 px-6">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20">
              <Camera className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white/90">SesjaFirmowa.pl</span>
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
