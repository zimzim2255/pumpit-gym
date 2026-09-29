import { XCircle } from "lucide-react";
import type { ReactNode } from "react";

interface ModalCardProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  size?: "md" | "lg" | "xl";
}

export default function ModalCard({ title, onClose, children, wide, size = "md" }: ModalCardProps) {
  const width = size === "xl" ? "max-w-[1400px]" : size === "lg" ? "max-w-6xl" : wide ? "max-w-6xl" : "max-w-3xl";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`w-full ${width} bg-card border border-white/10 rounded-3xl shadow-2xl overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
