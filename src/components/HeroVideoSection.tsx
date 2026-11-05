import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { RoutePath } from '../types/samo';
import { ProductImage } from './ProductImage';

interface HeroVideoSectionProps {
  onNavigate: (route: RoutePath) => void;
  onSelectCategory: (catName: string) => void;
  mediaType?: 'video' | 'image';
  videoUrl?: string;
  imageUrl?: string;
  kicker?: string;
  title?: string;
}

export const DEFAULT_HERO_VIDEO = '/assets/aistudio/recording-2026-10-20_ae756f63.webm';

export const HeroVideoSection: React.FC<HeroVideoSectionProps> = ({
  onNavigate,
  onSelectCategory,
  mediaType = 'video',
  videoUrl = DEFAULT_HERO_VIDEO,
  imageUrl = 'studio://women-jacket-black-leather-biker',
  kicker = 'SAMO ATELIER · CLASSIC · SPORT CHIC · FINE LEATHER · SUEDE · FUR',
  title = 'NEW ARRIVALS',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [customVideoFailed, setCustomVideoFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const requestedVideoUrl = (videoUrl || DEFAULT_HERO_VIDEO).trim();
  const effectiveVideoUrl = customVideoFailed
    ? DEFAULT_HERO_VIDEO
    : requestedVideoUrl;
  const isDefaultClip = effectiveVideoUrl === DEFAULT_HERO_VIDEO;

  useEffect(() => {
    setCustomVideoFailed(false);
    setVideoFailed(false);
    setIsPlaying(true);
  }, [requestedVideoUrl, mediaType]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const showImageBanner = mediaType === 'image' || videoFailed;

  return (
    <section className="relative w-full h-[74vh] min-h-[520px] max-h-[820px] bg-zinc-950 overflow-hidden border-b border-zinc-950">
      {/* Background Video or Admin-Selected Image Banner */}
      {!showImageBanner ? (
        <video
          key={effectiveVideoUrl}
          ref={videoRef}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          preload="auto"
          onTimeUpdate={(e) => {
            if (!isDefaultClip) return;
            const vid = e.currentTarget;
            if (vid.currentTime < 0.2 || vid.currentTime > 2.8) {
              vid.currentTime = 0.25;
            }
          }}
          onLoadedMetadata={(e) => {
            if (isDefaultClip) {
              e.currentTarget.currentTime = 0.25;
            }
          }}
          onError={(e) => {
            console.warn('[SAMO Atelier] Hero video playback notice:', e);
            if (!effectiveVideoUrl || effectiveVideoUrl === '') {
              setCustomVideoFailed(true);
            }
          }}
          className={`h-full w-full object-cover opacity-90 ${
            isDefaultClip ? 'object-[50%_75%] scale-[1.24] origin-bottom' : 'object-center'
          }`}
        >
          {effectiveVideoUrl.toLowerCase().endsWith('.webm') && (
            <source src={effectiveVideoUrl} type="video/webm" />
          )}
          {effectiveVideoUrl.toLowerCase().endsWith('.mov') && (
            <source src={effectiveVideoUrl} type="video/quicktime" />
          )}
          {(effectiveVideoUrl.toLowerCase().endsWith('.hevc') ||
            effectiveVideoUrl.toLowerCase().endsWith('.m4v')) && (
            <source src={effectiveVideoUrl} type='video/mp4; codecs="hevc"' />
          )}
          <source src={effectiveVideoUrl} type="video/mp4" />
          <source src={effectiveVideoUrl} />
        </video>
      ) : (
        <div className="h-full w-full opacity-90">
          <ProductImage
            src={imageUrl || 'studio://women-jacket-black-leather-biker'}
            alt={title || 'SAMO Campaign Hero'}
            category="Jacket"
            styleType="Fine Leather"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Measured contrast scrim for 4.5:1 legibility across all frames */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/25" />

      {/* Top-Right Video Controls (Play/Pause & Mute/Unmute when in video mode) */}
      {!showImageBanner && (
        <div className="absolute top-5 right-5 z-20 flex items-center gap-2.5">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause campaign video' : 'Play campaign video'}
            className="w-10 h-10 rounded-full bg-black/55 hover:bg-black/80 text-white border border-white/25 flex items-center justify-center transition-colors cursor-pointer"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute campaign video' : 'Mute campaign video'}
            className="w-10 h-10 rounded-full bg-black/55 hover:bg-black/80 text-white border border-white/25 flex items-center justify-center transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Bottom-Center Campaign Title & Dual Rectangular White CTA Buttons */}
      <div className="absolute inset-x-0 bottom-10 z-20 flex flex-col items-center px-4 text-center">
        <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-zinc-200 mb-2">
          {kicker}
        </p>
        <h1
          className="font-display text-white font-extrabold tracking-[0.14em] uppercase mb-6"
          style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', textWrap: 'balance' }}
        >
          {title}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <button
            type="button"
            onClick={() => {
              onNavigate('/women');
              onSelectCategory('all');
            }}
            className="min-w-[168px] px-7 py-3.5 bg-white text-zinc-950 border border-zinc-950 text-xs font-bold tracking-[0.14em] uppercase hover:bg-zinc-950 hover:text-white hover:border-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Shop Women
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigate('/kids');
              onSelectCategory('all');
            }}
            className="min-w-[168px] px-7 py-3.5 bg-white text-zinc-950 border border-zinc-950 text-xs font-bold tracking-[0.14em] uppercase hover:bg-zinc-950 hover:text-white hover:border-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Shop Kids
          </button>
        </div>
      </div>
    </section>
  );
};

