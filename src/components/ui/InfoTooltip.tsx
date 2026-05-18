"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  content: string;
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger
          className="inline-flex items-center text-slate-400 hover:text-slate-600 transition-colors ml-1.5"
          aria-label="Información"
        >
          <Info className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[200px] text-center">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
