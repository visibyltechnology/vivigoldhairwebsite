import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import heroImg from "@/assets/hero-model.jpg";

const About = () => (
  <Layout>
    <section className="relative h-[60vh] overflow-hidden">
      <img src={heroImg} alt="Vivygold" className="size-full object-cover object-top opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Our story</span>
          <h1 className="font-display text-6xl md:text-8xl mt-3">Crafted in <span className="text-gold italic">gold</span></h1>
        </div>
      </div>
    </section>

    <section className="container py-20 max-w-2xl space-y-6 text-lg leading-relaxed text-muted-foreground">
      {[
        "Vivygold was born from a simple belief: that a woman's hair is heritage, not trend. We source single-donor raw bundles, hand-craft each wig, and treat every piece like the heirloom it is.",
        "From Lagos to London to Atlanta, our clients are bridesmaids, executives, performers and mothers — women who refuse the ordinary. We make hair worthy of them.",
        "And because exceptional shouldn't be inaccessible, we built Pay Small Small — split any order into manageable pieces, no interest, no judgement.",
      ].map((p, i) => (
        <motion.p key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}>
          {p}
        </motion.p>
      ))}
    </section>
  </Layout>
);

export default About;
