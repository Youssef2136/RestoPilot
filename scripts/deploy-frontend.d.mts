/** Type surface of scripts/deploy-frontend.mjs consumed by the guard suite (spec 018 T007). */
export declare type DeployManifestEntry = { path: string; bytes: number }

export declare function collectManifest(dir?: string, base?: string): DeployManifestEntry[]

export declare function validateBundle(
  dir?: string,
): { ok: true; manifest: DeployManifestEntry[] } | { ok: false; reason: string }

export declare function missingCredentials(env?: Record<string, string | undefined>): string[]
