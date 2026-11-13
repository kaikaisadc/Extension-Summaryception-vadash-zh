import { callTokenCountAsync } from '../foundation/context.js';

/**
 * Chars per estimated token for the English-only fallback estimator. It is
 * used only when the active tokenizer is unavailable; the real tokenizer takes
 * precedence, and Layer 0 validation remains token-based rather than
 * char-budgeted.
 */
const APPROX_TEXT_UNITS_PER_TOKEN = 4;
/**
 * Fallback-only CJK baseline: two estimated tokens per CJK code point before
 * the safety margin. This is an unmeasured conservative heuristic, not an
 * upper bound and not the real ratio of any particular tokenizer.
 */
const APPROX_CJK_TOKENS_PER_CHAR = 2;
/**
 * Unmeasured safety margin applied to the fallback estimate. It keeps the
 * budget-side estimate conservative; it is not a measured tokenizer ratio.
 */
const APPROX_ESTIMATE_SAFETY_MULTIPLIER = 1.15;
const CJK_SCRIPT_REGEX =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const MESSAGE_TOKEN_CACHE_KEY = 'sc_vadash_zh_token_count';

/**
 * @typedef {object} TokenCount
 * @property {number} count - Token total for the message text
 * @property {boolean} estimated - Whether the count came from the conservative fallback estimator
 */

/**
 * @typedef {object} MessageTokenStats
 * @property {number} rawTokens - Rendered line tokens before regex scripts
 * @property {number} finalTokens - Rendered line tokens after regex scripts
 * @property {boolean} rawTokensEstimated - Whether rawTokens came from fallback estimation
 * @property {boolean} finalTokensEstimated - Whether finalTokens came from fallback estimation
 */

/**
 * @typedef {object} BudgetStats
 * @property {number} rawTokens - Tokens before regex scripts.
 * @property {number} finalTokens - Tokens after regex scripts.
 * @property {number} savedTokens - Raw tokens minus final tokens.
 * @property {boolean} rawTokensEstimated - Whether raw tokens came from fallback estimation.
 * @property {boolean} finalTokensEstimated - Whether final tokens came from fallback estimation.
 * @property {boolean} savedTokensEstimated - Whether saved tokens include fallback estimation.
 * @property {number} changedMessageCount - Number of messages changed by regex scripts.
 */

/**
 * @typedef {MessageTokenStats & { changed: boolean }} CountedBudgetMessage
 */

/**
 * @returns {BudgetStats}
 */
export function createBudgetStats() {
    return {
        rawTokens: 0,
        finalTokens: 0,
        savedTokens: 0,
        rawTokensEstimated: false,
        finalTokensEstimated: false,
        savedTokensEstimated: false,
        changedMessageCount: 0,
    };
}

/**
 * @param {BudgetStats} stats
 * @param {CountedBudgetMessage} counted
 * @returns {void}
 */
export function addBudgetStats(stats, counted) {
    stats.rawTokens += counted.rawTokens;
    stats.finalTokens += counted.finalTokens;
    stats.savedTokens = stats.rawTokens - stats.finalTokens;
    stats.rawTokensEstimated ||= counted.rawTokensEstimated;
    stats.finalTokensEstimated ||= counted.finalTokensEstimated;
    stats.savedTokensEstimated = stats.rawTokensEstimated || stats.finalTokensEstimated;
    if (counted.changed) {
        stats.changedMessageCount++;
    }
}

/**
 * Count tokens using SillyTavern's active tokenizer, with a marked fallback.
 * The fallback is a budget estimate, not a model-exact token count; the next
 * call retries the real tokenizer, so a temporary failure can recover.
 * @param {string} text - Text to count
 * @returns {Promise<TokenCount>}
 */
export async function countTextTokens(text) {
    const normalizedText = String(text ?? '');
    const exactCount = await countWithActiveTokenizer(normalizedText);

    if (exactCount !== null) {
        return {
            count: exactCount,
            estimated: false,
        };
    }

    return {
        count: estimateTokenCount(normalizedText),
        estimated: true,
    };
}

/**
 * Count rendered raw/final message lines. Message-level counts are intentionally
 * not cached: the host facade exposes no reliable tokenizer/model identity, and
 * a content or length match cannot prove that a later model switch used the
 * same tokenizer. Every call retries the real tokenizer before estimating.
 * @param {string} rawLine - Rendered message line before regex scripts
 * @param {string} finalLine - Rendered message line after regex scripts
 * @returns {Promise<MessageTokenStats>}
 */
export async function countMessageTokens(rawLine, finalLine) {
    return await countRenderedLines(rawLine, finalLine);
}

/**
 * Format a TokenCount with '~' when it came from the fallback estimator.
 * @param {TokenCount | null | undefined} tokenCount - Count to format
 * @returns {string}
 */
