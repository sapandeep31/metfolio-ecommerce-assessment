'use client';

import { useState } from 'react';
import { InquiryModal } from './inquiry-modal';

export function ScrollyHero() {
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);

  return (
    <section className="editorial-hero-fullscreen" aria-label="Haute Joaillerie Hero">
      {/* 1. Full Screen First-Frame Editorial Backdrop */}
      <div className="editorial-hero-bg" aria-hidden="true">
        <img
          src="/media/landing-hero-poster.webp"
          alt="Master jeweler holding emerald and diamond necklace"
          className="editorial-hero-img"
        />
        <div className="editorial-hero-vignette" />
        <div className="editorial-hero-glow" />
      </div>

      {/* 2. Delicate Gold Sparkles */}
      <div className="scrolly-sparkles" aria-hidden="true">
        <span className="sparkle sparkle-1">✦</span>
        <span className="sparkle sparkle-2">✧</span>
        <span className="sparkle sparkle-3">✦</span>
      </div>

      {/* 3. Hero Content */}
      <div className="editorial-hero-content">
        <div className="editorial-hero-inner">
          <div className="editorial-badge-pill">
            <span className="badge-crest" aria-hidden="true">⚜</span>
            <span>METFOLIO ATELIER · PIÈCE UNIQUE</span>
          </div>

          <h1 className="editorial-hero-title">
            The Rivière Emerald &amp; Diamond Masterpiece
          </h1>

          <p className="editorial-hero-lead">
            Where exceptional master craftsmanship meets ethically certified diamonds
            and Colombian emeralds. Handcrafted in solid 18k white gold with an
            articulated four-prong gallery.
          </p>

          {/* Carat & Noble Metal Specs */}
          <div className="editorial-specs-matrix">
            <div className="editorial-spec-cell">
              <span className="spec-digit">12.0 CTW</span>
              <span className="spec-label">Diamonds (D–F, VVS)</span>
            </div>
            <div className="editorial-spec-divider" aria-hidden="true" />
            <div className="editorial-spec-cell">
              <span className="spec-digit">Colombian</span>
              <span className="spec-label">Natural Emerald</span>
            </div>
            <div className="editorial-spec-divider" aria-hidden="true" />
            <div className="editorial-spec-cell">
              <span className="spec-digit">18k Gold</span>
              <span className="spec-label">Articulated Setting</span>
            </div>
          </div>

          {/* CTAs */}
          <div className="editorial-hero-actions">
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => setIsInquiryOpen(true)}
            >
              Inquire &amp; Acquire
            </button>
            <a href="#collection-rail" className="btn btn-gold-wireframe">
              Explore Vault Collection ↓
            </a>
          </div>
        </div>
      </div>

      {/* 4. Bottom Scroll Indicator */}
      <a href="#collection-rail" className="editorial-scroll-cue" aria-label="Scroll down to vault collection">
        <span className="scroll-cue-text">SCROLL TO EXPLORE</span>
        <span className="scroll-cue-chevron" aria-hidden="true">↓</span>
      </a>

      {/* 5. Inquiry Modal Dialog */}
      <InquiryModal
        isOpen={isInquiryOpen}
        onClose={() => setIsInquiryOpen(false)}
        productTitle="The Rivière Emerald & Diamond Masterpiece"
      />
    </section>
  );
}
