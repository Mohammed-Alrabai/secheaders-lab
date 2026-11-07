/**
 * Size limits shared by the scanner and the API/client schemas. Kept free of imports so
 * client code can use them without pulling in Node-only modules.
 */

/** SC-01: maximum accepted URL length (after trimming). */
export const MAX_URL_LENGTH = 2048

/** `02` §4: evidence values are truncated to 512 characters. */
export const EVIDENCE_MAX = 512

/** SC-20: raw header values are truncated to 2 KB for display. */
export const RAW_HEADER_MAX = 2048

/** SC-23: maximum request body size for `POST /api/scan`. */
export const MAX_REQUEST_BYTES = 4096
