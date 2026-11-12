export const selectorFor = (id) => `label[for="${id}"]`;
export const controlFor = (id) => `#${id}`;

export const basicHelp = ({ selector, title, short, controls, controlsText, when, risk }) => ({
    selector,
    title,
    short,
    detail: `${controlsText} ${when} ${risk}`,
    controls,
});

const sliderHelp = ({ selector, title, short, meaning, higher, lower, defaultText, controls }) => ({
    selector,
    title,
    short,
    detail: `${meaning} 调高：${higher} 调低：${lower} 默认：${defaultText}`,
    controls,
});

const MEMORY_MODE_HELP = Object.freeze({
    balanced: {
        title: '默认',
        short: '让近期聊天保持在实用范围内，并在内容溢出时逐步摘要。',
        controlsText: '使用 22k 原文保留区 + 6k 待摘要区的滚动窗口，并持续生成摘要。',
        when: '提示词缓存不可用、效果较弱或不值得围绕它规划时使用。',
        risk: '提示词不断变化时，每一轮都可能按完整输入价格计费；是否产生缓存优惠取决于供应商。',
    },
    prefix_cache: {
        title: '前缀缓存',
        short: '适用于可复用未变提示词开头的普通缓存，即使末尾发生变化。',
        controlsText: '让原文聊天先积累到 20k 原文保留区 + 16k 待摘要区，再一次性摘要较旧聊天。',
        when: '缓存输入更便宜，且供应商能复用部分提示词前缀时使用。',
        risk: '提示词更大，且一次摘要刷新会开启新的缓存前缀。普通世界书无需改动。',
    },
});

const memoryModeHelp = ({ selector, controls, mode }) =>
    basicHelp({
        selector,
        controls,
        ...MEMORY_MODE_HELP[mode],
    });

const CONNECTION_GROUPS = [
    {
        key: 'layer0',
        label: '第 0 层',
        route: '用于新第 0 层记忆和第 0 层重做的原文聊天主摘要路由。',
        sourceId: 'summaryception_connection_source',
        responseLengthId: 'sc_summarizer_response_length',
        requestTimeoutId: 'sc_request_timeout',
        profileId: 'summaryception_connection_profile',
        sourceRisk: '路由太弱或配置错误会让每条新摘要都更差。',
        responseDefault: '0 表示使用所选供应商的默认值。',
    },
    {
        key: 'merge',
        label: '合并',
        route: '第 1+ 层深层合并的可选路由，在较低层记忆合并为更深层记忆时使用。',
        sourceId: 'summaryception_merge_connection_source',
        responseLengthId: 'sc_merge_summarizer_response_length',
        requestTimeoutId: 'sc_merge_request_timeout',
        profileId: 'summaryception_merge_connection_profile',
        sourceRisk: '合并路由不匹配时，可能用不同风格改写稳定记忆。',
        responseDefault: '0 表示使用所选供应商的默认值。',
    },
    {
        key: 'fallback',
        label: '备用连接',
        route: '仅在主路由出现可重试失败后使用的备用摘要路由。',
        sourceId: 'summaryception_fallback_connection_source',
        responseLengthId: 'sc_fallback_summarizer_response_length',
        requestTimeoutId: 'sc_fallback_request_timeout',
        profileId: 'summaryception_fallback_connection_profile',
        sourceRisk: '若与主路由相同，则会被忽略。',
        responseDefault: '0 表示使用所选供应商的默认值。',
    },
    {
        key: 'auditor',
        label: '审计器',
        route: '用于后台审计调用的连续性审计专用路由。',
        sourceId: 'summaryception_auditor_connection_source',
        responseLengthId: 'sc_auditor_summarizer_response_length',
        requestTimeoutId: 'sc_auditor_request_timeout',
        profileId: 'summaryception_auditor_connection_profile',
        sourceRisk: '审计路由卡住时，连续性状态会一直陈旧，直到恢复。',
        responseDefault: '0 表示使用所选供应商的默认值。',
    },
];

const CONNECTION_ENTRY_BUILDERS = [
    connectionSourceHelp,
    responseLengthHelp,
    requestTimeoutHelp,
    profileHelp,
];

