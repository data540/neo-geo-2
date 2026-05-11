interface Step {
  number: number;
  label: string;
}

const STEPS: Step[] = [
  { number: 1, label: "Contexto" },
  { number: 2, label: "Candidatos" },
  { number: 3, label: "Cobertura" },
  { number: 4, label: "Priorizar" },
];

interface Props {
  currentStep: number;
}

export function WizardStepIndicator({ currentStep }: Props) {
  return (
    <nav aria-label="Pasos del asistente">
      <ol className="flex items-center gap-0">
        {STEPS.map((step, index) => {
          const done = step.number < currentStep;
          const active = step.number === currentStep;
          const isLast = index === STEPS.length - 1;

          return (
            <li key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                    done
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : active
                        ? "bg-white border-indigo-600 text-indigo-600"
                        : "bg-white border-slate-200 text-slate-400"
                  }`}
                >
                  {done ? (
                    <svg
                      aria-hidden="true"
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`text-xs mt-1 font-medium ${
                    active ? "text-indigo-600" : done ? "text-slate-600" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div
                  className={`h-0.5 w-16 mx-2 mb-4 transition-colors ${
                    done ? "bg-indigo-600" : "bg-slate-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
