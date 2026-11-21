export const CODE_PREFIX = "NG-";
export const MAX_CODE_LENGTH = 64;

/** Cleans what someone typed: removes spaces and writes the "NG-" start in capitals. Never adds "NG-" itself. */
export function cleanTypedCode(raw: string) {
  const compact = raw.replace(/\s+/g, "");
  return compact.toUpperCase().startsWith(CODE_PREFIX) ? CODE_PREFIX + compact.slice(CODE_PREFIX.length) : compact;
}

/** Valid codes start with "NG-", have something after it, no spaces, and are at most 64 characters. */
export function isValidNgCode(code: string) {
  return /^NG-\S+$/.test(code) && code.length <= MAX_CODE_LENGTH;
}
