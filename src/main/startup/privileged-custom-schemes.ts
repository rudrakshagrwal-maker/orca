// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import { BROWSER_EXTENSION_API_CUSTOM_SCHEME } from '../browser/extensions/api-runtime/browser-extension-api-scheme'

import { MEDIA_PREVIEW_CUSTOM_SCHEME } from '../media/media-preview-protocol'

/** Registered with doc preview's in one call: each registerSchemesAsPrivileged call replaces the last. */
export const PRIVILEGED_CUSTOM_SCHEMES: Electron.CustomScheme[] = [
  MEDIA_PREVIEW_CUSTOM_SCHEME,

  BROWSER_EXTENSION_API_CUSTOM_SCHEME
]
