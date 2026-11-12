import { PROMPT_DEFINITIONS } from '../foundation/constants.js';
import { getSettings, saveSettings } from '../foundation/settings.js';
import { isPlainObject } from '../foundation/objects.js';
import { syncStripChineseIdeographControl } from './ui-bind.js';

// PROMPT_DEFINITIONS owns the (presetKey, settingKey, defaultPreset, presets)
// truth. This map adds only the DOM selectors, keyed by presetKey.
const PROMPT_FIELD_UI = {
    summarizerSystemPromptPreset: {
        presetSelect: '#sc_summarizer_system_prompt_preset',
        textarea: '#sc_summarizer_system_prompt',
    },
    promptPreset: {
        presetSelect: '#sc_prompt_preset',
        textarea: '#sc_summarizer_user_prompt',
    },
    summarizerRepairPromptPreset: {
        presetSelect: '#sc_summarizer_repair_prompt_preset',
        textarea: '#sc_summarizer_repair_prompt',
    },
    promotionSystemPromptPreset: {
        presetSelect: '#sc_promotion_system_prompt_preset',
        textarea: '#sc_promotion_system_prompt',
    },
    promotionPromptPreset: {
        presetSelect: '#sc_promotion_prompt_preset',
        textarea: '#sc_promotion_user_prompt',
    },
    promotionRepairPromptPreset: {
        presetSelect: '#sc_promotion_repair_prompt_preset',
        textarea: '#sc_promotion_repair_prompt',
    },
    auditorSystemPromptPreset: {
        presetSelect: '#sc_auditor_system_prompt_preset',
        textarea: '#sc_auditor_system_prompt',
    },
    auditorPromptPreset: {
        presetSelect: '#sc_auditor_prompt_preset',
        textarea: '#sc_auditor_user_prompt',
    },
};

const PROMPT_FIELDS = PROMPT_DEFINITIONS.map((definition) => ({
    ...definition,
    ...PROMPT_FIELD_UI[definition.presetKey],
}));

/**
 * @returns {void}
 */
export function bindPromptProfiles() {
    for (const field of PROMPT_FIELDS) {
        bindPromptPresetSelect(field);
        bindPromptTextarea(field);
    }
}

/**
 * A per-field draft map on settings, not in-memory or localStorage state.
 * @param {ReturnType<typeof getSettings>} settings
 * @returns {Record<string, string>}
 */
function getPromptCustomDrafts(settings) {
    if (!isPlainObject(settings.promptCustomDrafts)) {
        settings.promptCustomDrafts = {};
    }
    return settings.promptCustomDrafts;
}

/**
 * @param {ReturnType<typeof getSettings>} settings
 * @param {{ settingKey: string }} field
 * @param {string} text
 * @returns {void}
 */
function savePromptCustomDraft(settings, field, text) {
    getPromptCustomDrafts(settings)[field.settingKey] = text;
}

/**
 * Persist a selection, then resync the strip-Han control and this field's
 * controls from the normalized settings. Reading through getSettings here is
 * deliberate: it lets the normalizer force strip mode off as soon as a Chinese
 * preset is selected, and repair an empty custom field visibly instead of
 * leaving the textarea and settings out of step.
 * @param {{ presetSelect: string, textarea: string, presetKey: string, settingKey: string, defaultPreset: string }} field
 * @returns {void}
 */
function savePromptSelection(field) {
    saveSettings();
    const settings = getSettings();
    const normalizedText = String(settings[field.settingKey] ?? '');
    const normalizedPreset = String(settings[field.presetKey] ?? field.defaultPreset);
    if (String($(field.textarea).val() ?? '') !== normalizedText) {
        $(field.textarea).val(normalizedText);
    }
    if (String($(field.presetSelect).val() ?? '') !== normalizedPreset) {
        $(field.presetSelect).val(normalizedPreset);
    }
    syncStripChineseIdeographControl(settings);
}

function bindPromptPresetSelect(field) {
    $(document).on('change', field.presetSelect, function () {
        const selected = String($(this).val());
        const s = getSettings();
        if (!Object.hasOwn(field.presets, selected)) {
            $(field.presetSelect).val(s[field.presetKey] || field.defaultPreset);
            return;
        }

        if (selected === 'custom') {
            const draft = getPromptCustomDrafts(s)[field.settingKey];
            const currentText = String(s[field.settingKey] ?? '');
            const text = typeof draft === 'string' && draft.trim() ? draft : currentText;
            s[field.presetKey] = 'custom';
            s[field.settingKey] = text;
            savePromptCustomDraft(s, field, text);
            $(field.presetSelect).val('custom');
            $(field.textarea).val(text);
        } else {
            if (s[field.presetKey] === 'custom') {
                const currentText = String($(field.textarea).val() ?? s[field.settingKey] ?? '');
                savePromptCustomDraft(s, field, currentText);
            }
            const presetText = field.presets[selected];
            s[field.presetKey] = selected;
            s[field.settingKey] = presetText;
            $(field.textarea).val(presetText);
        }

        savePromptSelection(field);
    });
}

function bindPromptTextarea(field) {
    $(document).on('input change', field.textarea, function () {
        const s = getSettings();
        const currentText = String($(this).val() ?? '');
        s[field.settingKey] = currentText;
        savePromptCustomDraft(s, field, currentText);

        if (s[field.presetKey] !== 'custom') {
            s[field.presetKey] = 'custom';
            $(field.presetSelect).val('custom');
        }

        savePromptSelection(field);
    });
}
