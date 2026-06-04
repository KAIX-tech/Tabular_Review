// Ambient types for File System Access API used by project/library file storage.

interface FileSystemWritableFileStream {
  write(data: BlobPart): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface Window {
  showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
}
