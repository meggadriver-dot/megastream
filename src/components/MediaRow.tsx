import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { MediaItem } from '../../shared/types';
import { MediaCard } from './MediaCard';

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  seeMoreTo?: string;
}

export function MediaRow({ title, items, seeMoreTo }: MediaRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
          {title}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          {seeMoreTo && (
            <Link
              to={seeMoreTo}
              className="text-xs sm:text-sm font-medium text-sky-400 hover:text-sky-300 transition-colors whitespace-nowrap px-2 py-1"
            >
              Ver mais
            </Link>
          )}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollBy(-420)}
              aria-label={`Rolar ${title} para a esquerda`}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl ms-glass text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(420)}
              aria-label={`Rolar ${title} para a direita`}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl ms-glass text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto ms-scrollbar-hide pb-2"
      >
        {items.map((item) => (
          <MediaCard key={`${item.mediaType}-${item.tmdbId}`} item={item} compact />
        ))}
      </div>
    </section>
  );
}
