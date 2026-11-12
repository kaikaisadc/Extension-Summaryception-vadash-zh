import { ELASTIC_STRATEGIES } from '../core/summarizer-engine.js';
import { formatTokenValue } from '../core/token-count.js';
import {
    BATCH_PROGRESS,
    GHOST_PROGRESS,
    NOTIFY_EVENTS,
    TOAST_TITLE,
} from '../foundation/constants.js';

const IDLE_MESSAGES = {
    [ELASTIC_STRATEGIES.FORCE]: '没有可摘要的内容。',
    [ELASTIC_STRATEGIES.SLOP]: '暂时没有可重置的内容。请先等待一条 AI 回复。',
};

/**
 * The one "nothing to run" renderer: a pre-check that found no work and a run
 * that reported `idle` both land here.
 * @param {string} strategy Manual run strategy.
 * @returns {void}
 */
export function showManualRunIdle(strategy) {
    toastr.info(IDLE_MESSAGES[strategy], TOAST_TITLE);
}
/**
 * @returns {void}
 */
export function showBusySummaryToast() {
    toastr.warning('已在摘要中，请稍候。', TOAST_TITLE);
}

/**
 * @returns {void}
 */
export function showForegroundActiveToast() {
    toastr.warning('前台生成正在进行，请完成后再试。', TOAST_TITLE);
}

/**
 * Catch-up notices: the status picks the notice, the counts phrase it. A gate
 * block with no batch planned never started, which is its own notice.
 * @type {Record<string, ManualRunNotice>}
 */
const CATCHUP_NOTICES = {
    idle: () => showManualRunIdle(ELASTIC_STRATEGIES.FORCE),
    blocked: (outcome) => {
        if (outcome.totalBatches === 0) {
            showForegroundActiveToast();
            return;
        }
        toastr.warning(
            `补摘要已暂停于 ${outcome.completed}/${outcome.totalBatches}。请在生成结束后再试。`,
            TOAST_TITLE,
            { timeOut: 5000 },
        );
    },
    aborted: (outcome) =>
        toastr.warning(
            `补摘要已暂停于 ${outcome.completed}/${outcome.totalBatches}。进度已保存，下一条消息后继续。`,
            TOAST_TITLE,
            { timeOut: 5000 },
        ),
    failed: () =>
        toastr.error(
            '连续失败 3 次，API 可能不可用。已暂停补摘要，进度已保存，下一条消息后继续。',
            TOAST_TITLE,
            { timeOut: 8000 },
        ),
    completed: (outcome) =>
        toastr.success(`补摘要完成！共处理 ${outcome.completed} 个批次。`, TOAST_TITLE, {
            timeOut: 4000,
        }),
    partial: (outcome) =>
        toastr.warning(
            `补摘要结束。成功 ${outcome.completed} 个，失败 ${outcome.failed} 个（下次触发时重试）。`,
            TOAST_TITLE,
            { timeOut: 6000 },
        ),
};

const SLOP_STOPPED_NOTICE =
    '打破复读已停止。部分进度已保存，但预期的截断未完成。';

/**
 * A Slop Breaker that committed nothing reports failure; one that committed
 * part of the cut reports where it stopped.
 * @type {ManualRunNotice}
 */
function showSlopIncomplete(outcome) {
    if (outcome.completed === 0) {
        toastr.error('打破复读失败，未完成新的截断。', TOAST_TITLE, {
            timeOut: 6000,
        });
        return;
    }
    toastr.warning(
        `打破复读在 ${outcome.completed} 个批次后暂停。` +
            `${outcome.failed} 个失败；预期的截断未完成。`,
        TOAST_TITLE,
        { timeOut: 6000 },
    );
}

/** @type {Record<string, ManualRunNotice>} */
const SLOP_NOTICES = {
    idle: () => showManualRunIdle(ELASTIC_STRATEGIES.SLOP),
    completed: () =>
        toastr.success('打破复读完成，正在重新加载聊天上下文。', TOAST_TITLE, {
            timeOut: 3000,
        }),
    blocked: (outcome) => {
        if (outcome.totalBatches === 0) {
            showForegroundActiveToast();
            return;
        }
        toastr.warning(SLOP_STOPPED_NOTICE, TOAST_TITLE, { timeOut: 6000 });
    },
    aborted: (outcome) => {
        if (outcome.completed === 0) {
            toastr.warning('打破复读已停止，未完成新的截断。', TOAST_TITLE, {
                timeOut: 5000,
            });
            return;
        }
        toastr.warning(SLOP_STOPPED_NOTICE, TOAST_TITLE, { timeOut: 6000 });
    },
    failed: showSlopIncomplete,
    partial: showSlopIncomplete,
};

