import {
    DEFAULT_AUDITOR_SYSTEM_PROMPT,
    DEFAULT_AUDITOR_USER_PROMPT,
    DEFAULT_INJECTION_TEMPLATE,
    DEFAULT_PROMOTION_REPAIR_PROMPT,
    DEFAULT_PROMOTION_SYSTEM_PROMPT,
    DEFAULT_PROMOTION_USER_PROMPT,
    DEFAULT_SUMMARIZER_REPAIR_PROMPT,
    DEFAULT_SUMMARIZER_SYSTEM_PROMPT,
    DEFAULT_SUMMARIZER_USER_PROMPT,
    ZH_LONGFORM_AUDITOR_SYSTEM_PROMPT,
    ZH_LONGFORM_AUDITOR_USER_PROMPT,
    ZH_PROMOTION_REPAIR_PROMPT,
    ZH_PROMOTION_SYSTEM_PROMPT,
    ZH_PROMOTION_USER_PROMPT,
    ZH_SUMMARIZER_REPAIR_PROMPT,
    ZH_SUMMARIZER_SYSTEM_PROMPT,
    ZH_SUMMARIZER_USER_PROMPT,
} from './prompt-constants.js';

export { RECALL_REPEAT_INJECTION_TEMPLATE } from './prompt-constants.js';

export const MODULE_NAME = 'summaryception_vadash_zh';
export const LOG_PREFIX = '[Summaryception]';
export const TOAST_TITLE = '分层摘要';

/**
 * Stable ghosting progress labels and terminal clear kinds emitted on the
 * notify adapter (ADR-0019); the entry adapter maps them to on-screen text.
 * Core carries these ids, never prose.
 * @type {{ HIDE: string, UNHIDE: string, UNHIDDEN: string }}
 */
export const GHOST_PROGRESS = Object.freeze({
    HIDE: 'ghost-hide',
    UNHIDE: 'ghost-unhide',
    UNHIDDEN: 'ghost-unhidden',
});

/**
 * Stable batch progress label and terminal clear kinds emitted on the notify
 * adapter (ADR-0019); the entry adapter maps them to on-screen text. Core
 * carries these ids, never prose.
 * @type {{ MEMORY: string, UPDATED: string, ABORTED: string, FAILED: string }}
 */
export const BATCH_PROGRESS = Object.freeze({
    MEMORY: 'batch-memory',
    UPDATED: 'batch-memory-updated',
    ABORTED: 'batch-memory-aborted',
    FAILED: 'batch-memory-failed',
});

/**
 * Stable transient event kinds emitted on the notify adapter (ADR-0019); the
 * entry adapter maps each kind to a user notice. Core carries these ids, never
 * prose.
 * @type {{ RUN_ABORTED: string, RUN_FAILED: string, EASY_GUARD_BLOCKED: string, RETRY_WAIT: string, ROUTE_CYCLE_WAIT: string, LANGUAGE_MIX_RETRY: string, PROMOTION_STARTED: string }}
 */
export const NOTIFY_EVENTS = Object.freeze({
    RUN_ABORTED: 'run-aborted',
    RUN_FAILED: 'run-failed',
    EASY_GUARD_BLOCKED: 'easy-guard-blocked',
    RETRY_WAIT: 'retry-wait',
    ROUTE_CYCLE_WAIT: 'route-cycle-wait',
    LANGUAGE_MIX_RETRY: 'language-mix-retry',
    PROMOTION_STARTED: 'promotion-started',
});

export const MEMORY_MODES = Object.freeze({
    BALANCED: 'balanced',
    PREFIX_CACHE: 'prefix_cache',
    CUSTOM: 'custom',
});
export const MEMORY_MODE_PRESETS = Object.freeze({
    [MEMORY_MODES.BALANCED]: Object.freeze({
        verbatimTokenBudget: 22000,
        queuedTokenBudget: 6000,
    }),
    [MEMORY_MODES.PREFIX_CACHE]: Object.freeze({
        verbatimTokenBudget: 20000,
        queuedTokenBudget: 16000,
    }),
});

/**
 * Selectable memory modes that own an initial retention preset.
 * `custom` is intentionally excluded: it carries no preset.
 * @type {ReadonlyArray<string>}
 */
const SELECTABLE_MEMORY_MODES = Object.freeze([MEMORY_MODES.BALANCED, MEMORY_MODES.PREFIX_CACHE]);

/**
 * Apply a mode's initial retention preset to settings. Every mode transition
 * overwrites the recent and queued budgets with the destination preset.
 * @param {ExtensionSettings} settings
 * @param {string} mode
 * @returns {boolean} true when settings were mutated, false otherwise.
 */