export const CONNECTION_HELP_ENTRIES = CONNECTION_GROUPS.flatMap((group) =>
    CONNECTION_ENTRY_BUILDERS.map((build) => build(group)).filter(Boolean),
);

function connectionSourceHelp(group) {
    return [
        `${group.key}_source`,
        basicHelp({
            selector: selectorFor(group.sourceId),
            title: `${group.label}来源`,
            short: getConnectionSourceShort(group),
            controls: [controlFor(group.sourceId)],
            controlsText: `控制这条路由：${group.route}`,
            when: getConnectionSourceWhen(group),
            risk: group.sourceRisk,
        }),
    ];
}

function responseLengthHelp(group) {
    return [
        `${group.key}_response_length`,
        basicHelp({
            selector: selectorFor(group.responseLengthId),
            title: `${group.label}响应长度`,
            short: '默认/连接配置路由的最大响应长度。',
            controls: [controlFor(group.responseLengthId)],
            controlsText: `控制${group.route}的响应长度上限`,
            when: '供应商拒绝较大的非流式上限，或你需要更短摘要时使用。',
            risk: `设置过低会截断摘要。${group.responseDefault}`,
        }),
    ];
}

function requestTimeoutHelp(group) {
    return [
        `${group.key}_request_timeout`,
        basicHelp({
            selector: selectorFor(group.requestTimeoutId),
            title: `${group.label}请求超时`,
            short: '单次尝试的秒级超时；超时后请求会中止并重试。',
            controls: [controlFor(group.requestTimeoutId)],
            controlsText: `控制单次${group.label}摘要尝试在放弃前等待多久。`,
            when: '本地模型较慢且确实超过默认值时可调高；想更快故障转移时可调低。',
            risk: '过低会中止本可完成的慢响应；过高会在后端卡死时拖住聊天。',
        }),
    ];
}

function profileHelp(group) {
    return [
        `${group.key}_profile`,
        basicHelp({
            selector: selectorFor(group.profileId),
            title: `${group.label}连接配置`,
            short: '此路由使用的已保存 SillyTavern 连接配置。',
            controls: [controlFor(group.profileId)],
            controlsText: `控制由哪个已保存的 SillyTavern 连接配置驱动${group.route}`,
            when: '来源选择“连接配置”时使用。',
            risk: '连接配置的格式设置和模型选择可能改变摘要质量。',
        }),
    ];
}

function getConnectionSourceShort(group) {
    if (group.key === 'auditor') {
        return '连续性审计调用的专用路由。';
    }
    if (group.key === 'fallback') {
        return '主路由出现可重试失败后的备用路由。';
    }
    if (group.key === 'merge') {
        return '深层记忆合并的可选路由。';
    }
    return '用于把原文聊天压缩为第 0 层摘要的路由。';
}

function getConnectionSourceWhen(group) {
    if (group.key === 'auditor') {
        return '默认路由不是最佳审计模型，或审计器持续故障转移时使用。';
    }
    if (group.key === 'fallback') {
        return '只有在你有第二条可用路由时才启用；否则保持禁用。';
    }
    if (group.key === 'merge') {
        return '深层记忆合并需要不同或更强模型时使用。';
    }
    return '默认路由不是最佳摘要模型时使用。';
}

function defineHelpMap(entries) {
    const result = {};
    const seen = new Set();
    for (const [key, entry] of entries) {
        if (seen.has(key)) {
            throw new Error(`Duplicate Summaryception settings help key: ${key}`);
        }
        seen.add(key);
        result[key] = entry;
    }
    return Object.freeze(result);
}

