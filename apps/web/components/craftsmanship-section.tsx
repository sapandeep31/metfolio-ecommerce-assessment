export function CraftsmanshipSection() {
  return (
    <section className="craftsmanship-section">
      <div className="container-wide">
        <div className="craftsmanship-header">
          <span className="craftsmanship-eyebrow">THE METFOLIO CODE</span>
          <h2 className="craftsmanship-title">Uncompromising Haute Horlogerie & High Jewelry Standards</h2>
          <p className="craftsmanship-lead">
            Every creation is individually sculpted in noble metals and set by master lapidaries under microscope inspection.
          </p>
        </div>

        <div className="craftsmanship-grid">
          <div className="craft-card">
            <span className="craft-number">01</span>
            <h3 className="craft-card-title">Ethical Provenance</h3>
            <p className="craft-card-desc">
              100% of our round brilliant and fancy cut stones adhere strictly to the System of Warranties and the Kimberley Process. Conflict-free, fully traceable, and certified by leading gemological institutes (GIA).
            </p>
          </div>

          <div className="craft-card">
            <span className="craft-number">02</span>
            <h3 className="craft-card-title">Micro-Pavé Mastery</h3>
            <p className="craft-card-desc">
              Each diamond is calibrated for flawless chromatic uniformity (D–F colour, VVS+ clarity). Four-prong cathedral mounts and articulated links are hand-burnished to eliminate light-blocking metal.
            </p>
          </div>

          <div className="craft-card">
            <span className="craft-number">03</span>
            <h3 className="craft-card-title">Vault Inventory Protection</h3>
            <p className="craft-card-desc">
              Every acquisition is secured with real-time cryptographic stock reservation invariants. No overselling, no duplicate allocations. Once reserved, your piece is protected in our physical vault.
            </p>
          </div>
        </div>

        <div className="salon-banner">
          <div className="salon-content">
            <span className="salon-eyebrow">PRIVATE SALON VIEWINGS</span>
            <h3 className="salon-title">Experience the Atelier in Person</h3>
            <p className="salon-desc">
              Schedule an exclusive consultation with our master gemologists in Geneva, London, Paris, or New York. Discreet private rooms, champagne service, and bespoke custom commissions.
            </p>
          </div>
          <div className="salon-action">
            <a href="/products" className="btn btn-gold">
              Explore High Jewelry Vault
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
