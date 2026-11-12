import {
    MEMORY_MODE_PRESETS,
    MODULE_NAME,
    PROMPT_DEFINITIONS,
    defaultSettings,
} from './constants.js';
import { getExtensionSettings, saveSettingsDebounced } from './context.js';
import { isPlainObject } from './objects.js';
import { getAllRouteSettingKeys } from './connection-routes.js';
import { normalizeSettings } from './settings-normalizer.js';
import { readOperationMode, repairOperationMode } from './operation-mode.js';

/**
 * Extension settings as the SillyTavern context holds them: the load-time
 * backfill and repair, the Effective Settings projection, and the defaults
 * reset. The repair itself is host-free.
 */

/**
 * @returns {ExtensionSettings}
 */
export function getSettings() {
    const extensionSettings = getExtensionSettings();
    let defaultsChanged = false;
    if (!isPlainObject(extensionSettings[MODULE_NAME])) {
        extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
        defaultsChanged = true;
    }
    const settings = extensionSettings[MODULE_NAME];
    const settingsRecord = /** @type {Record<string, unknown>} */ (
        /** @type {unknown} */ (settings)
    );
    const defaultsRecord = /** @type {Record<string, unknown>} */ (defaultSettings);
    // Capture before the backfill: the repair passes need to know which keys
    // the stored object carried, not which it has now.
    const hadUiMode = Object.hasOwn(settings, 'uiMode');
    const hadMaskUserRoleMode = Object.hasOwn(settings, 'maskUserRoleMode');
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(settings, key)) {
            // Defaults can carry arrays and the custom-draft object; clone per
            // settings object so a later mutation cannot leak into defaults.
            settingsRecord[key] = structuredClone(defaultsRecord[key]);
            defaultsChanged = true;
        }
    }
    const modeSettingsNormalized = repairOperationMode(settings, { hadUiMode });
    const settingsNormalized = normalizeSettings(settings, { hadMaskUserRoleMode });
    if (defaultsChanged || modeSettingsNormalized || settingsNormalized) {
        saveSettingsDebounced();
    }
    return settings;
}

/**
 * Runtime code should use this when behavior must follow the visible mode.
 * @returns {ExtensionSettings}
 */
export function getEffectiveSettings() {
    const settings = getSettings();
    return readOperationMode(settings).enabled ? settings : { ...settings, enabled: false };
}

/**
 * Debounces so rapid control changes coalesce into one host save.
 * @returns {void}
 */
export function saveSettings() {
    saveSettingsDebounced();
}

/**
 * Keys a defaults reset never touches: the selected memory/UI/config modes and
 * the Operation Mode gate they project, every Connection Route setting (all
 * four keys of every route, derived from the route catalogue), debugMode
 * (re-enabled explicitly after the reset loop), and the per-field custom prompt
 * drafts (a reset restores built-in presets but never discards user text).
 * @type {Set<string>}
 */
const RESET_PRESERVED_KEYS = new Set([
    'memoryMode',
    'uiMode',
    'configMode',
    'enabled',
    ...getAllRouteSettingKeys(),
    'debugMode',
    'promptCustomDrafts',
]);

/**
 * Restore every non-custom prompt field to its default built-in preset. A
 * custom selection and its text stay untouched, and promptCustomDrafts is in
 * RESET_PRESERVED_KEYS.
 * @param {ExtensionSettings} settings - Settings object mutated in place.
 * @returns {void}
 */
function resetPromptValues(settings) {
    const defaultsRecord = /** @type {Record<string, unknown>} */ (
        /** @type {unknown} */ (defaultSettings)
    );
    const settingsRecord = /** @type {Record<string, unknown>} */ (
        /** @type {unknown} */ (settings)
    );
    for (const { presetKey, settingKey, defaultPreset, presets } of PROMPT_DEFINITIONS) {
        if (settingsRecord[presetKey] === 'custom') {
            continue;
        }
        const defaultText = presets[defaultPreset];
        settingsRecord[presetKey] = defaultPreset;
        settingsRecord[settingKey] =
            typeof defaultText === 'string' ? defaultText : defaultsRecord[settingKey];
    }
}

/**
 * Restores every default except RESET_PRESERVED_KEYS and the prompt profile
 * pairs, which resetPromptValues handles.
 * @returns {void}
 */
export function resetSettingsToDefaults() {
    const s = getSettings();
    const promptKeys = new Set(
        PROMPT_DEFINITIONS.flatMap(({ presetKey, settingKey }) => [presetKey, settingKey]),
    );
    for (const key of Object.keys(defaultSettings)) {
        if (RESET_PRESERVED_KEYS.has(key) || promptKeys.has(key)) {
            continue;
        }
        const value = defaultSettings[key];
        s[key] = structuredClone(value);
    }

    resetPromptValues(s);

    // Retention budgets follow the preserved memory mode's preset, not the plain defaults.
    const retentionPreset = MEMORY_MODE_PRESETS[s.memoryMode] || MEMORY_MODE_PRESETS.balanced;
    s.verbatimTokenBudget = retentionPreset.verbatimTokenBudget;
    s.queuedTokenBudget = retentionPreset.queuedTokenBudget;

    // Debug output deliberately re-enables on reset so F12 diagnostics stay available.
    s.debugMode = true;
}
