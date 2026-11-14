import { describe, expect, it } from 'vitest';

import { buildSummarizerPipelineInput } from '../src/core/summarizer-pipeline.js';
import { defaultSettings } from '../src/foundation/constants.js';
import { installSummaryContext, makeSummarySettings } from './test-helpers.js';

describe('buildSummarizerPipelineInput', () => {
    it('routes the auditor call category to the auditor prompts with substitution', async () => {
        installSummaryContext();

        const request = await buildSummarizerPipelineInput({
            storyTxt: 'USER TURN',
            contextStr: 'PRIOR STATE',
            metadata: { kind: 'auditor' },
        });

        expect(request.profile.policy.systemPrompt).toBe(defaultSettings.auditorSystemPrompt);
        expect(request.prompt).toContain('PRIOR STATE');
        expect(request.prompt).toContain('USER TURN');
        expect(request.repairPrompt).toBe('');
    });

    it('keeps replacement tokens and placeholders in inserted text literal', async () => {
        const template = 'BEGIN\n{{story_txt}}\n{{context_str}}\nEND';
        installSummaryContext();
        const storyTxt = 'STORY $& $$ {{story_txt}} {{context_str}} {{player_name}}';
        const contextStr = 'CONTEXT $& $$ {{story_txt}} {{context_str}}';

        const request = await buildSummarizerPipelineInput({
            storyTxt,
            contextStr,
            metadata: { kind: 'auditor' },
            settings: makeSummarySettings({ auditorUserPrompt: template }),
        });

        expect(request.prompt.startsWith(`BEGIN\n${storyTxt}\n${contextStr}\nEND`)).toBe(true);
    });
});
