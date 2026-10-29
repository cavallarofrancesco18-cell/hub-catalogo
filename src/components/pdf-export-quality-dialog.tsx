'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  HIGH_PDF_EXPORT_PROFILE,
  STANDARD_PDF_EXPORT_PROFILE,
  type PdfExportProfile,
} from '@/lib/pdf-export-quality';

export type PdfExportQualityChoice = 'standard' | 'high';

function choiceToProfile(choice: PdfExportQualityChoice): PdfExportProfile {
  return choice === 'high' ? HIGH_PDF_EXPORT_PROFILE : STANDARD_PDF_EXPORT_PROFILE;
}

function PdfExportQualityDialogView({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (choice: PdfExportQualityChoice) => void;
}) {
  const [choice, setChoice] = useState<PdfExportQualityChoice>('high');

  useEffect(() => {
    if (open) {
      setChoice('high');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Qualità PDF</DialogTitle>
          <DialogDescription>
            Scegli tra un file più leggero o una resa più nitida.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={choice} onValueChange={value => setChoice(value as PdfExportQualityChoice)} className="space-y-3">
          <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <RadioGroupItem value="standard" className="mt-1" />
            <span>
              <span className="block font-medium">Standard</span>
              <span className="block text-sm text-muted-foreground">
                Più veloce da generare, file più leggero.
              </span>
            </span>
          </Label>

          <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <RadioGroupItem value="high" className="mt-1" />
            <span>
              <span className="block font-medium">Alta qualità</span>
              <span className="block text-sm text-muted-foreground">
                Più nitido, adatto alla stampa, file più pesante.
              </span>
            </span>
          </Label>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={() => onConfirm(choice)}
          >
            Continua
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function usePdfExportQualityDialog() {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((profile: PdfExportProfile | null) => void) | null>(null);

  const requestPdfExportProfile = useCallback(() => {
    return new Promise<PdfExportProfile | null>(resolve => {
      resolverRef.current = resolve;
      setOpen(true);
    });
  }, []);

  const handleConfirm = useCallback((choice: PdfExportQualityChoice) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);

    if (resolver) {
      resolver(choiceToProfile(choice));
    }
  }, []);

  const handleCancel = useCallback(() => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);

    if (resolver) {
      resolver(null);
    }
  }, []);

  const dialog = useMemo(
    () => (
      <PdfExportQualityDialogView
        open={open}
        onOpenChange={nextOpen => {
          if (!nextOpen) {
            handleCancel();
            return;
          }
          setOpen(nextOpen);
        }}
        onConfirm={handleConfirm}
      />
    ),
    [handleConfirm, handleCancel, open]
  );

  return {
    requestPdfExportProfile,
    pdfExportQualityDialog: dialog,
  };
}
