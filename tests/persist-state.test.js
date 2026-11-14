import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    flushPendingChatSave,
    initChatPersistence,
    persistChatState,
} from '../src/core/persist-state.js';
import { warn } from '../src/foundation/logger.js';
import { deferred, installSummaryContext, makeChatPersistence } from './test-helpers.js';

let saveChat;
let saveMetadata;

beforeEach(() => {
    vi.useFakeTimers();
    ({ saveChat, saveMetadata } = makeChatPersistence());
});

afterEach(() => {
    vi.useRealTimers();
});

describe('Chat Persistence init seam', () => {
    it('saves metadata and chat immediately without advancing timers', async () => {
        await persistChatState();

        expect(saveMetadata).toHaveBeenCalledOnce();
        expect(saveChat).toHaveBeenCalledOnce();
    });

    it('defers the chat write past the debounce window', async () => {
        await persistChatState({ chatSave: 'deferred' });

        expect(saveMetadata).toHaveBeenCalledOnce();
        expect(saveChat).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1499);
        expect(saveChat).not.toHaveBeenCalled();

        await vi.runAllTimersAsync();
        expect(saveChat).toHaveBeenCalledOnce();
    });

    it('coalesces back-to-back deferred persists into one chat write', async () => {
        await persistChatState({ chatSave: 'deferred' });
        await persistChatState({ chatSave: 'deferred' });

        expect(saveMetadata).toHaveBeenCalledTimes(2);

        await vi.runAllTimersAsync();
        expect(saveChat).toHaveBeenCalledOnce();
    });

    it('flushes a pending chat write once', async () => {
        await persistChatState({ chatSave: 'deferred' });

        await flushPendingChatSave();
        expect(saveChat).toHaveBeenCalledOnce();

        await flushPendingChatSave();
        expect(saveChat).toHaveBeenCalledOnce();
    });

    it('treats a flush with nothing pending as a no-op', async () => {
        await flushPendingChatSave();

        expect(saveChat).not.toHaveBeenCalled();
    });

    it('catches a rejecting background chat write and retries it on flush', async () => {
        const boom = new Error('boom');
        saveChat.mockRejectedValueOnce(boom);
        await persistChatState({ chatSave: 'deferred' });

        await vi.runAllTimersAsync();
        expect(warn).toHaveBeenCalledWith('Could not save chat:', boom);
        expect(saveChat).toHaveBeenCalledOnce();

        await flushPendingChatSave();
        expect(saveChat).toHaveBeenCalledTimes(2);
    });

    it('keeps the save failure when the failure notice throws', async () => {
        const boom = new Error('boom');
        const notifyError = new Error('notice failed');
        const onChatSaveError = vi.fn(() => {
            throw notifyError;
        });
        initChatPersistence({ saveChat, saveMetadata, onChatSaveError });
        saveChat.mockRejectedValueOnce(boom);

        await persistChatState({ chatSave: 'deferred' });
        await vi.runAllTimersAsync();

        expect(onChatSaveError).toHaveBeenCalledWith(boom);
        expect(warn).toHaveBeenCalledWith('Could not save chat:', boom);
        expect(warn).toHaveBeenCalledWith('Could not notify chat save failure:', notifyError);

        await flushPendingChatSave();
        expect(saveChat).toHaveBeenCalledTimes(2);
    });

    it.each(['immediate', 'deferred'])(
        'rejects a stale %s save after a chat switch without touching the new pending save',
        async (chatSave) => {
            const metadataGate = deferred();
            saveMetadata.mockImplementationOnce(() => metadataGate.promise);

            const staleSave = persistChatState({ chatSave });
            installSummaryContext();
            await persistChatState({ chatSave: 'deferred' });

            metadataGate.resolve();
            await expect(staleSave).rejects.toThrow('The chat changed');
            expect(saveChat).not.toHaveBeenCalled();

            await flushPendingChatSave();
            expect(saveChat).toHaveBeenCalledOnce();
        },
    );

    it('serializes an immediate save behind an in-flight background save and keeps its retry state', async () => {
        const backgroundGate = deferred();
        const saveFailure = new Error('new write failed');
        saveChat
            .mockImplementationOnce(() => backgroundGate.promise)
            .mockRejectedValueOnce(saveFailure);
        await persistChatState({ chatSave: 'deferred' });
        await vi.advanceTimersByTimeAsync(1500);
        expect(saveChat).toHaveBeenCalledOnce();

        const immediateSave = persistChatState();
        expect(saveChat).toHaveBeenCalledOnce();

        backgroundGate.resolve();
        await expect(immediateSave).rejects.toBe(saveFailure);
        expect(saveChat).toHaveBeenCalledTimes(2);

        await flushPendingChatSave();
        expect(saveChat).toHaveBeenCalledTimes(3);
    });
    it('does not write to another chat after waiting for an older write', async () => {
        const backgroundGate = deferred();
        saveChat.mockImplementationOnce(() => backgroundGate.promise);
        await persistChatState({ chatSave: 'deferred' });
        await vi.advanceTimersByTimeAsync(1500);
        const queuedSave = flushPendingChatSave();
        installSummaryContext();
        const rejected = expect(queuedSave).rejects.toThrow('The chat changed');
        backgroundGate.resolve();
        await rejected;
        expect(saveChat).toHaveBeenCalledOnce();
    });
});
