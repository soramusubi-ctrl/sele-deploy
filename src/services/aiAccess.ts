// Operator-issued application access code only. NEVER enter a Gemini/provider key.
// Memory only: refresh/reload locks access; no local/session storage or URL sharing.
let accessCode = '';
export function setAccessCode(value: string) { accessCode = value; }
export function getAccessCode() { return accessCode; }
