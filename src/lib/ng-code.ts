export const CODE_PREFIX = "NG-";
export const MAX_CODE_LENGTH = 64;

/** Turns what someone typed into a full code that starts with "NG-" (spaces removed). */
export function toNgCode(raw: string) {
  const compact = raw.replace(/\s+/g, "");
  const rest = compact.toUpperCase().startsWith(CODE_PREFIX) ? compact.slice(CODE_PREFIX.length) : compact;
  return rest ? CODE_PREFIX + rest : "";
}

/** The part after "NG-", for showing inside the input next to the fixed prefix. */
export function stripNgPrefix(code: string) {
  return code.toUpperCase().startsWith(CODE_PREFIX) ? code.slice(CODE_PREFIX.length) : code;
}

/** Valid codes start with "NG-", have something after it, no spaces, and are at most 64 characters. */
export function isValidNgCode(code: string) {
  return /^NG-\S+$/.test(code) && code.length <= MAX_CODE_LENGTH;
}
