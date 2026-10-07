"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PdfViewer } from "@/components/pdf-viewer";

type Props = {
  url: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
};

export function PdfViewerDialog({ url, open, onOpenChange, title = "Visor de PDF" }: Props) {
  if (!url) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-none w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden gap-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full overflow-hidden">
          <PdfViewer key={url} url={url} title={title} onClose={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
