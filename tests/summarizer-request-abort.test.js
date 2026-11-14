import { beforeEach, describe, expect, it, vi } from 'vitest';

const runnerMocks = vi.hoisted(() => ({
    run: vi.fn(),
}));
vi.mock('../src/core/request-runner.js', () => ({
    RequestRunner: class {
        run(request) {
            return runnerMocks.run(request);
        }
    },
}));

const pipelineMocks = vi.hoisted(() => ({
    buildSummarizerPipelineInput: vi.fn(),
    traceSummarizerInputTokens: vi.fn(),
}));
vi.mock('../src/core/summarizer-pipeline.js', () => pipelineMocks);

import { deferred, makeSummarizerDispatch } from './test-helpers.js';

beforeEach(() => {
    runnerMocks.run.mockReset();
    pipelineMocks.traceSummarizerInputTokens.mockReset();
    pipelineMocks.traceSummarizerInputTokens.mockResolvedValue(undefined);
    pipelineMocks.buildSummarizerPipelineInput.mockReset();
    pipelineMocks.buildSummarizerPipelineInput.mockResolvedValue({
        prompt: 'prompt',
        repairPrompt: '',
        profile: { policy: {} },
    });
});

describe('Summarizer Dispatch abort before the runner', () => {
    it('returns aborted for an already-aborted external signal without invoking the runner', async () => {
        const dispatch = await makeSummarizerDispatch();
        const controller = new AbortController();
        controller.abort();

        const outcome = await dispatch.call({
            storyTxt: 'story',
            contextStr: 'context',
            signal: controller.signal,
        });

        expect(outcome).toEqual({ status: 'aborted' });
        expect(pipelineMocks.traceSummarizerInputTokens).not.toHaveBeenCalled();
        expect(pipelineMocks.buildSummarizerPipelineInput).not.toHaveBeenCalled();
        expect(runnerMocks.run).not.toHaveBeenCalled();
        expect(dispatch.isLive()).toBe(false);
    });

    it('returns aborted when dispatch.abort fires during preparation', async () => {
        const traceGate = deferred();
        pipelineMocks.traceSummarizerInputTokens.mockImplementationOnce(() => traceGate.promise);
        const dispatch = await makeSummarizerDispatch();

        const pending = dispatch.call({ storyTxt: 'story', contextStr: 'context' });
        expect(dispatch.isLive()).toBe(true);

        dispatch.abort();
        traceGate.resolve();

        await expect(pending).resolves.toEqual({ status: 'aborted' });
        expect(pipelineMocks.buildSummarizerPipelineInput).not.toHaveBeenCalled();
        expect(runnerMocks.run).not.toHaveBeenCalled();
        expect(dispatch.isLive()).toBe(false);
    });

    it('returns aborted when the external signal aborts during preparation', async () => {
        const buildGate = deferred();
        pipelineMocks.buildSummarizerPipelineInput.mockImplementationOnce(() => buildGate.promise);
        const dispatch = await makeSummarizerDispatch();
        const controller = new AbortController();

        const pending = dispatch.call({
            storyTxt: 'story',
            contextStr: 'context',
            signal: controller.signal,
        });
        await vi.waitFor(() => {
            expect(pipelineMocks.buildSummarizerPipelineInput).toHaveBeenCalledOnce();
        });

        controller.abort();
        buildGate.resolve();

        await expect(pending).resolves.toEqual({ status: 'aborted' });
        expect(runnerMocks.run).not.toHaveBeenCalled();
        expect(dispatch.isLive()).toBe(false);
    });
});