export function applyMemoryModePreset(settings, mode) {
    if (!SELECTABLE_MEMORY_MODES.includes(String(mode))) {
        return false;
    }
    if (settings.memoryMode === mode) {
        return false;
    }
    const preset = MEMORY_MODE_PRESETS[mode];
    settings.memoryMode = mode;
    settings.verbatimTokenBudget = preset.verbatimTokenBudget;
    settings.queuedTokenBudget = preset.queuedTokenBudget;
    return true;
}

export const UI_MODES = Object.freeze({
    OFF: 'off',
    EASY: 'easy',
    ADVANCED: 'advanced',
});

/**
 * Operation Mode: whether the extension is On or Off. Off is the only state
 * that disables runtime behavior. Distinct from the Complexity Mode axis in
 * UI_MODES, which selects the visible panel.
 */
export const OPERATION_MODES = Object.freeze({
    ON: 'on',
    OFF: 'off',
});

/**
 * Slider and numeric-stepper bounds, keyed by setting id. Single source of
 * truth for numeric input bounds: the read-time normalizer is the only
 * enforcement, and the settings template's min/max/step attributes pin to
 * this map.
 * Bounds only: initial values live in defaultSettings. A `MAX` of null means
 * the input declares no upper bound.
 */
export const SLIDER_LIMITS = Object.freeze({
    advancedModelContext: Object.freeze({ MIN: 8000, MAX: 64000, STEP: 1000 }),
    maxL0SourceTokens: Object.freeze({ MIN: 8000, MAX: 64000, STEP: 1000 }),
    minSummaryBudget: Object.freeze({ MIN: 4000, MAX: 32000, STEP: 1000 }),
    verbatimTokenBudget: Object.freeze({ MIN: 4000, MAX: 64000, STEP: 1000 }),
    queuedTokenBudget: Object.freeze({ MIN: 4000, MAX: 64000, STEP: 1000 }),
    memoryTokenBudget: Object.freeze({ MIN: 4000, MAX: 32000, STEP: 1000 }),
    layer0SummaryTokenTarget: Object.freeze({ MIN: 80, MAX: 700, STEP: 10 }),
    minSummaryTurns: Object.freeze({ MIN: 2, MAX: 10, STEP: 1 }),
    maxSummaryTurns: Object.freeze({ MIN: 3, MAX: 20, STEP: 1 }),
    snippetsPerLayer: Object.freeze({ MIN: 20, MAX: 40, STEP: 1 }),
    snippetsPerPromotion: Object.freeze({ MIN: 3, MAX: 4, STEP: 1 }),
    cacheTtlMinutes: Object.freeze({ MIN: 5, MAX: 240, STEP: 5 }),
    requestTimeoutSeconds: Object.freeze({ MIN: 60, MAX: 7200, STEP: 10 }),
    mergeRequestTimeoutSeconds: Object.freeze({ MIN: 60, MAX: 7200, STEP: 10 }),
    fallbackRequestTimeoutSeconds: Object.freeze({ MIN: 60, MAX: 7200, STEP: 10 }),
    auditorRequestTimeoutSeconds: Object.freeze({ MIN: 60, MAX: 7200, STEP: 10 }),
    summarizerResponseLength: Object.freeze({ MIN: 0, MAX: null, STEP: 100 }),
    mergeSummarizerResponseLength: Object.freeze({ MIN: 0, MAX: null, STEP: 100 }),
    fallbackSummarizerResponseLength: Object.freeze({ MIN: 0, MAX: null, STEP: 100 }),
    auditorSummarizerResponseLength: Object.freeze({ MIN: 0, MAX: null, STEP: 100 }),
    customMemoryDepth: Object.freeze({ MIN: 0, MAX: 10000, STEP: 1 }),
});

export const MASK_USER_ROLE_MODES = Object.freeze({
    MARKER_FIRST: 'marker_first',
    REWRITE_ALL: 'rewrite_all',
    MARKER_LAST: 'marker_last',
    KEEP_LAST_USER: 'keep_last_user',
});

export const MEMORY_POSITIONS = Object.freeze({
    BEFORE_PROMPT: 'before_prompt',
    IN_PROMPT: 'in_prompt',
    IN_CHAT: 'in_chat',
    MACRO_ONLY: 'macro_only',
});

export const MEMORY_ROLES = Object.freeze({
    SYSTEM: 'system',
    USER: 'user',
    ASSISTANT: 'assistant',
});

export const EXTENSION_PROMPT_POSITIONS = Object.freeze({
    NONE: -1,
    IN_PROMPT: 0,
    IN_CHAT: 1,
    BEFORE_PROMPT: 2,
});

