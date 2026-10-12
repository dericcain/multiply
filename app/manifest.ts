import type { MetadataRoute } from "next"
import manifest from "../lib/manifest.json"

export default function webManifest(): MetadataRoute.Manifest {
  return manifest as MetadataRoute.Manifest
}
