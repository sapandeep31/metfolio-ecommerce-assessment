'use client';

import { useState } from 'react';
import { InquiryModal } from './inquiry-modal';

export function ScrollyHero() {
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);

  return (
    <section className="editorial-hero-fullscreen" aria-labelledby="hero-title">
      <div className="editorial-hero-bg" aria-hidden="true">
        <video
          className="editorial-hero-video"
          autoPlay
          loop
          muted
          playsInline
          poster="/media/landing-hero-poster.webp"
          preload="auto"
        >
          <source src="/media/landing-hero.webm" type="video/webm" />
          <source src="/media/landing-hero.mp4" type="video/mp4" />
          <img
            className="editorial-hero-img"
            src="/media/landing-hero.gif"
            alt=""
          />
        </video>
        <div className="editorial-hero-vignette" />
        <div className="editorial-hero-glow" />
      </div>

      <div className="editorial-hero-content">
        <div className="editorial-hero-inner">
          <span className="editorial-badge-pill">The Metfolio Atelier</span>
          <h1 id="hero-title" className="editorial-hero-title">
            The art of the unrepeatable.
          </h1>
          <p className="editorial-hero-lead">
            Fine jewelry, shaped by hand and made to become part of your story.
          </p>
          <div className="editorial-hero-actions">
            <a href="#collection-rail" className="btn-gold">
              Explore the collection
            </a>
            <button
              type="button"
              className="btn-gold-wireframe"
              onClick={() => setIsInquiryOpen(true)}
            >
              Private salon
            </button>
          </div>
        </div>
      </div>

      <a className="editorial-scroll-cue" href="#collection-rail" aria-label="Explore the collection">
        <span className="scroll-cue-text">Discover below</span>
        <span className="scroll-cue-chevron" aria-hidden="true">↓</span>
      </a>

      <InquiryModal isOpen={isInquiryOpen} onClose={() => setIsInquiryOpen(false)} />
    </section>
  );
}