export const EXTENSION_PROMPT_ROLES = Object.freeze({
    SYSTEM: 0,
    USER: 1,
    ASSISTANT: 2,
});

export const INTERNAL_MAX_LAYER_DEPTH = 20;

// ─── Layer Presentation ──────────────────────────────────────────────

/**
 * One shared helper serves the status panel, the snippet browser, and slash commands.
 * @param {number} index - Zero-based layer index
 * @returns {string}
 */
export function layerLabel(index) {
    return index === 0 ? '第 0 层（回合摘要）' : `第 ${index} 层（元摘要）`;
}

/**
 * @param {SummaryceptionStore} store
 * @returns {Array<{ index: number, layer: SummaryceptionSnippet[] }>}
 */
export function listNonEmptyLayers(store) {
    const sourceLayers = Array.isArray(store?.layers) ? store.layers : [];
    const result = [];
    for (let i = sourceLayers.length - 1; i >= 0; i--) {
        const layer = sourceLayers[i];
        if (layer?.length > 0) {
            result.push({ index: i, layer });
        }
    }
    return result;
}

// ─── Default Settings ────────────────────────────────────────────────

/**
 * Catch-up Window: one combined Auditor call covers at most this many
 * Exchanges (most recent first); it bounds coverage, never turn_count. The
 * injection slot reuses it to bound the depth shift a single catch-up causes.
 */
export const CATCHUP_WINDOW_EXCHANGES = 4;

export const defaultSettings = Object.freeze({
    enabled: true,
    // Latched by Stop; blocks only automatic cycles. Manual runs ignore it.
    autoPaused: false,
    // Opt-in Continuity Auditor (issue #28); off until the user enables it.
    continuityEnabled: false,
    memoryMode: MEMORY_MODES.BALANCED,
    cacheTtlMinutes: 30, // provider cache lifetime, Prefix Cache only
    // Decoupled from uiMode: which complexity panel (Easy/Advanced) to render,
    // shown even when the extension is off so config stays editable.
    configMode: UI_MODES.EASY,
    uiMode: UI_MODES.EASY,
    customMemoryPosition: MEMORY_POSITIONS.IN_PROMPT,
    customMemoryRole: MEMORY_ROLES.SYSTEM,
    customMemoryDepth: 0,
    minSummaryTurns: 3,
    maxSummaryTurns: 8,
    layer0SummaryTokenTarget: 280,
    maxL0SourceTokens: 24000,
    advancedModelContext: 48000,
    minSummaryBudget: 16000,
    verbatimTokenBudget: 22000,
    queuedTokenBudget: 6000,
    memoryTokenBudget: 10000,
    snippetsPerLayer: 24,
    snippetsPerPromotion: 3,
    injectionTemplate: DEFAULT_INJECTION_TEMPLATE,
    summarizerSystemPrompt: ZH_SUMMARIZER_SYSTEM_PROMPT,
    summarizerUserPrompt: ZH_SUMMARIZER_USER_PROMPT,
    summarizerRepairPrompt: ZH_SUMMARIZER_REPAIR_PROMPT,
    promotionSystemPrompt: ZH_PROMOTION_SYSTEM_PROMPT,
    promotionUserPrompt: ZH_PROMOTION_USER_PROMPT,
    promotionRepairPrompt: ZH_PROMOTION_REPAIR_PROMPT,
    auditorSystemPrompt: ZH_LONGFORM_AUDITOR_SYSTEM_PROMPT,
    auditorUserPrompt: ZH_LONGFORM_AUDITOR_USER_PROMPT,

    summarizerSystemPromptPreset: 'zh_longform', // 'zh_longform' | 'narrative' | 'custom'
    promptPreset: 'zh_longform', // 'zh_longform' | 'narrative' | 'custom'
    summarizerRepairPromptPreset: 'zh_longform', // 'zh_longform' | 'narrative' | 'custom'
    promotionSystemPromptPreset: 'zh_longform', // 'zh_longform' | 'narrative' | 'custom'
    promotionPromptPreset: 'zh_longform', // 'zh_longform' | 'narrative' | 'custom'
    promotionRepairPromptPreset: 'zh_longform', // 'zh_longform' | 'narrative' | 'custom'
    auditorSystemPromptPreset: 'zh_longform', // 'zh_longform' | 'continuity' | 'custom'
    auditorPromptPreset: 'zh_longform', // 'zh_longform' | 'continuity' | 'custom'
    promptCustomDrafts: {},
    applyRegexScripts: true, // true = apply ST's regex scripts to passage text before summarizing
    // true = also hide text-less messages (images, tool calls) inside the summarized
    // range. They carry no text to summarize, so without this they stay visible to the
    // model and leave gaps in the hidden range that still cost context.
    hideNonTextMessages: true,
    stripChineseIdeographs: false, // true = strip Han ideographs from summarizer responses
    maskUserRoleAsAssistant: false, // true = rewrite outgoing user-role request blocks as assistant
    maskUserRoleMode: MASK_USER_ROLE_MODES.MARKER_FIRST,

    stripPatterns: [
        '<|channel>thought',
        '<channel|>',
        '<output>',
        '</output>',
        '<thinking>',
        '</thinking>',
    ],

    debugMode: false,
    traceMode: false,
    promptInputLogMode: false,
    promptOutputLogMode: false,
    continuityStateLogMode: false,
    continuityStateLogFullMode: false,

    // ─── Connection Settings ─────────────────────────────────────
    connectionSource: 'default', // 'default' | 'profile'
    summarizerResponseLength: 0, // 0 = provider/profile default
    connectionProfileId: '',
    requestTimeoutSeconds: 120, // Layer 0 / regenerate route

    // Optional Layer 1+ promotion merge connection. 'inherit' uses the Layer 0 connection above.
    mergeConnectionSource: 'inherit', // 'inherit' | 'default' | 'profile'
    mergeSummarizerResponseLength: 0,
    mergeConnectionProfileId: '',
    mergeRequestTimeoutSeconds: 90, // Layer 1+ promotion route

    // Optional fallback connection used after the primary route exhausts retryable failures.
    fallbackConnectionSource: 'disabled', // 'disabled' | 'default' | 'profile'
    fallbackSummarizerResponseLength: 0,
    fallbackConnectionProfileId: '',
    fallbackRequestTimeoutSeconds: 120,

    // Dedicated Continuity Auditor connection, separate from the Narrative Chain (ADR-0009).
    auditorConnectionSource: 'inherit', // 'inherit' | 'default' | 'profile'
    auditorSummarizerResponseLength: 0,
    auditorConnectionProfileId: '',
    auditorRequestTimeoutSeconds: 120, // auditor primary route
});

