export class SandboxPathError extends Error {
  readonly filepath: string
  readonly writableRoots: string[]

  constructor(filepath: string, writableRoots: string[]) {
    super(`Path outside writable roots: ${filepath}`)
    this.name = "SandboxPathError"
    this.filepath = filepath
    this.writableRoots = writableRoots
  }
}
