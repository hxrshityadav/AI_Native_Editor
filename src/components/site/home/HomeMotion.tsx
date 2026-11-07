"use client";
import { useEffect } from "react";

/**
 * Homepage choreography only. GSAP is imported on this route after hydration, so other pages never load it.
 * Content is visible in the server HTML; motion only runs from that state, and reduced-motion users get none.
 */
export function HomeMotion() {
  useEffect(() => {
    let revert: (() => void) | undefined, cancelled = false;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const media = gsap.matchMedia();
      media.add({ motion: "(prefers-reduced-motion: no-preference)", phone: "(max-width: 767px)" }, context => {
        const phone = !!context.conditions?.phone, rise = phone ? 14 : 28;
        // Signature move: the headline lines rise out of their own masks, then the real bench settles in.
        gsap.timeline({ defaults: { ease: "expo.out" } })
          .from(".home-hero .hero-line>span", { yPercent: 105, duration: 1.05, stagger: 0.09 })
          .from(".home-hero .hero-lead, .home-hero .hero-actions > *", { y: 16, opacity: 0, duration: 0.7, stagger: 0.07 }, "-=0.75")
          .from(".home-hero .finishing-bench", { y: rise * 1.6, opacity: 0, duration: 1.1 }, "-=0.6");
        // Each section's parts enter once, heading first, then copy, then its fragment.
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach(section => {
          const parts = section.querySelectorAll(":scope [data-reveal-part]");
          if (!parts.length) return;
          gsap.from(parts, { y: rise, opacity: 0, duration: 0.85, ease: "expo.out", stagger: 0.075, scrollTrigger: { trigger: section, start: "top 82%", once: true } });
        });
        // One slow, scroll-linked drift on the hero sample: transform only.
        if (!phone) gsap.to(".home-hero .bench-preview img", { scale: 1.06, ease: "none", scrollTrigger: { trigger: ".home-hero .finishing-bench", start: "top 60%", end: "bottom top", scrub: 0.6 } });
      });
      revert = () => { media.revert(); ScrollTrigger.getAll().forEach(trigger => trigger.kill()); };
    }).catch(() => { /* Motion is optional; the page is complete without it. */ });
    return () => { cancelled = true; revert?.(); };
  }, []);
  return null;
}
