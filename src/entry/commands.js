import { layerLabel, listNonEmptyLayers } from '../foundation/constants.js';
import { getChat, getSlashCommand, getSlashCommandParser } from '../foundation/context.js';
import { warn } from '../foundation/logger.js';
import { getChatStore } from '../foundation/chat-store.js';
import { clearChatData } from '../core/chat-data.js';
import { buildInjection } from '../core/memory-injection.js';
import { getCurrentSummarizedBoundary } from '../core/snippet-provenance.js';

/**
 * Registers the extension's slash commands with the host parser.
 * Skips registration when the host omits the parser.
 * @returns {void}
 */
export function registerSlashCommands() {
    try {
        const SlashCommandParser = getSlashCommandParser();
        const SlashCommand = getSlashCommand();

        if (!SlashCommandParser?.addCommandObject || !SlashCommand) {
            warn('SlashCommandParser not available, skipping command registration.');
            return;
        }

        SlashCommandParser.addCommandObject(
            SlashCommand.fromProps({
                name: 'sc-status',
                callback: () => {
                    const store = getChatStore();
                    const boundary = getCurrentSummarizedBoundary(getChat(), store);
                    const lines = ['**分层摘要状态**'];
                    lines.push(
                        boundary < 0 ? '还没有摘要。' : `当前已摘要边界：${boundary}`,
                    );
                    const nonEmptyLayers = listNonEmptyLayers(store);
                    for (let k = nonEmptyLayers.length - 1; k >= 0; k--) {
                        const { index, layer } = nonEmptyLayers[k];
                        lines.push(`${layerLabel(index)}：${layer.length} 条摘要片段`);
                    }
                    return lines.join('\n');
                },
                helpString: '显示分层摘要的层级状态',
            }),
        );

        SlashCommandParser.addCommandObject(
            SlashCommand.fromProps({
                name: 'sc-clear',
                callback: async () => {
                    await clearChatData();
                    return '分层摘要记忆已清除，本扩展隐藏的消息已恢复。';
                },
                helpString: '清除当前聊天的全部分层摘要记忆，仅恢复本扩展隐藏的消息',
            }),
        );

        SlashCommandParser.addCommandObject(
            SlashCommand.fromProps({
                name: 'sc-preview',
                callback: () => {
                    return buildInjection(getChatStore().layers).text || '(还没有摘要)';
                },
                helpString: '预览将要注入的摘要块',
            }),
        );
    } catch (e) {
        warn('Could not register slash commands:', e);
    }
}
