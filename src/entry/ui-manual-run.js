import { MEMORY_MODES, TOAST_TITLE } from '../foundation/constants.js';
import { error } from '../foundation/logger.js';
import { getEffectiveSettings } from '../foundation/settings.js';
import {
    describeManualRun,
    ELASTIC_STRATEGIES,
    pauseAutoSummarization,
    resumeAutoSummarization,
    runManual,
} from '../core/summarizer-engine.js';
import { refreshPreview, refreshUi } from '../foundation/refresh.js';
import {
    clearManualProgressToast,
    confirmSlopBreaker,
    createManualProgressToast,
    manualRunView,
    showBusySummaryToast,
    showManualRunIdle,
    updateManualProgressToast,
} from './ui-dialogs.js';

/** @type {import('../core/summarizer-engine.js').ManualRunnerDeps} */
let manualRunnerDeps;

/**
 * @param {AbortController} controller
 * @returns {void}
 */
function cancelManualRun(controller) {
    controller.abort();
    manualRunnerDeps.queue.stop();
}

const MANUAL_RUN_BUSY_HTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>处理中...</span>';

/**
 * Shared manual-run driver for both strategies. `run` receives the engine
 * options carrying the abort signal; returning undefined skips the notice
 * because nothing ran.
 * @param {object | null} $button jQuery-wrapped trigger button, disabled while running.
 * @param {string} idleHtml Button html restored after the run.
 * @param {{ run: (options: object) => Promise<import('../core/run-outcome.js').ManualRunOutcome | undefined>, notify: import('../core/notify.js').NotifyAdapter, view: import('./ui-dialogs.js').ManualRunView }} ops
 * @returns {Promise<void>}
 */
async function runManualSummarization($button, idleHtml, { run, notify, view }) {
    const controller = new AbortController();
    let progressToast = null;
    const options = {
        signal: controller.signal,
        notify,
        onStart: (progress) => {
            progressToast = createManualProgressToast(progress, view, () =>
                cancelManualRun(controller),
            );
        },
        onProgress: (progress) => updateManualProgressToast(progressToast, progress, view),
    };
    if ($button) {
        $button.prop('disabled', true).html(MANUAL_RUN_BUSY_HTML);
    }
    let outcome;
    try {
        outcome = await run(options);
    } catch (err) {
        error(err);
        toastr.error('摘要失败，请查看控制台。', TOAST_TITLE, {
            timeOut: 8000,
        });
        return;
    } finally {
        clearManualProgressToast(progressToast);
        if ($button) {
            $button.prop('disabled', false).html(idleHtml);
        }
        refreshUi();
    }
    if (outcome !== undefined) {
        view.notices[outcome.status]?.(outcome);
        refreshPreview();
        reloadAfterManualRun(outcome);
    }
}

/**
 * Manual-run guard; the checks run in order and the first failure shows its toast.
 * @param {object} s Effective settings.
 * @returns {boolean} true when a manual run is allowed.
 */
function guardManualRun(s) {
    if (!s.enabled) {
        toastr.warning('请先启用分层摘要。');
        return false;
    }
    if (manualRunnerDeps.queue.isBusy()) {
        showBusySummaryToast();
        return false;
    }
    showManualCacheWarning(s);
    return true;
}

/**
 * Run Force Summarize from a panel button or the stale-cache advice toast.
 * @param {object | null} $button jQuery-wrapped trigger button, disabled while running.
 * @param {import('../core/notify.js').NotifyAdapter} notify Toastr-backed adapter distributed to core calls.
 * @returns {Promise<void>}
 */
async function executeForceSummarize($button, notify) {
    const s = getEffectiveSettings();
    if (!guardManualRun(s)) {
        return;
    }
    await runManualSummarization(
        $button,
        '<i class="fa-solid fa-bolt"></i><span>强制摘要</span>',
        {
            run: async (options) => {
                const preview = await describeManualRun(ELASTIC_STRATEGIES.FORCE);
                if (!preview.ready) {
                    showManualRunIdle(ELASTIC_STRATEGIES.FORCE);
                    return;
                }
                toastr.info(`有 ${preview.backlog} 个回合可处理，开始执行……`, TOAST_TITLE, {
                    timeOut: 2000,
                });

                return runManual(manualRunnerDeps, ELASTIC_STRATEGIES.FORCE, options);
            },
            notify,
            view: manualRunView(ELASTIC_STRATEGIES.FORCE),
        },
    );
}

