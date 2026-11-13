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

// IME composition is field-local. While it is open a browser may deliver
// intermediate `input` events and the textarea may briefly read as empty.
const composingFields = new Set();

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
    if (!String(text ?? '').trim()) {
        return;
    }
    getPromptCustomDrafts(settings)[field.settingKey] = text;
}

/**
 * Persist a selection, then resync the strip-Han control and this field's
 * controls from the normalized settings. Reading through getSettings here is
 * deliberate: it lets the normalizer force strip mode off as soon as a Chinese
 * preset is selected. The textarea is only written when it is not the focused
 * editor, so a background refresh cannot overwrite an in-progress edit.
 * @param {{ presetSelect: string, textarea: string, presetKey: string, settingKey: string, defaultPreset: string }} field
 * @returns {void}
 */
function savePromptSelection(field) {
    saveSettings();
    const settings = getSettings();
    syncPromptFieldControls(field, settings);
    syncStripChineseIdeographControl(settings);
}

/**
 * @param {string} settingKey
 * @returns {boolean}
 */
function isComposing(settingKey) {
    return composingFields.has(settingKey);
}

/**
 * @param {{ textarea: string }} field
 * @returns {boolean}
 */
function isPromptTextareaFocused(field) {
    return $(field.textarea).is(':focus');
}

/**
 * Apply the textarea value to the live execution prompt. Blank text is an
 * editing state: it neither changes the effective prompt nor replaces the last
 * non-empty draft. Selecting custom is the only preset change input can make.
 * @param {{ presetSelect: string, textarea: string, presetKey: string, settingKey: string }} field
 * @param {string} text
 * @returns {void}
 */
function commitPromptText(field, text) {
    if (!String(text ?? '').trim()) {
        return;
    }
    const settings = getSettings();
    settings[field.settingKey] = text;
    savePromptCustomDraft(settings, field, text);
    if (settings[field.presetKey] !== 'custom') {
        settings[field.presetKey] = 'custom';
        if (!$(field.presetSelect).is(':focus')) {
            $(field.presetSelect).val('custom');
        }
        syncStripChineseIdeographControl(settings);
    }
    saveSettings();
}

/**
 * Sync the non-editing controls of one prompt field from settings. A focused
 * textarea keeps its DOM value; the settings object is still the execution
 * source of truth until blur.
 * @param {{ presetSelect: string, textarea: string, presetKey: string, settingKey: string, defaultPreset: string }} field
 * @param {ReturnType<typeof getSettings>} settings
 * @returns {void}
 */
function syncPromptFieldControls(field, settings) {
    const normalizedText = String(settings[field.settingKey] ?? '');
    const normalizedPreset = String(settings[field.presetKey] ?? field.defaultPreset);
    const currentText = String($(field.textarea).val() ?? '');
    if (!isPromptTextareaFocused(field) && currentText !== normalizedText) {
        $(field.textarea).val(normalizedText);
    }
    if (String($(field.presetSelect).val() ?? '') !== normalizedPreset) {
        $(field.presetSelect).val(normalizedPreset);
    }
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
    $(document).on('compositionstart', field.textarea, function () {
        composingFields.add(field.settingKey);
    });

    $(document).on('compositionend', field.textarea, function () {
        composingFields.delete(field.settingKey);
        commitPromptText(field, String($(this).val() ?? ''));
    });

    $(document).on('input', field.textarea, function (event) {
        if (isComposing(field.settingKey) || event.originalEvent?.isComposing === true) {
            return;
        }
        commitPromptText(field, String($(this).val() ?? ''));
    });

    $(document).on('change blur', field.textarea, function () {
        if (isComposing(field.settingKey)) {
            return;
        }
        commitPromptText(field, String($(this).val() ?? ''));
        savePromptSelection(field);
    });
}