// ─── Prompt Presets ──────────────────────────────────────────────────

/**
 * The Chinese longform preset is this branch's default. The upstream English
 * bodies remain complete, selectable presets; `custom` keeps the textarea.
 */
export const CHINESE_PROMPT_PRESET = 'zh_longform';
export const DEFAULT_PROMPT_PRESET = CHINESE_PROMPT_PRESET;
export const DEFAULT_PROMOTION_PROMPT_PRESET = CHINESE_PROMPT_PRESET;

export const PROMPT_PRESETS = {
    [CHINESE_PROMPT_PRESET]: ZH_SUMMARIZER_USER_PROMPT,
    narrative: DEFAULT_SUMMARIZER_USER_PROMPT,
    custom: null, // Uses whatever is in the textarea
};

export const SUMMARIZER_SYSTEM_PROMPT_PRESETS = {
    [CHINESE_PROMPT_PRESET]: ZH_SUMMARIZER_SYSTEM_PROMPT,
    narrative: DEFAULT_SUMMARIZER_SYSTEM_PROMPT,
    custom: null,
};

export const SUMMARIZER_REPAIR_PROMPT_PRESETS = {
    [CHINESE_PROMPT_PRESET]: ZH_SUMMARIZER_REPAIR_PROMPT,
    narrative: DEFAULT_SUMMARIZER_REPAIR_PROMPT,
    custom: null,
};

export const PROMOTION_PROMPT_PRESETS = {
    [CHINESE_PROMPT_PRESET]: ZH_PROMOTION_USER_PROMPT,
    narrative: DEFAULT_PROMOTION_USER_PROMPT,
    custom: null, // Uses whatever is in the textarea
};

export const PROMOTION_SYSTEM_PROMPT_PRESETS = {
    [CHINESE_PROMPT_PRESET]: ZH_PROMOTION_SYSTEM_PROMPT,
    narrative: DEFAULT_PROMOTION_SYSTEM_PROMPT,
    custom: null,
};

export const PROMOTION_REPAIR_PROMPT_PRESETS = {
    [CHINESE_PROMPT_PRESET]: ZH_PROMOTION_REPAIR_PROMPT,
    narrative: DEFAULT_PROMOTION_REPAIR_PROMPT,
    custom: null,
};

