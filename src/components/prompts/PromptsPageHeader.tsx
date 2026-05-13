import { AddPromptButton } from "./AddPromptButton";
import { BulkUploadPromptsButton } from "./BulkUploadPromptsButton";

interface Props {
  workspaceId: string;
  workspaceCountry: string;
  totalActive: number;
}

export function PromptsPageHeader({ workspaceId, workspaceCountry, totalActive }: Props) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Prompts</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {totalActive} prompt{totalActive !== 1 ? "s" : ""} activo
          {totalActive !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <BulkUploadPromptsButton workspaceId={workspaceId} workspaceCountry={workspaceCountry} />
        <AddPromptButton workspaceId={workspaceId} workspaceCountry={workspaceCountry} />
      </div>
    </div>
  );
}
