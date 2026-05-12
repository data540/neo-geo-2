"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { WorkspaceForm } from "@/components/workspace/WorkspaceForm";

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Configura tu marca</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Cuéntanos sobre tu marca para empezar a monitorizar tu visibilidad en IA.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <WorkspaceForm onSuccess={(slug) => router.push(`/${slug}/prompts`)} />
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Podrás añadir competidores y ajustar la configuración después.
        </p>
      </div>
    </div>
  );
}