export const AUDITOR_PROMPT_PRESETS = {
    [CHINESE_PROMPT_PRESET]: ZH_LONGFORM_AUDITOR_USER_PROMPT,
    continuity: DEFAULT_AUDITOR_USER_PROMPT,
    custom: null, // Uses whatever is in the textarea
};

export const AUDITOR_SYSTEM_PROMPT_PRESETS = {
    [CHINESE_PROMPT_PRESET]: ZH_LONGFORM_AUDITOR_SYSTEM_PROMPT,
    continuity: DEFAULT_AUDITOR_SYSTEM_PROMPT,
    custom: null,
};

/**
 * The one registry shared by settings reset, read-time normalization, and the
 * prompt UI. Each field owns its preset key, text key, default preset, and the
 * complete preset table. No settings/context imports live here, so the module
 * stays a one-way prompt-string dependency.
 * @type {ReadonlyArray<{ presetKey: string, settingKey: string, defaultPreset: string, presets: Record<string, string | null> }>}
 */
export const PROMPT_DEFINITIONS = Object.freeze([
    Object.freeze({
        presetKey: 'summarizerSystemPromptPreset',
        settingKey: 'summarizerSystemPrompt',
        defaultPreset: DEFAULT_PROMPT_PRESET,
        presets: SUMMARIZER_SYSTEM_PROMPT_PRESETS,
    }),
    Object.freeze({
        presetKey: 'promptPreset',
        settingKey: 'summarizerUserPrompt',
        defaultPreset: DEFAULT_PROMPT_PRESET,
        presets: PROMPT_PRESETS,
    }),
    Object.freeze({
        presetKey: 'summarizerRepairPromptPreset',
        settingKey: 'summarizerRepairPrompt',
        defaultPreset: DEFAULT_PROMPT_PRESET,
        presets: SUMMARIZER_REPAIR_PROMPT_PRESETS,
    }),
    Object.freeze({
        presetKey: 'promotionSystemPromptPreset',
        settingKey: 'promotionSystemPrompt',
        defaultPreset: DEFAULT_PROMOTION_PROMPT_PRESET,
        presets: PROMOTION_SYSTEM_PROMPT_PRESETS,
    }),
    Object.freeze({
        presetKey: 'promotionPromptPreset',
        settingKey: 'promotionUserPrompt',
        defaultPreset: DEFAULT_PROMOTION_PROMPT_PRESET,
        presets: PROMOTION_PROMPT_PRESETS,
    }),
    Object.freeze({
        presetKey: 'promotionRepairPromptPreset',
        settingKey: 'promotionRepairPrompt',
        defaultPreset: DEFAULT_PROMOTION_PROMPT_PRESET,
        presets: PROMOTION_REPAIR_PROMPT_PRESETS,
    }),
    Object.freeze({
        presetKey: 'auditorSystemPromptPreset',
        settingKey: 'auditorSystemPrompt',
        defaultPreset: DEFAULT_PROMPT_PRESET,
        presets: AUDITOR_SYSTEM_PROMPT_PRESETS,
    }),
    Object.freeze({
        presetKey: 'auditorPromptPreset',
        settingKey: 'auditorUserPrompt',
        defaultPreset: DEFAULT_PROMPT_PRESET,
        presets: AUDITOR_PROMPT_PRESETS,
    }),
]);

/**
 * The eight (presetKey, settingKey) prompt pairs shared by persistence
 * normalization and the prompt UI bindings. Order defines UI field order.
 * @type {ReadonlyArray<{ presetKey: string, settingKey: string }>}
 */
export const PROMPT_SETTING_KEYS = Object.freeze(
    PROMPT_DEFINITIONS.map(({ presetKey, settingKey }) =>
        Object.freeze({ presetKey, settingKey }),
    ),
);

/**
 * One query for the conservative Chinese-preset rule: any of the eight fields
 * selecting a Chinese preset disables Han-ideograph stripping, even when the
 * Auditor that owns one of those fields is disabled.
 * @param {object} settings
 * @returns {boolean}
 */
export function hasChinesePromptPreset(settings) {
    if (!settings || typeof settings !== 'object') {
        return false;
    }
    const record = /** @type {Record<string, unknown>} */ (settings);
    return PROMPT_DEFINITIONS.some(
        ({ presetKey }) => record[presetKey] === CHINESE_PROMPT_PRESET,
    );
}

// ─── Retry Configuration ─────────────────────────────────────────────

export const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    retryableStatuses: [429, 500, 502, 503, 504],
};

// Consecutive failed primary+fallback route cycles before one request gives up
// with a failed Run Outcome instead of retrying forever (mirrors the Promotion
// Drain failure budget).
export const ROUTE_CYCLE_FAILURE_BUDGET = 1;
