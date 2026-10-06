// The browser manages the HttpOnly ownership cookie; no secret is exposed to JS.
// Recheck before each operation so reloads/expiry need no user-entered code.
let pending: Promise<void> | undefined;
export function ensureAiSession(): Promise<void> {
    const bootstrap = async () => {
        const response = await fetch('/api/session', {
            method: 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: { 'Content-Type': 'application/json' }, body: '{}',
            signal: AbortSignal.timeout(10000),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'AIサーバーに接続できません。管理者に設定を確認してください。');
    };
    // Serialize first cookie issuance across tabs where Web Locks are supported.
    if (!pending) pending = (typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request('sele-ai-session', bootstrap).then(() => undefined) : bootstrap()
    ).finally(() => { pending = undefined; });
    return pending;
}
