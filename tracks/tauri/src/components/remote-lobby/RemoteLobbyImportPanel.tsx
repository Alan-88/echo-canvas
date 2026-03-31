import { AlertTriangle, CheckCircle, FileUp } from 'lucide-react';
import type { ValidationResult } from '../../utils/roomValidator';

type ImportState = {
  file: File | null;
  validation: ValidationResult | null;
  error: string;
  isImporting: boolean;
};

type RemoteLobbyImportPanelProps = {
  state: ImportState;
  onSelectFile: (file: File) => void;
  onImport: () => void;
};

export function RemoteLobbyImportPanel({
  state,
  onSelectFile,
  onImport,
}: RemoteLobbyImportPanelProps) {
  return (
    <div className="max-w-2xl space-y-5">
      <label className="block rounded-[28px] border-2 border-dashed border-[#1D5E84]/30 bg-[#E5F6FE]/30 p-8 text-center cursor-pointer hover:border-[#1D5E84] transition-colors">
        <FileUp size={28} className="mx-auto text-[#1D5E84]" />
        <div className="mt-4 font-black text-[#1D5E84]">
          {state.file ? state.file.name : '选择 .whiteboard 文件'}
        </div>
        <div className="mt-2 text-xs font-bold text-lavender">
          文件会导入到当前填写的远端房间号
        </div>
        <input
          type="file"
          accept=".whiteboard"
          className="hidden"
          onChange={(event) => event.target.files?.[0] && onSelectFile(event.target.files[0])}
        />
      </label>

      {state.validation?.valid ? (
        <div className="rounded-3xl bg-green-50 border border-green-200 p-5 space-y-3">
          <div className="flex items-center gap-2 text-green-700 font-bold">
            <CheckCircle size={18} />
            文件结构验证通过
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm font-bold text-ink">
            <div className="rounded-2xl bg-white p-3">
              画布数量: {state.validation.info.canvasCount}
            </div>
            <div className="rounded-2xl bg-white p-3">
              图层数: {state.validation.info.totalLayers}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl bg-red-50 border border-red-200 p-5 text-red-600 font-bold flex items-center gap-2">
          <AlertTriangle size={18} />
          {state.error || '等待文件'}
        </div>
      )}

      <button
        onClick={onImport}
        disabled={!state.validation?.valid || state.isImporting}
        className="w-full h-14 bg-[#1D5E84] text-white rounded-2xl font-black text-lg shadow-xl shadow-[#1D5E84]/20 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state.isImporting ? '导入中...' : '确认导入到远端房间'}
      </button>
    </div>
  );
}