/**
 * @typedef {(outcome: import('../core/run-outcome.js').ManualRunOutcome) => void} ManualRunNotice
 */

/**
 * Display policy for one manual run strategy: the progress text core reports
 * counts for, and the notice each terminal status renders (ADR-0019).
 * @typedef {object} ManualRunView
 * @property {string} label - Progress text label for the active operation.
 * @property {string} title - User-visible progress toast title.
 * @property {Record<string, ManualRunNotice>} notices - Notice per Run Outcome status; an unmapped status stays silent.
 */

/** @type {Record<string, ManualRunView>} */
const MANUAL_RUN_VIEWS = {
    [ELASTIC_STRATEGIES.FORCE]: {
        label: '处理中',
        title: '分层摘要补摘要',
        notices: CATCHUP_NOTICES,
    },
    [ELASTIC_STRATEGIES.SLOP]: {
        label: '正在打破复读',
        title: '分层摘要打破复读',
        notices: SLOP_NOTICES,
    },
};

/**
 * @param {string} strategy Manual run strategy.
 * @returns {ManualRunView}
 */
export function manualRunView(strategy) {
    return MANUAL_RUN_VIEWS[strategy];
}

/**
 * @param {import('../core/summarizer-engine.js').ManualRunProgress} progress
 * @param {ManualRunView} view - Display policy of the running strategy.
 * @param {() => void} onCancel - Cancels the run from the toast's close button.
 * @returns {unknown}
 */
export function createManualProgressToast(progress, view, onCancel) {
    return toastr.info(getProgressText(progress, view.label), view.title, {
        timeOut: 0,
        extendedTimeOut: 0,
        tapToDismiss: false,
        closeButton: true,
        onCloseClick: onCancel,
    });
}

/**
 * @param {unknown} progressToast
 * @param {import('../core/summarizer-engine.js').ManualRunProgress} progress
 * @param {ManualRunView} view - Display policy of the running strategy.
 * @returns {void}
 */
export function updateManualProgressToast(progressToast, progress, view) {
    $(progressToast)
        .find('.toast-message')
        .text(`${getProgressText(progress, view.label)}\n点击 x 暂停`);
}

/**
 * @param {unknown} progressToast
 * @returns {void}
 */
export function clearManualProgressToast(progressToast) {
    if (progressToast) {
        toastr.clear(progressToast);
    }
}

/**
 * The toast action button has no handler at render time; the delegated
 * document click binding picks it up after the toast enters the DOM.
 * @param {import('../core/cache-staleness.js').StaleCacheAdvice} advice
 * @returns {unknown}
 */
export function showStaleCacheAdvice(advice) {
    return toastr.info(
        `供应商缓存已过期：最后一轮距今 ${advice.staleMinutes} 分钟，缓存有效期为 ${advice.ttlMinutes} 分钟。` +
            `约 ${advice.queuedTurns} 个回合正在等待摘要。` +
            '现在摘要，下一条消息只需在更小的提示词上支付一次完整输入价格；先发消息则会支付两次完整价格。' +
            '<br><button id="sc_stale_cache_force" class="menu_button" style="margin-top: 8px;">' +
            '<i class="fa-solid fa-bolt"></i> 立即强制摘要</button>',
        '分层摘要 — 缓存过期',
        {
            timeOut: 60000,
            extendedTimeOut: 60000,
            closeButton: true,
            tapToDismiss: false,
            escapeHtml: false,
        },
    );
}

/**
 * @returns {Promise<boolean>}
 */
export function confirmSlopBreaker() {
    return new Promise((resolve) => {
        const $overlay = $('<div class="sc-catchup-overlay">')
            .html(
                `
        <div class="sc-catchup-modal">
        <h3>运行打破复读？</h3>
        <div class="sc-catchup-dialog">
        <p>这会摘要当前活跃的对话上下文，包括通常保留为原文的消息。适用于 AI 反复复读短语、格式或纠错时。如果最新消息是 AI 回复，它会被提交进记忆，之后可能不再适合滑动重掷或重新生成。</p>
        <hr>
        <div class="sc-catchup-options">
        <button id="sc_slop_breaker_confirm" class="menu_button">
        <i class="fa-solid fa-broom"></i>
        <div class="sc-btn-text">
        <span class="sc-btn-label">打破复读</span>
        </div>
        </button>
        <button id="sc_slop_breaker_cancel" class="menu_button">
        <i class="fa-solid fa-xmark"></i>
        <div class="sc-btn-text">
        <span class="sc-btn-label">取消</span>
        </div>
        </button>
        </div>
        </div>
        </div>
        `,
            )
            .appendTo('body');

        $overlay.find('#sc_slop_breaker_confirm').on('click', () => {
            $overlay.remove();
            resolve(true);
        });
        $overlay.find('#sc_slop_breaker_cancel').on('click', () => {
            $overlay.remove();
            resolve(false);
        });
    });
}

