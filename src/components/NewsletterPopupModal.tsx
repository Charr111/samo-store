import React, { useState } from 'react';
import { Check, Copy, Mail, X } from 'lucide-react';
import { NewsletterPopupConfig } from '../types/samo';
import { validateNewsletterPopupInputs } from '../utils/catalogLogic';

interface NewsletterPopupModalProps {
  config: NewsletterPopupConfig;
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: (email: string, phone: string) => Promise<void> | void;
}

export const NewsletterPopupModal: React.FC<NewsletterPopupModalProps> = ({
  config,
  isOpen,
  onClose,
  onSubscribe,
}) => {
  const [contactInput, setContactInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const promoCode = (config.promoCode || 'SAMO10').trim().toUpperCase();
  const discountLabel = (config.discountText || '10% OFF').trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const validation = validateNewsletterPopupInputs(contactInput);
    if (!validation.valid) {
      setErrorMessage(
        validation.errorMessage ||
          'Please enter a valid email address or phone number (e.g., johndoe@gmail.com, 70 123 456).'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubscribe(
        validation.cleanEmail || validation.cleanPhone,
        validation.cleanPhone
      );
      setIsUnlocked(true);
    } catch {
      setIsUnlocked(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(promoCode).catch(() => {});
    }
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-[2px] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-md max-h-[90dvh] overflow-y-auto border border-[#27272A] bg-[#0B0B0C] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top subtle luxury accent line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-[#27272A] via-[#D4AF37] to-[#27272A]" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close SAMO Weave Newsletter"
          className="absolute right-3 top-3 sm:right-3.5 sm:top-3.5 z-10 flex h-8 w-8 items-center justify-center border border-[#27272A] bg-[#141416] text-[#A1A1AA] transition-colors hover:border-white hover:text-white cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <h2 className="pr-8 font-display text-base sm:text-lg md:text-xl font-bold tracking-[0.1em] uppercase text-white leading-snug">
            {config.title || 'Subscribe to Samo Weave'}
          </h2>

          <p className="mt-2 text-xs leading-relaxed text-[#A1A1AA]">
            {config.subtitle ||
              'Enter your email or phone number to receive early access to new arrivals, latest offers, and seasonal sales.'}
          </p>

          {!isUnlocked ? (
            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5" noValidate>
              <div>
                <label className="mb-1.5 block text-[10px] sm:text-[11px] font-semibold tracking-[0.14em] uppercase text-[#D4D4D8]">
                  Enter your Email Or Number <span className="text-[#D4AF37]">*</span>
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#71717A]" />
                  <input
                    type="text"
                    value={contactInput}
                    onChange={(e) => {
                      setContactInput(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="johndoe@gmail.com, 70 123 456"
                    autoComplete="email"
                    className="w-full border border-[#27272A] bg-[#141416] py-3 pl-9 pr-3.5 text-base sm:text-xs text-white placeholder-[#71717A] focus:border-white focus:outline-none rounded-none"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="border border-red-900/60 bg-red-950/40 px-3 py-2 text-[11px] leading-relaxed text-red-300">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 w-full bg-white py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase text-[#0B0B0C] transition-colors hover:bg-[#E4E4E7] disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting
                  ? 'UNLOCKING YOUR CODE...'
                  : config.buttonText || 'Unlock your code'}
              </button>

              <p className="pt-1 text-center text-[10px] sm:text-[11px] tracking-[0.1em] uppercase text-[#A1A1AA]">
                Subscribe to SAMO and get 10% on your first order
              </p>
            </form>
          ) : (
            <div className="mt-5 border border-[#27272A] bg-[#141416] p-4 sm:p-5 text-center space-y-4">
              <div className="inline-flex items-center gap-1.5 border border-emerald-800/60 bg-emerald-950/40 px-3 py-1 text-[10px] font-semibold tracking-[0.2em] uppercase text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                Subscribed to SAMO Weave
              </div>

              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-[#A1A1AA]">
                  Your Exclusive {discountLabel} Promo Code
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <span className="border border-[#D4AF37]/60 bg-[#0B0B0C] px-4 sm:px-5 py-2.5 font-mono text-base sm:text-lg font-bold tracking-[0.24em] text-[#D4AF37]">
                    {promoCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 border border-white bg-white px-3.5 py-2.5 text-[10px] font-bold tracking-[0.18em] uppercase text-[#0B0B0C] transition-colors hover:bg-[#E4E4E7] cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700" />
                        COPIED
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        COPY
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-[#A1A1AA]">
                Apply code <strong className="text-white">{promoCode}</strong> at
                checkout in your Shopping Bag for{' '}
                <strong className="text-white">{discountLabel}</strong> on your
                first order.
              </p>

              <button
                type="button"
                onClick={onClose}
                className="w-full border border-[#3F3F46] bg-transparent py-2.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-white transition-colors hover:border-white hover:bg-white/5 cursor-pointer"
              >
                CONTINUE TO SAMO WEAVE
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