const HELP_ENTRIES = [
    [
        'enabled',
        basicHelp({
            selector: selectorFor('sc_mode_easy'),
            title: '分层摘要模式',
            short: '选择关闭、简易或高级操作模式。',
            controls: [
                controlFor('sc_mode_off'),
                controlFor('sc_mode_easy'),
                controlFor('sc_mode_advanced'),
            ],
            controlsText:
                '可关闭分层摘要、以安全的简易默认值运行，或展开全部高级设置。',
            when: '需要让当前聊天保留分层记忆时使用。',
            risk: '关闭后会停止记忆注入和后台摘要，直到重新选择其他模式。',
        }),
    ],
    [
        'apply_regex_scripts',
        basicHelp({
            selector: selectorFor('sc_apply_regex_scripts'),
            title: '应用正则脚本',
            short: '让摘要看到经 ST 正则清理后的文本。',
            controls: [controlFor('sc_apply_regex_scripts')],
            controlsText:
                '决定文本在送入摘要器前是否先经过 SillyTavern 正则脚本处理。',
            when: '主模型也看到正则清理后的文本时开启。',
            risk: '关闭后，摘要可能记住 RP 模型从未实际看到的文本。',
        }),
    ],
    [
        'strip_chinese_ideographs',
        basicHelp({
            selector: selectorFor('sc_strip_chinese_ideographs'),
            title: '删除汉字（仅英文摘要使用）',
            short: '从摘要器回复中删除汉字。',
            controls: [controlFor('sc_strip_chinese_ideographs')],
            controlsText:
                '决定摘要是否删除汉字，并丢弃汉字污染严重的回复。',
            when: '摘要器偶尔把中文文本混入记忆时使用。',
            risk: '合法的中文姓名和文本也会从已提交记忆中被删除。',
        }),
    ],
    [
        'mask_user_role_as_assistant',
        basicHelp({
            selector: selectorFor('sc_mask_user_role_as_assistant'),
            title: '伪装用户角色',
            short: "把你的发言作为 AI 自己的话发送，让模型不再给你的角色“主角光环”。",
            controls: [
                controlFor('sc_mask_user_role_as_assistant'),
                controlFor('sc_mask_user_role_mode'),
            ],
            controlsText:
                '发送请求前，把你的聊天回合重新标记为 AI 自己的话，让模型不再给你的角色“主角光环”。聊天补全模型经过 RLHF 训练，会把用户角色中的内容当成需要讨好和保护的真人，所以你的角色永远不会真正失败。把回合改成助手角色后，整段日志更像一个叙事者在讲故事，你也就只是另一个会受伤、会惊讶、会被拒绝的角色。此选项只影响发出的请求；已保存的聊天保持原样。最适合第三人称角色扮演，并把预设改成不再出现“用户”或“你”。各模式：标记在前会为需要用户消息的 API 在顶部添加一条一次性用户消息；不使用标记会把每一轮都变成 AI（仅请求内，零用户消息）；标记在后会把这条一次性用户消息放在末尾；保留最后一条用户消息则让你的最后一条消息保持为用户，便于 Rabbit-Response-Team 等扩展把指令注入那里。',
            when: '希望模型不再庇护你的角色、直接按场景演出时使用。',
            risk: '供应商可能会规范化或拒绝异常角色布局及合成标记消息；零用户消息的无标记请求也可能被直接拒绝。标记模式正是为此准备。',
        }),
    ],
    [
        'verbatim_token_budget',
        sliderHelp({
            selector: selectorFor('sc_verbatim_token_budget'),
            title: '近期原文预算',
            short: '保留为原文的近期聊天。',
            controls: [
                controlFor('sc_verbatim_token_budget'),
                controlFor('sc_verbatim_token_budget_val'),
            ],
            meaning:
                '设置逐字保留的近期原文范围；较旧原文聊天在待摘要区等待。',
            higher: '保留更多精确近期聊天，但占用更多上下文。',
            lower: '更快前移近期边界。',
            defaultText: '均衡模式为 22k；模式预设可能改变该值。',
        }),
    ],
    [
        'queued_token_budget',
        sliderHelp({
            selector: selectorFor('sc_queued_token_budget'),
            title: '待摘要聊天预算',
            short: '为自动摘要保留的较旧原文聊天。',
            controls: [
                controlFor('sc_queued_token_budget'),
                controlFor('sc_queued_token_budget_val'),
            ],
            meaning:
                '设置较旧原文聊天的待摘要范围。自动摘要会等到“近期原文 + 待摘要区”已满才启动。',
            higher: '一次摘要前允许积累更多原文聊天。',
            lower: '近期原文区满后更快摘要待摘要聊天。',
            defaultText: '均衡模式为 6k；模式预设可能改变该值。',
        }),
    ],
    [
        'memory_token_budget',
        sliderHelp({
            selector: selectorFor('sc_memory_token_budget'),
            title: '记忆注入预算',
            short: '发送给模型的记忆块最大大小。',
            controls: [
                controlFor('sc_memory_token_budget'),
                controlFor('sc_memory_token_budget_val'),
            ],
            meaning:
                '通过直接注入或宏发送的已提交分层摘要记忆上限；经过压缩和深层合并后，实际用量可能低于该值。',
            higher: '在深层合并压力出现前保留更详细的记忆。',
            lower: '更快提升并压缩记忆；4k 是整合最激进时的硬下限。',
            defaultText: '10k。',
        }),
    ],
    [
        'advanced_model_context',
        sliderHelp({
            selector: selectorFor('sc_advanced_model_context'),
            title: '模型上下文',
            short: '摘要器容量；自动调整批量大小。',
            controls: [
                controlFor('sc_advanced_model_context'),
                controlFor('sc_advanced_model_context_val'),
            ],
            meaning: '设置第 0 层摘要调用的来源上限和批量触发条件。',
            higher: '大上下文模型可处理更大批次。',
            lower: '让每次摘要请求更小。',
            defaultText: '48k；可在“专家调优”中覆盖。',
        }),
    ],
    [
        'layer0_summary_token_target',
        sliderHelp({
            selector: selectorFor('sc_layer0_summary_token_target'),
            title: '叙事目标长度',
            short: '每个第 0 层叙事段落的目标长度。',
            controls: [
                controlFor('sc_layer0_summary_token_target'),
                controlFor('sc_layer0_summary_token_target_val'),
            ],
            meaning:
                '单条第 0 层摘要中 <narrative> 部分的目标长度。由模型上下文自动推导；可在此覆盖。',
            higher: '每条第 0 层叙事保留更多时间顺序细节。',
            lower: '更强压缩每条叙事，为记忆预算留出更多空间。',
            defaultText: '280；由模型上下文自动推导。',
        }),
    ],
    [
        'max_l0_source_tokens',
        sliderHelp({
            selector: selectorFor('sc_max_l0_source_tokens'),
            title: '每次调用最大来源',
            short: '单次第 0 层调用发送的原文聊天硬上限。',
            controls: [
                controlFor('sc_max_l0_source_tokens'),
                controlFor('sc_max_l0_source_tokens_val'),
            ],
            meaning: '设置单次第 0 层摘要调用发送的原文聊天最大来源大小。',
            higher: '上下文更大的模型可处理更大批次。',
            lower: '让每次摘要请求更小、更安全。',
            defaultText: '24k；由模型上下文自动推导。',
        }),
    ],
    [
        'min_summary_budget',
        sliderHelp({
            selector: selectorFor('sc_min_summary_budget'),
            title: '每次调用目标来源',
            short: '均衡模式下每个第 0 层分区偏好的原文聊天大小。',
            controls: [
                controlFor('sc_min_summary_budget'),
                controlFor('sc_min_summary_budget_val'),
            ],
            meaning:
                '设置均衡模式下每个第 0 层分区的偏好大小。“近期原文 + 待摘要区”的填充程度控制自动摘要。',
            higher: '在来源上限内减少调用次数、增大单次调用。',
            lower: '产生更小分区和更多摘要调用。',
            defaultText: '16k；由模型上下文自动推导。',
        }),
    ],
    [
        'min_summary_turns',
        sliderHelp({
            selector: selectorFor('sc_min_summary_turns'),
            title: '最少摘要回合数',
            short: '一批内容可运行前所需的最少助手回合数。',
            controls: [controlFor('sc_min_summary_turns'), controlFor('sc_min_summary_turns_val')],
            meaning:
                '预算已就绪的第 0 层批次可运行前所需的最少助手回合数。',
            higher: '等待更多对话后再摘要。',
            lower: '允许更短的批次被摘要。',
            defaultText: '3。',
        }),
    ],
    [
        'max_summary_turns',
        sliderHelp({
            selector: selectorFor('sc_max_summary_turns'),
            title: '最多摘要回合数',
            short: '单个第 0 层批次最多容纳的助手回合数。',
            controls: [controlFor('sc_max_summary_turns'), controlFor('sc_max_summary_turns_val')],
            meaning: '单次第 0 层摘要请求中的最大助手回合数。',
            higher: '每次摘要调用装入更多聊天。',
            lower: '让每次摘要请求更小、更易处理。',
            defaultText: '8。',
        }),
    ],
    [
        'cache_ttl',
        sliderHelp({
            selector: selectorFor('sc_cache_ttl'),
            title: '缓存有效期',
            short: '供应商保留缓存提示词前缀的分钟数。',
            controls: [controlFor('sc_cache_ttl'), controlFor('sc_cache_ttl_val')],
            meaning:
                '仅前缀缓存模式使用。当最后一轮早于有效期时，缓存视为过期。加载此类聊天会建议强制摘要：下一条消息无论如何都会按完整输入价格计费，先摘要可避免重复支付两次完整价格。',
            higher: '更晚出现提前摘要建议。',
            lower: '缓存存活时间短时更早建议提前摘要。',
            defaultText: '30 分钟。',
        }),
    ],
    [
        'snippets_per_layer',
        sliderHelp({
            selector: selectorFor('sc_snippets_per_layer'),
            title: '每层记忆上限',
            short: '某层被推向更深层前的数量上限。',
            controls: [
                controlFor('sc_snippets_per_layer'),
                controlFor('sc_snippets_per_layer_val'),
            ],
            meaning: '某层在深层合并压力出现前应保留的最大摘要片段数。',
            higher: '每层保留更多独立记忆。',
            lower: '更早把记忆合并到更深层。',
            defaultText: '24。',
        }),
    ],
    [
        'snippets_per_promotion',
        sliderHelp({
            selector: selectorFor('sc_snippets_per_promotion'),
            title: '每次合并记忆数',
            short: '一次合并多少条旧记忆。',
            controls: [
                controlFor('sc_snippets_per_promotion'),
                controlFor('sc_snippets_per_promotion_val'),
            ],
            meaning:
                '某层把记忆提升到更深层时，一次打包多少条最旧的摘要片段。',
            higher: '减少深层合并次数并增大单次合并，适合 2000 条以上消息的长聊天。',
            lower: '更频繁地进行较小的深层合并，适合较短聊天。',
            defaultText: '3。',
        }),
    ],
    [
        'memory_mode_balanced',
        memoryModeHelp({
            selector: selectorFor('sc_memory_mode_balanced'),
            controls: [controlFor('sc_memory_mode_balanced')],
            mode: 'balanced',
        }),
    ],
    [
        'memory_mode_prefix_cache',
        memoryModeHelp({
            selector: selectorFor('sc_memory_mode_prefix_cache'),
            controls: [controlFor('sc_memory_mode_prefix_cache')],
            mode: 'prefix_cache',
        }),
    ],
    [
        'custom_memory_position',
        basicHelp({
            selector: selectorFor('sc_custom_memory_position'),
            title: '记忆位置',
            short: '分层摘要记忆在 ST 提示词中的位置。',
            controls: [controlFor('sc_custom_memory_position')],
            controlsText:
                '选择合并记忆块是直接注入，还是以 {{summaryception_memory}} 宏提供。',
            when: '提示词布局需要把记忆放在特定位置时使用。',
            risk: '记忆放得太晚、太早，或只放在未使用的宏里，都可能被模型忽略。',
        }),
    ],
    [
        'custom_memory_role',
        basicHelp({
            selector: selectorFor('sc_custom_memory_role'),
            title: '记忆角色',
            short: '记忆作为聊天消息注入时使用的角色。',
            controls: [controlFor('sc_custom_memory_role')],
            controlsText: '设置自定义记忆作为聊天消息发送时的消息角色。',
            when: '供应商对系统、用户和助手消息区别对待时使用。',
            risk: '角色选错会让记忆读起来像指令或对话。',
        }),
    ],
    [
        'custom_memory_depth',
        basicHelp({
            selector: selectorFor('sc_custom_memory_depth'),
            title: '聊天深度',
            short: '使用“聊天内”时记忆插入到往前多远的位置。',
            controls: [controlFor('sc_custom_memory_depth')],
            controlsText:
                '设置“聊天内”自定义记忆距最新回合往前多少条消息。',
            when: '仅在记忆位置设为“聊天内”时使用。',
            risk: '深度不合适会让记忆离最新回合太近或太远。',
        }),
    ],
    [
        'clear_memory',
        basicHelp({
            selector: controlFor('sc_clear_memory'),
            title: '清空记忆',
            short: '清除当前聊天的全部记忆，并仅恢复本扩展隐藏的消息。',
            controls: [controlFor('sc_clear_memory')],
            controlsText:
                '此操作无法撤销。若要从头重建记忆：1. 点击“清空记忆”。2. 强制刷新页面（Ctrl+F5）。3. 打开浏览器控制台（F12）后点击“强制摘要”，观察进度。',
            when: '记忆严重偏离、干净重跑比修补更合适时使用。',
            risk: '当前聊天的所有摘要和已存记忆都会被删除，必须从头重新摘要。',
        }),
    ],
    ...CONNECTION_HELP_ENTRIES,
    [
        'easy_memory_mode_balanced',
        memoryModeHelp({
            selector: selectorFor('sc_easy_memory_mode_balanced'),
            controls: [controlFor('sc_easy_memory_mode_balanced')],
            mode: 'balanced',
        }),
    ],
    [
        'easy_memory_mode_prefix_cache',
        memoryModeHelp({
            selector: selectorFor('sc_easy_memory_mode_prefix_cache'),
            controls: [controlFor('sc_easy_memory_mode_prefix_cache')],
            mode: 'prefix_cache',
        }),
    ],
    [
        'layer0_system_prompt_preset',
        basicHelp({
            selector: selectorFor('sc_summarizer_system_prompt_preset'),
            title: '第 0 层系统预设',
            short: '选择第 0 层系统提示词来源。',
            controls: [controlFor('sc_summarizer_system_prompt_preset')],
            controlsText:
                '在默认第 0 层系统提示词和自定义文本之间选择。',
            when: '需要更改第 0 层摘要的角色指令时使用。',
            risk: '替换系统指令可能改变摘要结构。',
        }),
    ],
    [
        'layer0_system_prompt',
        basicHelp({
            selector: selectorFor('sc_summarizer_system_prompt'),
            title: '第 0 层系统提示词',
            short: '原文聊天摘要的指令风格。',
            controls: [controlFor('sc_summarizer_system_prompt')],
            controlsText:
                '设置随原文聊天摘要请求发送的系统指令。',
            when: '摘要器需要不同角色或更严格输出风格时开启。',
            risk: '指令过多会让摘要冗长或不一致。',
        }),
    ],
    [
        'prompt_preset',
        basicHelp({
            selector: selectorFor('sc_prompt_preset'),
            title: '第 0 层用户预设',
            short: '选择第 0 层用户提示词模板。',
            controls: [controlFor('sc_prompt_preset')],
            controlsText:
                '在默认第 0 层用户提示词和自定义版本之间选择。',
            when: '在默认叙事记忆和自定义提示词之间切换时使用。',
            risk: '更改预设会改变之后摘要保留的内容。',
        }),
    ],
    [
        'layer0_user_prompt',
        basicHelp({
            selector: selectorFor('sc_summarizer_user_prompt'),
            title: '第 0 层用户提示词',
            short: '把原文聊天转换为第 0 层记忆的模板。',
            controls: [controlFor('sc_summarizer_user_prompt')],
            controlsText:
                '设置原文聊天摘要的用户提示词；可使用 {{player_name}}、{{context_str}} 和 {{story_txt}} 变量。',
            when: '当前预设总是漏掉你在意的事实时使用。',
            risk: '缺少变量或要求过长输出，可能破坏紧凑记忆。',
        }),
    ],
    [
        'layer0_repair_prompt_preset',
        basicHelp({
            selector: selectorFor('sc_summarizer_repair_prompt_preset'),
            title: '第 0 层修复预设',
            short: '选择第 0 层修复提示词来源。',
            controls: [controlFor('sc_summarizer_repair_prompt_preset')],
            controlsText:
                '为第 0 层校验重试选择默认或自定义修复提示词。',
            when: '无效的第 0 层输出需要更严格重试指令时开启。',
            risk: '修复提示词太弱会导致输出校验持续失败。',
        }),
    ],
    [
        'layer0_repair_prompt',
        basicHelp({
            selector: selectorFor('sc_summarizer_repair_prompt'),
            title: '第 0 层修复提示词',
            short: '第 0 层输出无效后使用的模板。',
            controls: [controlFor('sc_summarizer_repair_prompt')],
            controlsText:
                '设置第 0 层校验修复重试的用户提示词；可使用 {{player_name}}、{{context_str}} 和 {{story_txt}} 变量。',
            when: '默认修复提示词对你的摘要器不够严格时使用。',
            risk: '缺少分段指令会导致修复重试无法成功。',
        }),
    ],
    [
        'injection_template',
        basicHelp({
            selector: selectorFor('sc_injection_template'),
            title: '注入包装模板',
            short: '包裹合并记忆块的文本。',
            controls: [controlFor('sc_injection_template')],
            controlsText:
                '设置包裹分层摘要记忆的文本，必须包含 {{summary}} 变量。',
            when: '模型更适应其他记忆标签或框架时使用。也可以写两次 {{summary}}，让记忆块在提示词末尾附近重复出现，那里通常是模型最关注的位置；字段下方的“重复召回示例”按钮会填入现成示例，“恢复默认”会还原内置包装。',
            risk: '去掉 {{summary}} 变量后不会注入任何记忆文本。重复记忆块会让“记忆块”进度条把每份都计入，因此可能显示超出预算；这只是显示问题，摘要触发时每层只计一次。',
        }),
    ],
    [
        'promotion_system_prompt_preset',
        basicHelp({
            selector: selectorFor('sc_promotion_system_prompt_preset'),
            title: '深层合并系统预设',
            short: '选择第 1+ 层系统提示词来源。',
            controls: [controlFor('sc_promotion_system_prompt_preset')],
            controlsText:
                '在默认第 1+ 层系统提示词和自定义文本之间选择。',
            when: '需要更改深层记忆合并的角色指令时使用。',
            risk: '更改系统指令可能影响深层合并的压缩效果。',
        }),
    ],
    [
        'promotion_system_prompt',
        basicHelp({
            selector: selectorFor('sc_promotion_system_prompt'),
            title: '深层合并系统提示词',
            short: '深层记忆合并的指令风格。',
            controls: [controlFor('sc_promotion_system_prompt')],
            controlsText:
                '设置第 1+ 层记忆合并时使用的系统指令。',
            when: '被提升的记忆需要不同压缩风格时开启。',
            risk: '糟糕的合并指令可能抹掉持久事实。',
        }),
    ],
    [
        'promotion_prompt_preset',
        basicHelp({
            selector: selectorFor('sc_promotion_prompt_preset'),
            title: '第 1+ 层用户预设',
            short: '选择第 1+ 层深层合并用户提示词模板。',
            controls: [controlFor('sc_promotion_prompt_preset')],
            controlsText:
                '在默认第 1+ 层用户提示词和自定义版本之间选择。',
            when: '在默认深层合并记忆和自定义提示词之间切换时使用。',
            risk: '更改预设可能改变深层摘要保留持久事实的方式。',
        }),
    ],
    [
        'promotion_user_prompt',
        basicHelp({
            selector: selectorFor('sc_promotion_user_prompt'),
            title: '深层合并用户提示词',
            short: '把较低层记忆合并为更深层记忆的模板。',
            controls: [controlFor('sc_promotion_user_prompt')],
            controlsText:
                '设置第 1+ 层深层合并的用户提示词；可使用 {{player_name}}、{{context_str}} 和 {{story_txt}} 变量。',
            when: '深层记忆保留过多细节或丢失关键状态时使用。',
            risk: '指令太弱会产生臃肿或有损的元摘要。',
        }),
    ],
    [
        'promotion_repair_prompt_preset',
        basicHelp({
            selector: selectorFor('sc_promotion_repair_prompt_preset'),
            title: '第 1+ 层修复预设',
            short: '选择第 1+ 层修复提示词来源。',
            controls: [controlFor('sc_promotion_repair_prompt_preset')],
            controlsText:
                '为失败的第 1+ 层压缩选择默认或自定义修复提示词。',
            when: '深层合并修复需要不同压缩风格时使用。',
            risk: '修复提示词太弱会让提升后的记忆一直过大。',
        }),
    ],
    [
        'promotion_repair_prompt',
        basicHelp({
            selector: selectorFor('sc_promotion_repair_prompt'),
            title: '第 1+ 层修复提示词',
            short: '深层合并压缩失败后使用的修复模板。',
            controls: [controlFor('sc_promotion_repair_prompt')],
            controlsText:
                '设置第 1+ 层深层合并修复的用户提示词；可使用 {{player_name}}、{{context_str}} 和 {{story_txt}} 变量。',
            when: '修复后的深层合并仍保留过多细节时开启。',
            risk: '糟糕的修复指令可能抹掉持久连续性。',
        }),
    ],
    [
        'strip_patterns',
        basicHelp({
            selector: selectorFor('sc_strip_patterns'),
            title: '清理模式',
            short: '从摘要器回复中移除的文本模式。',
            controls: [controlFor('sc_strip_patterns')],
            controlsText:
                '设置从生成的摘要文本中移除的模式，每行一个。',
            when: '摘要器总是添加不需要的标签或思考标记时使用。',
            risk: '模式范围过宽会误删有用的记忆文本。',
        }),
    ],
    [
        'debug_mode',
        basicHelp({
            selector: selectorFor('sc_debug_mode'),
            title: '调试模式',
            short: '显示额外的分层摘要控制台日志。',
            controls: [controlFor('sc_debug_mode')],
            controlsText: '开启或关闭详细的分层摘要诊断日志。',
            when: '排查行为问题时使用。',
            risk: '日志会变得嘈杂，并可能包含聊天派生状态。',
        }),
    ],
    [
        'trace_mode',
        basicHelp({
            selector: selectorFor('sc_trace_mode'),
            title: '追踪模式',
            short: '开启调试模式时显示详细流程日志。',
            controls: [controlFor('sc_trace_mode')],
            controlsText: '开启最详细的分层摘要流程日志。',
            when: '仅在调试模式已开启且需要逐步行为记录时使用。',
            risk: '追踪日志非常嘈杂。',
        }),
    ],
    [
        'prompt_input_log_mode',
        basicHelp({
            selector: selectorFor('sc_prompt_input_log_mode'),
            title: '记录 LLM 输入',
            short: '把最终摘要输入完整打印到控制台。',
            controls: [controlFor('sc_prompt_input_log_mode')],
            controlsText:
                '决定是否记录发送给摘要器的最终系统与用户提示词完整内容。',
            when: '仅在诊断提示词质量时开启。',
            risk: '浏览器控制台可能包含私人聊天文本。',
        }),
    ],
    [
        'prompt_output_log_mode',
        basicHelp({
            selector: selectorFor('sc_prompt_output_log_mode'),
            title: '记录 LLM 输出',
            short: '把清理后的摘要器回复打印到控制台。',
            controls: [controlFor('sc_prompt_output_log_mode')],
            controlsText: '决定是否记录清理后的摘要器回复和错误。',
            when: '仅在诊断供应商输出或清理行为时使用。',
            risk: '浏览器控制台可能包含私人聊天文本。',
        }),
    ],
    [
        'continuity_state_log_mode',
        basicHelp({
            selector: selectorFor('sc_continuity_state_log_mode'),
            title: '记录连续性状态',
            short: '在 F12 控制台打印连续性状态审计。',
            controls: [controlFor('sc_continuity_state_log_mode')],
            controlsText: '在 F12 控制台打印每次连续性状态审计。',
            when: '检查连续性状态如何演变时开启。',
            risk: '控制台分组会保留聊天派生状态；默认关闭，排查后请及时关闭。',
        }),
    ],
    [
        'continuity_state_log_full_mode',
        basicHelp({
            selector: selectorFor('sc_continuity_state_log_full_mode'),
            title: '记录完整连续性状态',
            short: '打印完整连续性状态 JSON，而不是变化摘要。',
            controls: [controlFor('sc_continuity_state_log_full_mode')],
            controlsText:
                '需要开启“记录连续性状态”。每次审计后用完整连续性状态 JSON 替代变化摘要。',
            when: '变化摘要不足以调试审计时使用。',
            risk: '浏览器控制台可能包含私人聊天文本。',
        }),
    ],
];

/**
 * @type {Record<string, {selector: string, title: string, short: string, detail: string, controls?: string[]}>}
 */
export const SETTINGS_HELP = defineHelpMap(HELP_ENTRIES);