/**
 * Counted views render `text: done / total` lines; message views render one
 * static string and ignore counts.
 * @typedef {object} ProgressView
 * @property {string} [subtitle] - Title suffix after the toast title; omitted renders the bare title.
 * @property {boolean} [tracksForegroundPause] - Track the open toast so a foreground generation can reword it while summarization waits.
 * @property {string} [text] - Action text leading each counted progress line.
 * @property {string} [message] - Static toast message; replaces counted lines.
 * @property {boolean} [progressBar] - Show toastr's progress bar.
 * @property {number} [everyN] - Render only when processed is a multiple of this (counted views only).
 */

/**
 * Display policy lives in the UI; core reports counts only.
 * @type {Record<string, ProgressView>}
 */
const NOTIFY_PROGRESS_VIEWS = {
    [GHOST_PROGRESS.HIDE]: { subtitle: '隐藏消息', text: '正在隐藏消息', everyN: 1 },
    [GHOST_PROGRESS.UNHIDE]: { subtitle: '取消隐藏', text: '正在取消隐藏消息', everyN: 10 },
    [BATCH_PROGRESS.MEMORY]: {
        message: '正在更新对话记忆…',
        progressBar: true,
        tracksForegroundPause: true,
    },
};

/**
 * @type {ProgressView}
 */
const DEFAULT_PROGRESS_VIEW = { subtitle: '处理中', text: '处理中', everyN: 1 };

/**
 * Terminal notices render right after the progress toast closes (ADR-0019).
 * Unknown kinds close silently.
 * @type {Record<string, () => void>}
 */
const NOTIFY_TERMINAL_VIEWS = {
    [BATCH_PROGRESS.UPDATED]: () =>
        toastr.success('对话记忆已更新。', TOAST_TITLE, { timeOut: 3000 }),
    [BATCH_PROGRESS.ABORTED]: () =>
        toastr.warning('对话记忆更新已停止。', TOAST_TITLE, { timeOut: 3000 }),
    [BATCH_PROGRESS.FAILED]: () =>
        toastr.warning('对话记忆未更新。', TOAST_TITLE, { timeOut: 3000 }),
    [GHOST_PROGRESS.UNHIDDEN]: () =>
        toastr.success('聊天已恢复。', TOAST_TITLE, { timeOut: 3000 }),
};

/**
 * Fixed display duration for retry warnings. Independent of the backoff wait,
 * which lives in retry policy (ADR-0019).
 */
const RETRY_NOTICE_MS = 5000;

/**
 * Per-kind transient notice policy (ADR-0019): severity, fixed display
 * duration, and phrasing built from the event's structured payload. Durations
 * never derive from core wait times; unknown kinds stay silent.
 * @type {Record<string, (event: import('../core/notify.js').NotifyTransientEvent) => void>}
 */
const NOTIFY_TRANSIENT_VIEWS = {
    [NOTIFY_EVENTS.RUN_ABORTED]: () =>
        toastr.warning('摘要已停止。', TOAST_TITLE, { timeOut: 3000 }),
    [NOTIFY_EVENTS.RUN_FAILED]: (event) =>
        toastr.error(
            `摘要失败` +
                `${event.retriesExhausted ? `，已尝试 ${event.attempts} 次` : ''}` +
                `${event.status ? `（${event.status}）` : ''}。已跳过该批次，下次触发时重试。`,
            TOAST_TITLE,
            { timeOut: 8000 },
        ),
    [NOTIFY_EVENTS.EASY_GUARD_BLOCKED]: (event) =>
        toastr.error(
            `简易模式阻止了${event.label}：摘要请求为 ` +
                `${formatTokenValue(event.tokens, event.estimated)} Token，超过简易摘要器上下文上限 ` +
                `${formatTokenValue(event.limit)}。` +
                '请调高简易上下文滑块或切换到高级模式。',
            TOAST_TITLE,
            { timeOut: 10000 },
        ),
    [NOTIFY_EVENTS.RETRY_WAIT]: (event) =>
        toastr.warning(
            `摘要请求失败，正在重试（第 ${(event.attempt ?? 0) + 1} 次，共 ${event.maxRetries ?? 0} 次）……`,
            TOAST_TITLE,
            { timeOut: RETRY_NOTICE_MS },
        ),
    [NOTIFY_EVENTS.ROUTE_CYCLE_WAIT]: () =>
        toastr.warning('两条摘要路由均失败，正在重试主路由……', TOAST_TITLE, {
            timeOut: RETRY_NOTICE_MS,
        }),
    [NOTIFY_EVENTS.LANGUAGE_MIX_RETRY]: (event) =>
        toastr.warning(
            `摘要回复包含过多中文文本（${event.percent ?? '?'}%），正在重试……`,
            TOAST_TITLE,
            { timeOut: RETRY_NOTICE_MS },
        ),
    [NOTIFY_EVENTS.PROMOTION_STARTED]: (event) =>
        toastr.info(
            `正在提升 ${event.mergedCount} 条记忆：第 ${event.fromLayer} 层 → ` +
                `第 ${event.toLayer} 层`,
            TOAST_TITLE,
            { timeOut: 3000, progressBar: true },
        ),
};

