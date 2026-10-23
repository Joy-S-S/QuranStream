'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Timer, Check } from 'lucide-react';

interface SleepTimerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeMinutes: number | null;
  onSelectTimer: (minutes: number | null) => void;
}

const TIMER_OPTIONS = [
  { label: '15 دقيقة', value: 15 },
  { label: '30 دقيقة', value: 30 },
  { label: '45 دقيقة', value: 45 },
  { label: 'ساعة كاملة (60 دقيقة)', value: 60 },
  { label: 'ساعة ونصف (90 دقيقة)', value: 90 },
];

export function SleepTimerModal({
  open,
  onOpenChange,
  activeMinutes,
  onSelectTimer,
}: SleepTimerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-5 text-right">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Timer className="h-5 w-5 text-emerald-600" />
            <span>مؤقت الإيقاف التلقائي (مؤقت النوم)</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            حدد مدة الإيقاف التلقائي لتتوقف الإذاعة عن التشغيل تلقائياً.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          {TIMER_OPTIONS.map((opt) => {
            const isSelected = activeMinutes === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onSelectTimer(opt.value);
                  onOpenChange(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                    : 'border-border/70 hover:bg-muted/40 text-foreground'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="h-4 w-4 text-emerald-600" />}
              </button>
            );
          })}

          {activeMinutes !== null && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onSelectTimer(null);
                onOpenChange(false);
              }}
              className="w-full mt-2 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              إلغاء المؤقت
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
