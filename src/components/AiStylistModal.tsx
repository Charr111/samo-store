import React, { useState } from 'react';
import { X, Sparkles, Send } from 'lucide-react';
import { Department, ProductItem } from '../types/samo';

interface AiStylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: ProductItem[];
  currentDepartment?: Department | 'all';
  onSelectDepartment?: (dept: Department, cat?: string) => void;
}

export const AiStylistModal: React.FC<AiStylistModalProps> = ({
  isOpen,
  onClose,
  products = [],
  currentDepartment = 'all',
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; text: string; model?: string }[]
  >([
    {
      role: 'assistant',
      text: 'Welcome to SAMO Weave. Ask for curated runway pairings across Women (Jacket, Trench Coat, Fur, Suede, Trousers, Bags, Belts) or Kids (Baby, Junior, Teen in cm sizing).',
    },
  ]);

  if (!isOpen) return null;

  const handleSend = async (customQuery?: string) => {
    const q = (customQuery ?? prompt).trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    if (!customQuery) setPrompt('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          contextProducts: products,
          department: currentDepartment,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reach SAMO Weave AI');
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.reply || 'I recommend pairing our Avenue Heavy Cow Leather Biker Jacket with the Architectural Double-Pleat Wool Trousers.',
          model: data.model,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text:
            error instanceof Error
              ? `Note: ${error.message}`
              : 'Unable to reach AI Stylist right now.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="SAMO Weave AI Stylist"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-2xl bg-white border border-zinc-950 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-950 bg-zinc-950 text-white">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4" />
            <h2 className="font-display text-sm font-bold tracking-[0.16em] uppercase">
              SAMO Weave High-Thinking Stylist
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Stylist"
            className="p-1 text-white hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preset Quick Prompts */}
        <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200 flex flex-wrap gap-2">
          {[
            'Pair a Women Fine Leather Jacket with a Bag & Belt',
            'Kids CM sizing guide: 90 cm vs 120 cm vs 150 cm',
            'How to care for SAMO Suede Trench Coats & Shearling Fur',
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleSend(preset)}
              className="text-[11px] px-2.5 py-1 border border-zinc-300 bg-white hover:border-zinc-950 text-zinc-800 transition-colors cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Conversation Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`p-4 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-zinc-950 text-white ml-8'
                  : 'bg-zinc-100 text-zinc-900 mr-8 border border-zinc-200'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">
                {m.role === 'user' ? 'Client Inquiry' : 'SAMO Weave Director'}
              </div>
              <div className="whitespace-pre-line">{m.text}</div>
            </div>
          ))}
          {loading && (
            <div className="p-4 bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 uppercase tracking-wider">
              Reasoning through SAMO lookbook, sizing proportions, and material grain...
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-4 border-t border-zinc-950 flex gap-2"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask about styling, Women 36-42 / XS-XL or Kids 80 cm - 150 cm sizing..."
            className="flex-1 px-3.5 py-2.5 text-xs border border-zinc-300 focus:border-zinc-950 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-zinc-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
