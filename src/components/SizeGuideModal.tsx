import React, { useState, useEffect } from 'react';
import { X, Ruler } from 'lucide-react';
import { SizeGuideConfig, SizeGuideId, SizeGuideTable } from '../types/samo';
import { DEFAULT_SIZE_GUIDE_CONFIG } from '../utils/sizeGuideLogic';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  config?: SizeGuideConfig;
  activeGuides?: SizeGuideId[]; // which guides apply to this product/category
  initialGuide?: SizeGuideId; // which tab to open first (e.g. tops_guide or trousers_guide)
}

export const SizeGuideModal: React.FC<SizeGuideModalProps> = ({
  isOpen,
  onClose,
  config = DEFAULT_SIZE_GUIDE_CONFIG,
  activeGuides = ['tops_guide', 'trousers_guide'],
  initialGuide,
}) => {
  // Determine available guides according to config toggles and active category guides
  const availableGuides = (['tops_guide', 'trousers_guide'] as SizeGuideId[]).filter(
    (id) => {
      if (!config.masterEnabled) return false;
      if (id === 'tops_guide' && !config.topsGuideEnabled) return false;
      if (id === 'trousers_guide' && !config.trousersGuideEnabled) return false;
      return activeGuides.includes(id);
    }
  );

  const [activeTab, setActiveTab] = useState<SizeGuideId>('tops_guide');

  useEffect(() => {
    if (initialGuide && availableGuides.includes(initialGuide)) {
      setActiveTab(initialGuide);
    } else if (availableGuides.length > 0 && !availableGuides.includes(activeTab)) {
      setActiveTab(availableGuides[0]);
    }
  }, [isOpen, initialGuide, availableGuides.length]);

  if (!isOpen || availableGuides.length === 0) {
    return null;
  }

  const currentTable: SizeGuideTable | undefined = config.tables[activeTab];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="size-guide-modal-title"
      className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative bg-white border border-[#1A1A1A] max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden rounded-none my-auto"
        style={{ borderRadius: '0px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#E5E5E5] bg-[#FFFFFF] shrink-0">
          <div className="flex items-center gap-2.5">
            <Ruler className="w-4 h-4 text-[#1A1A1A]" />
            <div>
              <h2
                id="size-guide-modal-title"
                className="font-serif text-sm sm:text-base font-semibold uppercase tracking-[0.2em] text-[#1A1A1A]"
              >
                Size Guide
              </h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono-tabular">
                Centimeters (cm) · Atelier Standard Fit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close size guide"
            className="p-2 text-zinc-500 hover:text-zinc-950 transition-colors cursor-pointer rounded-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dual Tab Buttons (when both guides active) */}
        {availableGuides.length > 1 && (
          <div className="flex border-b border-[#E5E5E5] bg-[#F8F7F5] shrink-0">
            {availableGuides.map((guideId) => {
              const isSelected = activeTab === guideId;
              const tabTitle =
                guideId === 'tops_guide'
                  ? 'Tops, Jackets & Coats'
                  : 'Trousers & Denim';
              return (
                <button
                  key={guideId}
                  type="button"
                  onClick={() => setActiveTab(guideId)}
                  className={`flex-1 py-3 px-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em] transition-colors rounded-none cursor-pointer border-r last:border-r-0 border-[#E5E5E5] ${
                    isSelected
                      ? 'bg-[#4A080C] text-white'
                      : 'bg-[#F8F7F5] text-zinc-600 hover:text-zinc-950 hover:bg-[#F0EEEB]'
                  }`}
                >
                  {tabTitle}
                </button>
              );
            })}
          </div>
        )}

        {/* Content Body: Scrollable Table + Atelier Fit Note */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {currentTable && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-900">
                  {currentTable.title}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono-tabular">
                  Swipe horizontally on mobile →
                </span>
              </div>

              {/* Table with Sticky First Column */}
              <div className="border border-[#E5E5E5] overflow-x-auto -webkit-overflow-scrolling: touch">
                <table className="w-full text-left border-collapse min-w-[560px]">
                  <thead>
                    <tr className="bg-[#F8F7F5] border-b border-[#E5E5E5]">
                      {currentTable.columns.map((col, cIdx) => (
                        <th
                          key={cIdx}
                          scope="col"
                          className={`py-2.5 px-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-900 border-r last:border-r-0 border-[#E5E5E5] whitespace-nowrap text-center ${
                            cIdx === 0
                              ? 'sticky left-0 bg-[#F8F7F5] z-20 shadow-[1px_0_0_0_#E5E5E5]'
                              : ''
                          }`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5] bg-white">
                    {currentTable.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-zinc-50/80 transition-colors"
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`py-2.5 px-3 text-[11px] sm:text-xs font-mono-tabular text-zinc-800 border-r last:border-r-0 border-[#E5E5E5] whitespace-nowrap text-center ${
                              cIdx === 0
                                ? 'sticky left-0 bg-white font-bold text-zinc-950 z-10 shadow-[1px_0_0_0_#E5E5E5]'
                                : ''
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Atelier Fit Note Double-Framed Box */}
          {config.fitNoteEnabled && config.fitNoteText && (
            <div
              className="border border-[#1A1A1A] p-4 bg-[#FBFBFA] space-y-1.5 rounded-none"
              style={{ borderRadius: '0px' }}
            >
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-[#1A1A1A] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#4A080C] shrink-0" />
                <span>{config.fitNoteTitle || 'ATELIER FIT NOTE'}</span>
              </div>
              <p className="text-xs text-zinc-700 leading-relaxed">
                {config.fitNoteText}
              </p>
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className="px-4 sm:px-6 py-3 border-t border-[#E5E5E5] bg-[#FFFFFF] flex items-center justify-between text-[10px] text-zinc-500 shrink-0">
          <span>SAMO Atelier · Precision Garment Sizing</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-bold uppercase tracking-wider text-zinc-900 hover:underline cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
