'use client';

import * as React from 'react';
import { QuranStation } from '@/lib/types';
import { STATIONS } from '@/lib/stations-data';
import { cn } from '@/lib/utils';
import { Radio, Mic, BookOpen } from 'lucide-react';

interface StationSelectorProps {
  currentStationId: string;
  onSelectStation: (station: QuranStation) => void;
  disabled?: boolean;
}

export function StationSelector({
  currentStationId,
  onSelectStation,
  disabled,
}: StationSelectorProps) {
  const [filter, setFilter] = React.useState<'all' | 'radio' | 'reciter' | 'tafsir'>('all');

  const filteredStations = STATIONS.filter((s) => {
    if (filter === 'all') return true;
    return s.category === filter;
  });

  return (
    <div className="space-y-3">
      {/* Category filter tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 border border-border/60 w-fit text-xs">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg font-medium transition-all',
            filter === 'all'
              ? 'bg-card text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          جميع المحطات
        </button>
        <button
          type="button"
          onClick={() => setFilter('radio')}
          className={cn(
            'px-3 py-1.5 rounded-lg font-medium transition-all',
            filter === 'radio'
              ? 'bg-card text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          الإذاعات الرسمية
        </button>
        <button
          type="button"
          onClick={() => setFilter('reciter')}
          className={cn(
            'px-3 py-1.5 rounded-lg font-medium transition-all',
            filter === 'reciter'
              ? 'bg-card text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          القراء المشاهير
        </button>
        <button
          type="button"
          onClick={() => setFilter('tafsir')}
          className={cn(
            'px-3 py-1.5 rounded-lg font-medium transition-all',
            filter === 'tafsir'
              ? 'bg-card text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          التفسير والدروس
        </button>
      </div>

      {/* Stations Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {filteredStations.map((station) => {
          const isSelected = station.id === currentStationId;
          const Icon =
            station.category === 'radio'
              ? Radio
              : station.category === 'reciter'
              ? Mic
              : BookOpen;

          return (
            <button
              key={station.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectStation(station)}
              className={cn(
                'group relative text-right p-3.5 rounded-xl border transition-all duration-200 outline-none flex items-start gap-3',
                'hover:border-emerald-500/50 hover:bg-muted/40 disabled:opacity-50',
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-500 shadow-xs'
                  : 'border-border/80 bg-card text-card-foreground'
              )}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                  isSelected
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-muted-foreground group-hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <h4 className={cn('text-xs font-semibold truncate', isSelected ? 'text-emerald-950 dark:text-emerald-200' : 'text-foreground')}>
                    {station.name}
                  </h4>
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {station.reciter || station.country || station.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
