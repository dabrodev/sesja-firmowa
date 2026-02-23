"use client";

import { motion } from "framer-motion";
import { SessionWizard } from "@/components/session-wizard";
import { Sparkles } from "lucide-react";

const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
};

const staggerContainer = {
    animate: {
        transition: {
            staggerChildren: 0.1
        }
    }
};

export default function App() {
    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30">
            <main>
                <section className="relative flex flex-col items-center justify-center overflow-hidden px-4 pt-32 pb-20">
                    <div className="absolute top-1/4 left-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/20 blur-[120px]" />

                    <motion.div
                        className="text-center"
                        initial="initial"
                        animate="animate"
                        variants={staggerContainer}
                    >
                        <motion.div
                            variants={fadeInUp}
                            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-blue-400"
                        >
                            <Sparkles className="h-4 w-4" />
                            <span>Studio Kreatywne AI</span>
                        </motion.div>

                        <motion.h1
                            variants={fadeInUp}
                            className="mb-6 max-w-3xl bg-gradient-to-b from-white to-white/50 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-6xl"
                        >
                            Kreator Twojej Sesji
                        </motion.h1>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="w-full"
                    >
                        <SessionWizard />
                    </motion.div>
                </section>
            </main>
        </div>
    );
}
