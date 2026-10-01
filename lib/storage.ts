const BYTES_PER_MB = 1024 * 1024

export function textStorageMB(text: string | null | undefined): number {
  return Buffer.byteLength(text || "", "utf8") / BYTES_PER_MB
}