/**
 * @typedef {object} ToastrProgressHandle
 * @property {object} toast - Active toastr element.
 * @property {ProgressView} view - Matched display policy for the label.
 * @property {number} total - Total items reported by the progress event.
 */

/** Open "Updating conversation memory" toast element, kept for the pause reword. */
let activeMemoryToast = null;

const MEMORY_PAUSED_MESSAGE = '聊天时暂停，收到你的回复后更新记忆。';

/**
 * @returns {void}
 */
export function pauseMemoryToastForGeneration() {
    if (!activeMemoryToast) {
        return;
    }
    $(activeMemoryToast).find('.toast-message').text(MEMORY_PAUSED_MESSAGE);
}

/**
 * Display durations and update cadence live here. Events carry structured
 * data only (ADR-0019).
 * @returns {import('../core/notify.js').NotifyAdapter}
 */
export function createToastrNotifyAdapter() {
    return {
        transient(event) {
            const kind = /** @type {string} */ (event?.kind);
            const view = NOTIFY_TRANSIENT_VIEWS[kind];
            if (view) {
                view(/** @type {import('../core/notify.js').NotifyTransientEvent} */ (event));
            }
        },
        progress(event) {
            const view = NOTIFY_PROGRESS_VIEWS[event.label] || DEFAULT_PROGRESS_VIEW;
            const toast = toastr.info(
                view.message ?? `${view.text}: 0 / ${event.total}`,
                view.subtitle ? `${TOAST_TITLE} - ${view.subtitle}` : TOAST_TITLE,
                {
                    timeOut: 0,
                    extendedTimeOut: 0,
                    tapToDismiss: false,
                    ...(view.progressBar ? { progressBar: true } : {}),
                },
            );
            if (view.tracksForegroundPause) {
                activeMemoryToast = toast;
            }
            return { toast, view, total: event.total };
        },
        update(handle, event) {
            if (!handle) {
                return;
            }
            const progress = /** @type {ToastrProgressHandle} */ (handle);
            if (!progress.view.everyN || event.processed % progress.view.everyN !== 0) {
                return;
            }
            const pct = Math.round((event.processed / progress.total) * 100);
            $(progress.toast)
                .find('.toast-message')
                .text(`${progress.view.text}: ${event.processed} / ${progress.total} (${pct}%)`);
        },
        clear(handle, event) {
            if (handle) {
                toastr.clear(/** @type {ToastrProgressHandle} */ (handle).toast);
            }
            if (
                activeMemoryToast &&
                /** @type {ToastrProgressHandle} */ (handle)?.toast === activeMemoryToast
            ) {
                activeMemoryToast = null;
            }
            const terminal = event?.kind
                ? NOTIFY_TERMINAL_VIEWS[/** @type {string} */ (event.kind)]
                : null;
            if (terminal) {
                terminal();
            }
        },
    };
}

/**
 * @param {import('../core/summarizer-engine.js').ManualRunProgress} progress
 * @param {string} label - Progress text label for the active operation.
 * @returns {string}
 */
function getProgressText(progress, label) {
    const pct = Math.round((progress.completed / progress.totalBatches) * 100);
    const failStr = progress.failed > 0 ? ` | ${progress.failed} 个失败` : '';
    return `${label}：${progress.completed} / ${progress.totalBatches} 个批次（${pct}%）${failStr}`;
}