/**
 * Run Slop Breaker after validating the current chat tail.
 * @param {object} buttonEl Clicked DOM element (`this` in the jQuery handler).
 * @param {import('../core/notify.js').NotifyAdapter} notify Toastr-backed adapter distributed to core calls.
 * @returns {Promise<void>}
 */
async function onSlopBreaker(buttonEl, notify) {
    const s = getEffectiveSettings();
    if (!guardManualRun(s)) {
        return;
    }

    const preview = await describeManualRun(ELASTIC_STRATEGIES.SLOP);
    if (!preview.ready) {
        showManualRunIdle(ELASTIC_STRATEGIES.SLOP);
        return;
    }
    if (!(await confirmSlopBreaker())) {
        return;
    }

    await runManualSummarization(
        $(buttonEl),
        '<i class="fa-solid fa-broom"></i><span>打破复读</span>',
        {
            run: (options) => runManual(manualRunnerDeps, ELASTIC_STRATEGIES.SLOP, options),
            notify,
            view: manualRunView(ELASTIC_STRATEGIES.SLOP),
        },
    );
}

function showManualCacheWarning(settings) {
    if (settings.memoryMode !== MEMORY_MODES.PREFIX_CACHE) {
        return;
    }
    toastr.info(
        '手动摘要会立即更新记忆，并可能让下一次请求失去缓存优惠。',
        TOAST_TITLE,
        { timeOut: 5000 },
    );
}

/**
 * @param {import('../core/run-outcome.js').ManualRunOutcome | undefined} outcome
 * @returns {void}
 */
function reloadAfterManualRun(outcome) {
    if (outcome?.status === 'completed') {
        reloadPage();
    }
}

/**
 * @returns {void}
 */
export function reloadPage() {
    const reload = globalThis.location?.reload;
    if (typeof reload === 'function') {
        reload.call(globalThis.location);
    }
}

/**
 * Stop the in-flight summarizer and latch autoPaused so automatic cycles do
 * not resume on their own while the user is still changing settings.
 * @returns {Promise<void>}
 */
async function onStopSummarize() {
    const status = await pauseAutoSummarization(manualRunnerDeps);
    if (status === 'already-paused') {
        toastr.info('已处于暂停状态。', TOAST_TITLE);
        return;
    }
    if (status === 'idle') {
        toastr.info('当前没有正在运行的任务。', TOAST_TITLE);
        return;
    }
    toastr.warning('摘要已暂停，进度已保存。按“继续”恢复。', TOAST_TITLE, {
        timeOut: 5000,
    });
    $(this).prop('disabled', true);
    setTimeout(() => $(this).prop('disabled', false), 2000);
    refreshUi();
}

/**
 * Clear the autoPaused latch and kick a single automatic cycle.
 * @returns {Promise<void>}
 */
async function onResumeSummarize() {
    const status = await resumeAutoSummarization(manualRunnerDeps);
    if (status === 'not-paused') {
        toastr.info('当前未暂停。', TOAST_TITLE);
        return;
    }
    toastr.success('已继续，自动摘要重新生效。', TOAST_TITLE, {
        timeOut: 3000,
    });
    refreshUi();
}

/**
 * @param {{ notify: import('../core/notify.js').NotifyAdapter, manualRunnerDeps: import('../core/summarizer-engine.js').ManualRunnerDeps }} deps
 * @returns {void}
 */
export function bindManualRunControls({ notify, manualRunnerDeps: runnerDeps }) {
    manualRunnerDeps = runnerDeps;
    $(document).on('click', '#sc_force_summarize, #sc_easy_force_summarize', async function () {
        await executeForceSummarize($(this), notify);
    });
    $(document).on('click', '#sc_slop_breaker, #sc_easy_slop_breaker', function () {
        return onSlopBreaker(this, notify);
    });
    $(document).on('click', '#sc_stale_cache_force', function () {
        const $toast = $(this).closest('.toast');
        if ($toast.length) {
            toastr.clear($toast);
        }
        void executeForceSummarize(null, notify);
    });
    $(document).on('click', '#sc_stop_summarize, #sc_easy_stop_summarize', onStopSummarize);
    $(document).on('click', '#sc_resume_summarize, #sc_easy_resume_summarize', onResumeSummarize);
}
