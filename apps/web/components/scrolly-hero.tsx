'use client';

import { useEffect, useRef, useState } from 'react';
import { InquiryModal } from './inquiry-modal';

export function ScrollyHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    let rafId: number;

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const totalScroll = rect.height - window.innerHeight;
        if (totalScroll <= 0) return;

        const currentScroll = -rect.top;
        const rawProgress = Math.max(0, Math.min(1, currentScroll / totalScroll));
        setProgress(rawProgress);

        if (video.duration && !isNaN(video.duration)) {
          // Pause if playing so scrub is direct
          if (!video.paused) video.pause();
          const targetTime = rawProgress * video.duration;
          // Guard tiny updates to avoid video decoder thrashing
          if (Math.abs(video.currentTime - targetTime) > 0.03) {
            video.currentTime = targetTime;
          }
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const handleVideoLoaded = () => {
    setVideoReady(true);
  };

  // Staggered opacity & transform calculated from progress
  // Hero intro: progress 0 -> 0.2
  const introOpacity = Math.max(0, Math.min(1, (0.2 - progress) / 0.15));

  // Gliding interface left card: progress 0.25 -> 0.85
  const cardOpacity = Math.max(0, Math.min(1, (progress - 0.22) / 0.12));
  const cardTranslateY = Math.max(0, 30 * (1 - cardOpacity));

  // Exit transition towards secondary section
  const exitOpacity = progress > 0.85 ? Math.max(0, (1 - progress) / 0.15) : 1;

  return (
    <section ref={containerRef} className="scrolly-container" data-sc-act="scrub">
      <div className="scrolly-sticky-stage" style={{ opacity: exitOpacity }}>
        {/* Ambient Dark Velvet Backdrop */}
        <div className="scrolly-backdrop" aria-hidden="true" />

        {/* Video Canvas Layer */}
        <div
          className={`scrolly-video-wrap ${progress >= 0.25 ? 'scrolly-video-shifted' : ''}`}
        >
          <video
            ref={videoRef}
            src="/media/landing-hero.mp4"
            poster="/media/landing-hero-poster.webp"
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={handleVideoLoaded}
            className="scrolly-video-element"
            style={{ opacity: videoReady ? 1 : 0.6, transition: 'opacity 0.4s ease' }}
          />
          {/* Subtle warm lighting vignette */}
          <div className="scrolly-vignette" aria-hidden="true" />
        </div>

        {/* Floating Sparkle Elements */}
        <div className="scrolly-sparkles" aria-hidden="true">
          <span className="sparkle sparkle-1">✦</span>
          <span className="sparkle sparkle-2">✧</span>
          <span className="sparkle sparkle-3">✦</span>
        </div>

        {/* Stage Content Overlay */}
        <div className="scrolly-overlay-content">
          {/* State 1: Introductory Atelier Greeting */}
          <div
            className="scrolly-greeting"
            style={{
              opacity: introOpacity,
              transform: `translateY(-${progress * 80}px)`,
              pointerEvents: introOpacity > 0.3 ? 'auto' : 'none',
            }}
          >
            <span className="scrolly-eyebrow">METFOLIO ATELIER · 1898</span>
            <h1 className="scrolly-title">Haute Joaillerie & Rare Gemstones</h1>
            <p className="scrolly-lead">
              Where exceptional master craftsmanship meets ethically certified diamonds
              and Colombian emeralds.
            </p>
            <div className="scrolly-cue">
              <span className="scrolly-cue-text">SCROLL TO WITNESS</span>
              <span className="scrolly-cue-line" />
            </div>
          </div>

          {/* State 2: Macro Zoom & Gliding Interactive Interface */}
          <div
            className="scrolly-editorial-card"
            style={{
              opacity: cardOpacity,
              transform: `translateY(${cardTranslateY}px)`,
              pointerEvents: cardOpacity > 0.5 ? 'auto' : 'none',
            }}
          >
            <span className="scrolly-badge">ATELIER NO. 01 · PIÈCE UNIQUE</span>
            <h2 className="scrolly-card-title">
              The Rivière Emerald & Diamond Masterpiece
            </h2>
            <p className="scrolly-card-desc">
              Handcrafted in solid 18k white gold. Articulated four-prong gallery
              housing 12.0 total carats of brilliant-cut diamonds cascading toward a
              magnificent certified Colombian emerald drop.
            </p>

            {/* Spec Matrix */}
            <div className="scrolly-specs-grid">
              <div className="scrolly-spec-item">
                <span className="spec-val">12.0 CTW</span>
                <span className="spec-lbl">Diamonds (D–F, VVS)</span>
              </div>
              <div className="scrolly-spec-item">
                <span className="spec-val">Colombian</span>
                <span className="spec-lbl">Natural Emerald</span>
              </div>
              <div className="scrolly-spec-item">
                <span className="spec-val">18k Gold</span>
                <span className="spec-lbl">Articulated Setting</span>
              </div>
            </div>

            {/* Action CTAs */}
            <div className="scrolly-cta-group">
              <button
                type="button"
                className="btn btn-gold-wireframe"
                onClick={() => setIsInquiryOpen(true)}
              >
                Inquire & Acquire
              </button>
              <a href="#collection-rail" className="btn btn-ghost-light">
                Explore Vault Collection ↓
              </a>
            </div>
          </div>
        </div>

        {/* Progress scrub indicator */}
        <div className="scrolly-progress-bar" aria-hidden="true">
          <div
            className="scrolly-progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Inquiry Modal */}
      <InquiryModal
        isOpen={isInquiryOpen}
        onClose={() => setIsInquiryOpen(false)}
        productTitle="The Rivière Emerald & Diamond Masterpiece"
      />
    </section>
  );
}