export function formatTokenCount(tokenCount) {
    if (!tokenCount || !Number.isFinite(tokenCount.count)) {
        return '?';
    }
    return formatTokenValue(tokenCount.count, tokenCount.estimated);
}

/**
 * Format raw count fields with their estimate flag.
 * @param {number | null | undefined} count - Count value
 * @param {boolean} [estimated] - Whether the value came from the fallback estimator
 * @returns {string}
 */
export function formatTokenValue(count, estimated = false) {
    if (typeof count !== 'number' || !Number.isFinite(count)) {
        return '?';
    }
    return `${estimated ? '~' : ''}${formatCompactTokenCount(count)}`;
}

/**
 * Format token counts compactly for logs and status surfaces.
 * @param {number} count - Token count
 * @returns {string}
 */
export function formatCompactTokenCount(count) {
    if (typeof count !== 'number' || !Number.isFinite(count)) {
        return '?';
    }

    const normalized = Math.trunc(count);
    const sign = normalized < 0 ? '-' : '';
    const absolute = Math.abs(normalized);
    if (absolute >= 1000) {
        return `${sign}${Math.floor(absolute / 1000)}k`;
    }
    return `${normalized}`;
}

/**
 * Count rendered raw/final message lines.
 * @param {string} rawLine
 * @param {string} finalLine
 * @returns {Promise<MessageTokenStats>}
 */
async function countRenderedLines(rawLine, finalLine) {
    const normalizedRawLine = String(rawLine ?? '');
    const normalizedFinalLine = String(finalLine ?? '');

    if (normalizedRawLine === normalizedFinalLine) {
        const tokens = await countTextTokens(normalizedRawLine);
        return {
            rawTokens: tokens.count,
            finalTokens: tokens.count,
            rawTokensEstimated: tokens.estimated,
            finalTokensEstimated: tokens.estimated,
        };
    }

    const [rawTokens, finalTokens] = await Promise.all([
        countTextTokens(normalizedRawLine),
        countTextTokens(normalizedFinalLine),
    ]);
    return {
        rawTokens: rawTokens.count,
        finalTokens: finalTokens.count,
        rawTokensEstimated: rawTokens.estimated,
        finalTokensEstimated: finalTokens.estimated,
    };
}

/**
 * Count with the active host tokenizer. Any failure returns null so the caller
 * falls back to the estimate; token counting never fails a run.
 * @param {string} text - Text to count
 * @returns {Promise<number | null>}
 */
async function countWithActiveTokenizer(text) {
    try {
        const count = await callTokenCountAsync(text);
        return normalizeTokenCount(count);
    } catch (_e) {
        return null;
    }
}

/**
 * Provide a conservative fallback when the runtime tokenizer is unavailable.
 * CJK text assumes two estimated tokens per CJK code point before the safety
 * margin; Latin text keeps the four-characters-per-token approximation. This
 * is an unmeasured budgeting heuristic that can overestimate or underestimate;
 * it is neither an upper bound nor the active model's exact token count.
 * @param {string} text - Text to estimate
 * @returns {number}
 */
function estimateTokenCount(text) {
    if (!text) {
        return 0;
    }
    const cjkCount = text.match(CJK_SCRIPT_REGEX)?.length || 0;
    if (cjkCount === 0) {
        return Math.max(1, Math.ceil(text.length / APPROX_TEXT_UNITS_PER_TOKEN));
    }
    const nonCjkText = text.replace(CJK_SCRIPT_REGEX, '');
    const nonCjkTokens = Math.ceil(nonCjkText.length / APPROX_TEXT_UNITS_PER_TOKEN);
    return Math.max(
        1,
        Math.ceil(
            (cjkCount * APPROX_CJK_TOKENS_PER_CHAR + nonCjkTokens) *
                APPROX_ESTIMATE_SAFETY_MULTIPLIER,
        ),
    );
}

/**
 * @param {unknown} count - Token count returned by SillyTavern
 * @returns {number | null}
 */
function normalizeTokenCount(count) {
    if (typeof count !== 'number' || !Number.isFinite(count)) {
        return null;
    }
    return Math.max(0, Math.ceil(count));
}

/**
 * Drop the retired per-message token counts. Marked counts are not persisted
 * any more, so this only removes Extension Chat Data written by older builds;
 * the next count asks the real tokenizer again.
 * @param {ChatMessage[] | unknown} chat
 * @returns {void}
 */
export function removeMessageTokenCaches(chat) {
    if (!Array.isArray(chat)) {
        return;
    }
    for (const message of chat) {
        if (!message || typeof message !== 'object') {
            continue;
        }
        const target = /** @type {{ extra?: Record<string, unknown> }} */ (message);
        if (target.extra && typeof target.extra === 'object') {
            delete target.extra[MESSAGE_TOKEN_CACHE_KEY];
        }
    }
}
