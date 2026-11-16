import { error } from '../foundation/logger.js';
import {
    assertCurrentChatStore,
    bumpSummaryStoreMutationEpoch,
    isCurrentChatStore,
    saveChatStore,
} from '../foundation/chat-store.js';
import { refreshInjection } from '../foundation/refresh.js';
import { persistChatState } from './persist-state.js';
import { clearAllGhosting, syncGhosting } from './ghosting.js';

/**
 * Snippet Commit seam: the one transaction for every Summaryception snippet
 * mutation. Runs mutate, the Ghosting ownership step, the Mutation Epoch bump,
 * persistence, and the gated injection refresh in a fixed order. Any failing
 * step restores the captured store state, runs the caller's rollback hook,
 * re-saves the store, and rethrows.
 * @param {SummaryceptionStore} store
 * @param {() => void} mutate
 * @param {object} [opts]
 * @param {'sync'|'none'|'clear'} [opts.ghost] - Ghost ownership step: full syncGhosting, skip, or clearAllGhosting. Defaults to 'sync'.
 * @param {'none'|'immediate'|'deferred'} [opts.chatSave] - Chat-file save mode on persist. Defaults to 'none'.
 * @param {import('./notify.js').NotifyAdapter} [opts.notify] - Passed through to the Ghosting steps.
 * @param {import('./foreground-gate.js').ForegroundGate} [opts.gate] - Foreground Gate the Ghosting step defers a hide through; required unless the ghost step is 'none' or 'clear'.
 * @param {() => void} [opts.onRollback] - Extra restoration (e.g. chat array) after store rollback.
 * @returns {Promise<{ epoch: number }>} Throws after rollback when any step fails.
 */
export async function commitSnippetMutation(store, mutate, opts = {}) {
    const { ghost = 'sync', chatSave = 'none', notify, onRollback, gate } = opts;
    assertCurrentChatStore(store);

    // The rollback point is one level deep. In-place snippet field edits must
    // roll back, so snippets are shallow-copied with their id arrays duplicated.
    const rollbackPoint = {
        layers: store.layers.map((layer) =>
            layer?.map((snippet) => ({
                ...snippet,
                sourceMessageIds: [...(snippet.sourceMessageIds || [])],
            })),
        ),
        ghostedMessageIds: [...(store.ghostedMessageIds || [])],
        mutationEpoch: store.mutationEpoch,
    };

    try {
        mutate();
        if (ghost === 'sync') {
            if (!gate) {
                throw new Error(
                    'commitSnippetMutation needs a Foreground Gate to sync Ghosting ownership.',
                );
            }
            await syncGhosting({ notify, gate });
        } else if (ghost === 'clear') {
            await clearAllGhosting();
        }
        assertCurrentChatStore(store);
        bumpSummaryStoreMutationEpoch(store);
        if (chatSave === 'none') {
            await saveChatStore(store);
        } else {
            await persistChatState({ chatSave, store });
        }
        assertCurrentChatStore(store);
        refreshInjection({ logMemoryStatus: true });
        return { epoch: store.mutationEpoch };
    } catch (err) {
        store.layers = rollbackPoint.layers;
        store.ghostedMessageIds = rollbackPoint.ghostedMessageIds;
        store.mutationEpoch = rollbackPoint.mutationEpoch;
        error('Snippet commit failed, rolling back store state:', err);
        try {
            // A host may reuse its chat array when switching conversations.
            // Never run an old chat-array rollback or save against the new chat.
            if (isCurrentChatStore(store)) {
                await onRollback?.();
                if (isCurrentChatStore(store)) {
                    await saveChatStore(store);
                }
            }
        } catch (rollbackError) {
            error('Could not persist the snippet rollback:', rollbackError);
        }
        throw err;
    }
}
