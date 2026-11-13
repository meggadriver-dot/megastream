import React from 'react';
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DemoBannerProps {
  visible: boolean;
}

export function DemoBanner({ visible }: DemoBannerProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      className="rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm ms-glass"
    >
      <div className="flex items-center gap-2.5 text-sky-200">
        <Info className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
        <span>
          <strong>Modo Demonstração ativo:</strong> exibindo catálogo de referência com IDs reais do TMDB. Configure <code className="font-mono-tabular text-sky-300">TMDB_ACCESS_TOKEN</code> nos Secrets do servidor para sincronizar o catálogo completo ao vivo.
        </span>
      </div>
      <Link
        to="/admin"
        className="text-xs font-semibold text-sky-300 hover:text-white underline whitespace-nowrap shrink-0"
      >
        Ver status das integrações
      </Link>
    </div>
  );
}
