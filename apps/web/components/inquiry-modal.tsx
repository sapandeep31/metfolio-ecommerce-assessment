'use client';

import { useState } from 'react';

export function InquiryModal({
  isOpen,
  onClose,
  productTitle = 'The Rivière Emerald & Diamond Collar',
}: {
  isOpen: boolean;
  onClose: () => void;
  productTitle?: string;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: 'Geneva Salon',
    message: '',
  });

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="inquiry-dialog"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <button
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close inquiry dialog"
        >
          ×
        </button>

        {submitted ? (
          <div className="inquiry-success">
            <span className="inquiry-seal">⚜</span>
            <h3 id="modal-title">Inquiry Received</h3>
            <p className="inquiry-subtitle">
              Thank you, {formData.name || 'esteemed guest'}. Our Private Client
              Concierge has received your acquisition inquiry for{' '}
              <em>{productTitle}</em>.
            </p>
            <p className="inquiry-note">
              A Senior Gemologist from our {formData.location} will contact you
              discreetly within two hours to coordinate viewing arrangements or
              secure courier transit.
            </p>
            <button
              className="btn btn-gold"
              style={{ marginTop: 24 }}
              onClick={onClose}
            >
              Return to Atelier
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="inquiry-form">
            <span className="inquiry-eyebrow">Haute Joaillerie Acquisition</span>
            <h2 id="modal-title">{productTitle}</h2>
            <p className="inquiry-description">
              Please enter your details to request private salon viewing, secure
              bespoke acquisition terms, or arrange insured courier transit.
            </p>

            <div className="inquiry-fields">
              <label>
                <span>Full Name</span>
                <input
                  type="text"
                  required
                  placeholder="Countess / Lady / Mr. John Doe"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </label>

              <label>
                <span>Private Email</span>
                <input
                  type="email"
                  required
                  placeholder="client@private.domain"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </label>

              <label>
                <span>Contact Phone</span>
                <input
                  type="tel"
                  placeholder="+41 22 555 0192"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </label>

              <label>
                <span>Preferred Salon or Delivery</span>
                <select
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                >
                  <option value="Geneva Flagship Salon">Geneva Flagship Salon (Rue du Rhône)</option>
                  <option value="New York Fifth Avenue Suite">New York Fifth Avenue Suite</option>
                  <option value="London Bond Street Atelier">London New Bond Street Atelier</option>
                  <option value="Paris Place Vendôme Salon">Paris Place Vendôme Private Salon</option>
                  <option value="Armored Private Courier">Armored & Insured Private Courier Delivery</option>
                </select>
              </label>

              <label>
                <span>Special Requests or Diamond Inquiries</span>
                <textarea
                  rows={3}
                  placeholder="Inquire regarding customized carat sizing, GIA certifications, or private appointment timing..."
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                />
              </label>
            </div>

            <div className="inquiry-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-gold">
                Submit Private Inquiry
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
