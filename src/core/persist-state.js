import { warn } from '../foundation/logger.js';
import { getChatStore } from '../foundation/chat-store.js';

const CHAT_SAVE_DEBOUNCE_MS = 1500;

/** @typedef {'immediate' | 'deferred'} ChatSaveMode */

/**
 * One deferred chat write. `store` is the Chat Store that owned the mutation,
 * so a chat switch never spends this write on a different chat. `timer` is null
 * while a write runs, after a failed background write, or during an immediate
 * write, when the pending entry waits for an explicit flush. `write` is the
 * in-flight write; later writes for the same entry queue behind it so an older
 * completion never clears a newer mutation's retry state.
 * @type {{ store: SummaryceptionStore, timer: ReturnType<typeof setTimeout> | null, write: Promise<void> | null } | null}
 */
let pendingChatSave = null;

/**
 * Host save functions and the optional entry-owned failure notice; the
 * composition root initializes this one holder (ADR-0031), tests re-initialize
 * it through the same seam.
 * @type {{ saveChat: () => Promise<void>, saveMetadata: () => Promise<void>, onChatSaveError?: (error: unknown) => void } | null}
 */
let persistence = null;

/**
 * @param {{ saveChat: () => Promise<void>, saveMetadata: () => Promise<void>, onChatSaveError?: (error: unknown) => void }} host
 * @returns {void}
 */
export function initChatPersistence({ saveChat, saveMetadata, onChatSaveError = undefined }) {
    clearPendingChatSave();
    persistence = { saveChat, saveMetadata, onChatSaveError };
}

/**
 * @returns {{ saveChat: () => Promise<void>, saveMetadata: () => Promise<void>, onChatSaveError?: (error: unknown) => void }}
 */
function requirePersistence() {
    if (!persistence) {
        throw new Error(
            'Chat Persistence is not initialized; the composition root must call initChatPersistence first.',
        );
    }
    return persistence;
}

/**
 * Persist chat metadata and chat state in one step. Metadata is always saved
 * immediately; chat file writes may be deferred. The two writes are not an
 * atomic transaction: metadata may already be saved when the chat write fails.
 * @param {{ chatSave?: ChatSaveMode }} [options]
 * @returns {Promise<void>} Rejects when either required write fails.
 */
export async function persistChatState({ chatSave = 'immediate' } = {}) {
    const store = getChatStore();
    await requirePersistence().saveMetadata();
    if (store !== getChatStore()) {
        throw new Error(
            'The chat changed while metadata was saving; the stale chat save was skipped.',
        );
    }

    if (chatSave === 'deferred') {
        scheduleChatSave(store);
        return;
    }

    await saveChatImmediately(store);
}

/**
 * Write any pending chat state now. A pending write left by a failed
 * background save is retried; a pending write for another chat is discarded
 * instead of saving the new chat with it.
 * @returns {Promise<void>} Rejects when the retried write fails.
 */
export async function flushPendingChatSave() {
    const pending = pendingChatSave;
    if (!pending) {
        return;
    }

    if (pending.store !== getChatStore()) {
        clearPendingChatSave();
        return;
    }

    clearScheduledChatSaveTimer();
    await savePendingChat(pending);
}

/**
 * @param {SummaryceptionStore} store
 * @returns {Promise<void>}
 */
async function saveChatImmediately(store) {
    if (store !== getChatStore()) {
        throw new Error(
            'The chat changed while metadata was saving; the stale chat save was skipped.',
        );
    }
    clearScheduledChatSaveTimer();
    const pending = ensurePendingChatSave(store);
    await savePendingChat(pending);
}

/**
 * @param {SummaryceptionStore} store
 * @returns {{ store: SummaryceptionStore, timer: ReturnType<typeof setTimeout> | null, write: Promise<void> | null }}
 */
function ensurePendingChatSave(store) {
    let pending = pendingChatSave;
    if (!pending || pending.store !== store) {
        clearPendingChatSave();
        pending = { store, timer: null, write: null };
        pendingChatSave = pending;
    }
    return pending;
}

/**
 * @param {SummaryceptionStore} store
 * @returns {void}
 */
function scheduleChatSave(store) {
    clearPendingChatSave();
    const pending = {
        store,
        timer: /** @type {ReturnType<typeof setTimeout> | null} */ (null),
        write: /** @type {Promise<void> | null} */ (null),
    };
    pendingChatSave = pending;
    pending.timer = setTimeout(() => {
        if (pendingChatSave !== pending) {
            return;
        }
        pending.timer = null;
        void saveChatInBackground(pending);
    }, CHAT_SAVE_DEBOUNCE_MS);
}

/**
 * Serialize writes for the same pending entry. A later mutation still issues
 * its own save after the older write settles; an older success only clears the
 * entry when no newer write is waiting.
 * @param {{ store: SummaryceptionStore, timer: ReturnType<typeof setTimeout> | null, write: Promise<void> | null }} pending
 * @returns {Promise<void>}
 */
async function savePendingChat(pending) {
    const previous = pending.write;
    const write = (async () => {
        if (previous) {
            try {
                await previous;
            } catch {
                // The older write reports its own failure; this call retries
                // for the newer mutation instead of inheriting that outcome.
            }
        }
        if (pending.store !== getChatStore()) {
            throw new Error(
                'The chat changed while waiting to save; the stale chat save was skipped.',
            );
        }
        await requirePersistence().saveChat();
    })();
    pending.write = write;

    try {
        await write;
    } finally {
        if (pending.write === write) {
            pending.write = null;
        }
    }

    if (!pending.write && pendingChatSave === pending) {
        clearPendingChatSave();
    }
}

/**
 * @param {{ store: SummaryceptionStore, timer: ReturnType<typeof setTimeout> | null, write: Promise<void> | null }} pending
 * @returns {Promise<void>}
 */
async function saveChatInBackground(pending) {
    try {
        if (pending.store !== getChatStore()) {
            if (pendingChatSave === pending) {
                clearPendingChatSave();
            }
            return;
        }
        await savePendingChat(pending);
    } catch (e) {
        warn('Could not save chat:', e);
        notifyChatSaveFailure(e);
        // Keep the failed pending entry for the same chat. No timer is
        // scheduled here, so only an explicit later flush or save retries it.
    }
}

/**
 * Never let the entry-owned notice replace the original save failure.
 * @param {unknown} error
 * @returns {void}
 */
function notifyChatSaveFailure(error) {
    const notify = persistence?.onChatSaveError;
    if (typeof notify !== 'function') {
        return;
    }

    try {
        notify(error);
    } catch (notifyError) {
        warn('Could not notify chat save failure:', notifyError);
    }
}

/**
 * @returns {void}
 */
function clearScheduledChatSaveTimer() {
    if (!pendingChatSave?.timer) {
        return;
    }

    clearTimeout(pendingChatSave.timer);
    pendingChatSave.timer = null;
}

/**
 * @returns {void}
 */
function clearPendingChatSave() {
    if (!pendingChatSave) {
        return;
    }

    if (pendingChatSave.timer) {
        clearTimeout(pendingChatSave.timer);
    }
    pendingChatSave = null;
}
