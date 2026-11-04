import React, { useState } from 'react';

interface ProductImageProps {
  src: string;
  alt: string;
  category?: string;
  styleType?: string;
  className?: string;
  compact?: boolean;
}

/**
 * High-contrast architectural studio plate renderer for studio:// URIs
 * and resilient <img> loader with referrerPolicy="no-referrer" for external URLs
 * (Cloudflare Images, Cloudinary, or custom URLs).
 */
export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  category = 'Jacket',
  styleType = 'Fine Leather',
  className = '',
  compact = false,
}) => {
  const normalizedSrc = (src || '').trim();
  const [hasError, setHasError] = useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [normalizedSrc]);

  const isStudioUri =
    !normalizedSrc || normalizedSrc.startsWith('studio://') || hasError;
  const variantKey = (normalizedSrc || alt || category).toLowerCase();
  const isProfile = variantKey.includes('profile');
  const isDetail = variantKey.includes('detail');

  if (!isStudioUri) {
    return (
      <div className={`relative overflow-hidden bg-[#F3F3F4] ${className}`}>
        <img
          key={normalizedSrc}
          src={normalizedSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>
    );
  }

  // Determine garment color palette based on explicit color variant or material/style
  let primaryFill = '#141416'; // Deep black leather default
  let secondaryFill = '#27272A';
  let accentStroke = '#52525B';
  let studioBg = '#EFEFEF';

  if (variantKey.includes('ivory') || variantKey.includes('white') || variantKey.includes('alabaster')) {
    primaryFill = '#E7E2D8'; // Warm Ivory / Alabaster
    secondaryFill = '#F3EFE6';
    accentStroke = '#A8A29E';
    studioBg = '#EAE8E3';
  } else if (variantKey.includes('camel') || variantKey.includes('beige') || variantKey.includes('sand')) {
    primaryFill = '#9A6F44'; // Warm Camel Leather / Suede
    secondaryFill = '#B6895B';
    accentStroke = '#D6B588';
    studioBg = '#F3EFEA';
  } else if (variantKey.includes('burgundy') || variantKey.includes('oxblood') || variantKey.includes('red')) {
    primaryFill = '#58111A'; // Oxblood Burgundy Leather
    secondaryFill = '#741824';
    accentStroke = '#D4AF37';
    studioBg = '#F4F1F1';
  } else if (variantKey.includes('brown') || variantKey.includes('espresso') || variantKey.includes('cognac')) {
    primaryFill = '#4A2C1D'; // Espresso Brown Leather / Suede
    secondaryFill = '#633B27';
    accentStroke = '#8C583E';
    studioBg = '#F2EFE9';
  } else if (variantKey.includes('olive') || variantKey.includes('green')) {
    primaryFill = '#2F3B28'; // Deep Atelier Olive
    secondaryFill = '#3F4E36';
    accentStroke = '#6B7F5E';
    studioBg = '#EFF1EE';
  } else if (variantKey.includes('navy') || variantKey.includes('blue') || variantKey.includes('denim')) {
    primaryFill = '#1E293B'; // Deep Indigo / Navy
    secondaryFill = '#334155';
    accentStroke = '#64748B';
    studioBg = '#F1F3F5';
  } else if (variantKey.includes('black')) {
    primaryFill = '#141416';
    secondaryFill = '#27272A';
    accentStroke = '#52525B';
    studioBg = '#EFEFEF';
  } else if (variantKey.includes('suede') || variantKey.includes('rodeo') || variantKey.includes('trench')) {
    primaryFill = '#4A2C1D'; // Espresso cognac suede
    secondaryFill = '#633B27';
    accentStroke = '#8C583E';
    studioBg = '#F2EFE9';
  } else if (variantKey.includes('city') || variantKey.includes('bags')) {
    primaryFill = '#58111A'; // Oxblood crimson leather
    secondaryFill = '#741824';
    accentStroke = '#D4AF37';
    studioBg = '#F4F1F1';
  } else if (
    variantKey.includes('baby') ||
    variantKey.includes('minis') ||
    variantKey.includes('cashmere') ||
    variantKey.includes('satin')
  ) {
    primaryFill = '#D6D3CD'; // Warm alabaster / chalk cashmere
    secondaryFill = '#E5E2DC';
    accentStroke = '#A8A29E';
    studioBg = '#EFEFEF';
  } else if (variantKey.includes('fur')) {
    primaryFill = '#1F1B18'; // Dark sable shearling
    secondaryFill = '#332C27';
    accentStroke = '#574C44';
    studioBg = '#EFEFEF';
  }

  // Uniform Prada-inspired architectural light studio backdrop
  studioBg = '#EFEFEF';

  const catLower = category.toLowerCase();

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden select-none ${className}`}
      style={{ backgroundColor: studioBg }}
    >
      <svg
        viewBox="0 0 400 500"
        className="h-full w-full object-contain p-5 transition-transform duration-300"
        role="img"
        aria-label={alt}
      >
        <defs>
          <radialGradient id={`shadow-${variantKey.replace(/[^a-z0-9]/g, '')}`} cx="50%" cy="88%" r="35%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.20)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <linearGradient id={`sheen-${variantKey.replace(/[^a-z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={secondaryFill} />
            <stop offset="50%" stopColor={primaryFill} />
            <stop offset="100%" stopColor="#09090B" />
          </linearGradient>
        </defs>

        {/* Studio Floor Shadow */}
        <ellipse
          cx="200"
          cy="445"
          rx="115"
          ry="16"
          fill={`url(#shadow-${variantKey.replace(/[^a-z0-9]/g, '')})`}
        />

        {/* Render silhouette based on category & view */}
        {isDetail ? (
          /* Material & Hardware Macro Plate */
          <g transform="translate(70, 95)">
            <rect
              x="0"
              y="0"
              width="260"
              height="290"
              fill={`url(#sheen-${variantKey.replace(/[^a-z0-9]/g, '')})`}
              stroke={accentStroke}
              strokeWidth="2"
            />
            <line x1="0" y1="75" x2="260" y2="75" stroke={accentStroke} strokeWidth="1.5" strokeDasharray="5,4" />
            <line x1="0" y1="215" x2="260" y2="215" stroke={accentStroke} strokeWidth="1.5" strokeDasharray="5,4" />
            <rect x="95" y="115" width="70" height="60" fill="none" stroke="#D4AF37" strokeWidth="3" />
            <text
              x="130"
              y="150"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="13"
              fontWeight="700"
              letterSpacing="4"
              fontFamily="Archivo, sans-serif"
            >
              SAMO
            </text>
          </g>
        ) : catLower.includes('bag') ? (
          /* Hourglass / Le City Sculptural Top-Handle Bag */
          <g transform={isProfile ? 'translate(25, 0) scale(0.92, 1)' : ''}>
            {/* Top Arch Handle */}
            <path
              d="M 150 185 C 150 105, 250 105, 250 185"
              fill="none"
              stroke={primaryFill}
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Handle Brass Rings */}
            <rect x="142" y="178" width="16" height="10" fill="#D4AF37" />
            <rect x="242" y="178" width="16" height="10" fill="#D4AF37" />
            {/* Concave Hourglass Body */}
            <path
              d="M 95 185 L 305 185 L 325 385 Q 200 340 75 385 Z"
              fill={`url(#sheen-${variantKey.replace(/[^a-z0-9]/g, '')})`}
              stroke={accentStroke}
              strokeWidth="1.5"
            />
            {/* Front Flap */}
            <path
              d="M 95 185 L 305 185 L 295 275 Q 200 295 105 275 Z"
              fill={secondaryFill}
              stroke={accentStroke}
              strokeWidth="1.5"
            />
            {/* Metallic B/S Hardware Clasp */}
            <rect x="184" y="268" width="32" height="22" fill="#D4AF37" rx="2" />
            <text
              x="200"
              y="283"
              textAnchor="middle"
              fill="#111111"
              fontSize="10"
              fontWeight="800"
              fontFamily="Archivo, sans-serif"
            >
              S
            </text>
          </g>
        ) : catLower.includes('belt') ? (
          /* Luxury Cow Leather Hardware Belt */
          <g>
            <ellipse
              cx="200"
              cy="265"
              rx="125"
              ry="72"
              fill="none"
              stroke={primaryFill}
              strokeWidth="34"
            />
            <ellipse
              cx="200"
              cy="265"
              rx="125"
              ry="72"
              fill="none"
              stroke={accentStroke}
              strokeWidth="1.5"
              strokeDasharray="6,4"
            />
            {/* Double Ring Gold Hardware Buckle */}
            <circle cx="178" cy="332" r="24" fill="none" stroke="#D4AF37" strokeWidth="8" />
            <circle cx="222" cy="332" r="24" fill="none" stroke="#D4AF37" strokeWidth="8" />
          </g>
        ) : catLower.includes('trouser') || catLower.includes('pant') || catLower.includes('denim') || catLower.includes('teen') ? (
          /* Architectural Wide-Leg Trousers / Denim / Track Pants */
          <g transform={isProfile ? 'translate(18, 0) scale(0.9, 1)' : ''}>
            {/* Waistband */}
            <rect x="125" y="75" width="150" height="26" fill={primaryFill} stroke={accentStroke} strokeWidth="1.5" />
            {/* Wide Sculptural Legs */}
            <path
              d="M 125 101 L 275 101 L 310 420 L 212 420 L 200 185 L 188 420 L 90 420 Z"
              fill={`url(#sheen-${variantKey.replace(/[^a-z0-9]/g, '')})`}
              stroke={accentStroke}
              strokeWidth="1.5"
            />
            {/* Knife Pleats / Side Piping */}
            <line x1="158" y1="101" x2="140" y2="418" stroke={accentStroke} strokeWidth="1.5" />
            <line x1="242" y1="101" x2="260" y2="418" stroke={accentStroke} strokeWidth="1.5" />
            {catLower.includes('pant') && (
              <>
                <line x1="122" y1="101" x2="94" y2="418" stroke="#E4E4E7" strokeWidth="3" />
                <line x1="278" y1="101" x2="306" y2="418" stroke="#E4E4E7" strokeWidth="3" />
              </>
            )}
          </g>
        ) : catLower.includes('skirt') ? (
          /* Asymmetric Draped Maxi Skirt */
          <g>
            <rect x="135" y="85" width="130" height="24" fill={primaryFill} />
            <path
              d="M 135 109 L 265 109 L 305 415 L 105 395 Z"
              fill={`url(#sheen-${variantKey.replace(/[^a-z0-9]/g, '')})`}
              stroke={accentStroke}
              strokeWidth="1.5"
            />
            <line x1="165" y1="109" x2="235" y2="405" stroke={accentStroke} strokeWidth="1.5" />
          </g>
        ) : catLower.includes('trench') || catLower.includes('fur') || catLower.includes('full set') ? (
          /* Floor-Sweeping Trench Coat / Fur Coat / Monolith Full Set */
          <g transform={isProfile ? 'translate(15, 0) scale(0.92, 1)' : ''}>
            {/* Exaggerated Balenciaga-style Power Shoulders & Storm Coat */}
            <path
              d="M 155 62 L 245 62 L 330 98 L 350 325 L 305 330 L 290 165 L 305 420 L 95 420 L 110 165 L 95 330 L 50 325 L 70 98 Z"
              fill={`url(#sheen-${variantKey.replace(/[^a-z0-9]/g, '')})`}
              stroke={accentStroke}
              strokeWidth="1.5"
            />
            {/* Deep Lapels */}
            <polygon points="155,62 200,175 130,135" fill={secondaryFill} stroke={accentStroke} strokeWidth="1.5" />
            <polygon points="245,62 200,175 270,135" fill={secondaryFill} stroke={accentStroke} strokeWidth="1.5" />
            {/* Waist Belt */}
            <rect x="112" y="232" width="176" height="20" fill={primaryFill} stroke={accentStroke} strokeWidth="1.5" />
            <rect x="188" y="229" width="24" height="26" fill="none" stroke="#D4AF37" strokeWidth="2.5" />
          </g>
        ) : (
          /* Boxy Architectural Jacket / Top / Kids Set */
          <g transform={isProfile ? 'translate(15, 0) scale(0.92, 1)' : ''}>
            <path
              d="M 150 75 L 250 75 L 335 112 L 355 345 L 300 350 L 285 175 L 285 365 L 115 365 L 115 175 L 100 350 L 45 345 L 65 112 Z"
              fill={`url(#sheen-${variantKey.replace(/[^a-z0-9]/g, '')})`}
              stroke={accentStroke}
              strokeWidth="1.8"
            />
            {/* Moto / Biker Lapels & Asymmetric Zip */}
            <polygon points="150,75 205,180 135,145" fill={secondaryFill} stroke={accentStroke} strokeWidth="1.5" />
            <polygon points="250,75 195,180 265,145" fill={secondaryFill} stroke={accentStroke} strokeWidth="1.5" />
            <line x1="212" y1="165" x2="212" y2="365" stroke="#D4D4D8" strokeWidth="2" />
            <line x1="140" y1="265" x2="185" y2="285" stroke="#D4D4D8" strokeWidth="2" />
            <line x1="260" y1="265" x2="225" y2="285" stroke="#D4D4D8" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
};

