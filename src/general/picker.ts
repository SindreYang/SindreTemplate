import { save, type SaveDestination } from "./io.js";

export interface FilePickerType {
  description?: string;
  accept: Record<string, string[]>;
}

export interface SavePickerOptions {
  suggestedName: string;
  types?: FilePickerType[];
}

type SavePicker = (options?: SavePickerOptions) => Promise<FileSystemFileHandle>;
export type SaveFileWriter = (value: unknown, destination: SaveDestination) => Promise<void>;

/** Opens the browser save picker and writes through the same general save adapter. */
export async function save_file_with_picker(value: unknown, options: SavePickerOptions, writer: SaveFileWriter = save): Promise<void> {
  const picker = (globalThis as typeof globalThis & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (!picker) throw new Error("File System Access save picker is unavailable");
  const handle = await picker(options);
  await writer(value, handle as SaveDestination);
}
