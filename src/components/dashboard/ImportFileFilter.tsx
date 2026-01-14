import { FileSpreadsheet } from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";

const ImportFileFilter = () => {
  const { importedFiles, selectedImportFile, setSelectedImportFile } = useDashboard();

  if (importedFiles.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
      <select
        value={selectedImportFile}
        onChange={(e) => setSelectedImportFile(e.target.value)}
        className="h-9 px-3 rounded-md border border-input bg-background text-sm min-w-[200px]"
      >
        <option value="">Todos os arquivos</option>
        {importedFiles.map((file) => (
          <option key={file.id} value={file.id}>
            {file.file_name} ({file.successful_records.toLocaleString("pt-BR")} leads)
          </option>
        ))}
      </select>
    </div>
  );
};

export default ImportFileFilter;
