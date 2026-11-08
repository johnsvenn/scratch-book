<template>
    <nav class="tab-bar">
        <!-- Favourites icon — far left quick-access -->
        <button class="tab-bar__icon-btn tab-bar__icon-btn--left tab-bar__icon-btn--favourite"
                :class="{ 'tab-bar__icon-btn--active': activeTagName === Constants.FAVOURITE_TAG }"
                :disabled="!hasFavourites"
                aria-label="Show Favourites"
                @click="$emit('show-favourites')">
            <FolderHeart class="tab-bar__btn-icon" :size="14" />
        </button>

        <!-- Fixed status tabs: Current, Archive -->
        <button v-for="tab in fixedTabs"
                :key="tab.name"
                class="tab-bar__tab"
                :class="{ 'tab-bar__tab--active': activeTagName === tab.name }"
                @click="$emit('set-index', tab.name)">
            {{ tab.label }}
        </button>

        <!-- Dynamic user tag tabs (most popular first) -->
        <button v-for="tag in visibleUserTags"
                :key="tag.name"
                class="tab-bar__tab"
                :class="{ 'tab-bar__tab--active': activeTagName === tag.name }"
                @click="$emit('set-index', tag.name)">
            <span class="tab-bar__dot" :style="{ background: getTagColor(tag.name) }"></span>
            {{ tag.name }}
        </button>

        <!-- Overflow dropdown -->
        <div v-if="overflowUserTags.length || showMoreAlways"
             ref="dropdownWrapper"
             class="tab-bar__more">
            <button class="tab-bar__tab tab-bar__tab--more"
                    :class="{ 'tab-bar__tab--active': overflowIsActive }"
                    @click="toggleDropdown">
                more <ChevronDown class="tab-bar__chevron" :size="11" />
            </button>
            <ul v-if="dropdownOpen" class="tab-bar__dropdown">
                <li v-for="tag in overflowUserTags"
                    :key="tag.name"
                    class="tab-bar__dropdown-item"
                    :class="{ 'tab-bar__dropdown-item--active': activeTagName === tag.name }"
                    @click="selectOverflowTag(tag.name)">
                    <span class="tab-bar__dot" :style="{ background: getTagColor(tag.name) }"></span>
                    {{ tag.name }}
                </li>
                <li class="tab-bar__dropdown-item tab-bar__dropdown-item--new"
                    @click="onNewTag">
                    + new tag
                </li>
            </ul>
        </div>

        <!-- Spacer pushes manage/settings to far right -->
        <div class="tab-bar__spacer"></div>

        <!-- Archive tab -->
        <button class="tab-bar__tab tab-bar__tab--archive"
                :class="{ 'tab-bar__tab--active': activeTagName === Constants.ARCHIVE_TAG }"
                @click="$emit('set-index', Constants.ARCHIVE_TAG)">
            Archive
        </button>

        <!-- Manage tags icon -->
        <button class="tab-bar__icon-btn"
                aria-label="Manage Tags"
                @click="$emit('manage-tags')">
            <Tag class="tab-bar__btn-icon" :size="14" />
        </button>

        <!-- Settings icon -->
        <button class="tab-bar__icon-btn"
                aria-label="Settings"
                @click="$emit('show-settings')">
            <Settings class="tab-bar__btn-icon" :size="14" />
        </button>
    </nav>
</template>

<script setup>
    import { ref, computed } from 'vue';
    import { FolderHeart, Tag, Settings, ChevronDown } from 'lucide-vue-next';
    import Constants from '../../lib/constants';
    import { getAutoColor } from '../../lib/TagMeta';

    const props = defineProps({
        activeTagName: {
            type: String,
            required: true,
        },
        userTags: {
            type: Array, // [{ name: string, count: number, color?: string }]
            default: () => [],
        },
        tagColors: {
            type: Object, // Map<string, string> or plain object
            default: () => ({}),
        },
        hasFavourites: {
            type: Boolean,
            default: false,
        },
        /** How many user-tag tabs to show before overflowing into "more ▾" */
        maxVisibleTags: {
            type: Number,
            default: 7,
        },
    });

    const emit = defineEmits([
        'show-favourites',
        'set-index',
        'create-new-tag',
        'manage-tags',
        'show-settings',
    ]);

    const fixedTabs = [
        { name: Constants.CURRENT_TAG, label: 'All Pages' },
    ];

    const dropdownOpen = ref(false);
    const dropdownWrapper = ref(null);

    const visibleUserTags = computed(() =>
        props.userTags.slice(0, props.maxVisibleTags)
    );

    const overflowUserTags = computed(() =>
        props.userTags.slice(props.maxVisibleTags)
    );

    /** True when the active tab is in the overflow list — keeps "more" highlighted */
    const overflowIsActive = computed(() =>
        overflowUserTags.value.some((t) => t.name === props.activeTagName)
    );

    /** Always show "more" button when there are overflow tags */
    const showMoreAlways = computed(() => overflowUserTags.value.length > 0);

    function getTagColor(tagName) {
        // tagColors can be a Map or a plain object
        if (props.tagColors instanceof Map) {
            return props.tagColors.get(tagName) ?? getAutoColor(tagName);
        }
        return props.tagColors[tagName] ?? getAutoColor(tagName);
    }

    function toggleDropdown() {
        dropdownOpen.value = !dropdownOpen.value;
    }

    function selectOverflowTag(tagName) {
        emit('set-index', tagName);
        dropdownOpen.value = false;
    }

    function onNewTag() {
        dropdownOpen.value = false;
        emit('create-new-tag');
    }

    // Close dropdown on click outside
    function onClickOutside(event) {
        if (dropdownWrapper.value && !dropdownWrapper.value.contains(event.target)) {
            dropdownOpen.value = false;
        }
    }

    import { onMounted, onUnmounted } from 'vue';
    onMounted(() => document.addEventListener('click', onClickOutside, true));
    onUnmounted(() => document.removeEventListener('click', onClickOutside, true));
</script>

<style scoped lang="scss">
    .tab-bar {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        padding: 6px 8px 0 8px;
        background: $grey-225;
        border-bottom: none;
        position: relative;
        min-height: 34px;
        border-bottom: 1px solid $grey-650;
    }

    // ── Shared tab button base ────────────────────────────────────────────────
    .tab-bar__tab {
        margin-bottom: -1px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 26px;
        padding: 0 10px;
        font-size: 11px;
        font-family: inherit;
        border: 1px solid $grey-450;
        border-bottom: 1px solid $grey-650;
        border-radius: 4px 4px 0 0;
        background: $grey-350;
        color: $grey-725;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.1s, color 0.1s;
        line-height: 26px;

        &:hover {
            background: $grey-375;
        }

        &.tab-bar__tab--active {
            background: $grey-150;
            color: $grey-850;
            border-color: $grey-650;
            // Bottom edge merges with Row 2 (same background as nav section)
            border-bottom: 1px solid $grey-150;
            position: relative;
            z-index: 1;
        }
    }

    // ── More dropdown tab ────────────────────────────────────────────────────
    .tab-bar__tab--more {
        gap: 3px;
    }

    .tab-bar__chevron {
        margin-bottom: -1px;
    }

    // ── Icon buttons (heart, tag, settings) ──────────────────────────────────
    .tab-bar__icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        font-family: inherit;
        border: 1px solid $grey-450;
        border-bottom: 1px solid $grey-650;
        border-radius: 4px 4px 0 0;
        background: $grey-350;
        color: $grey-725;
        cursor: pointer;
        transition: background 0.1s, color 0.1s;
        flex-shrink: 0;
        margin-bottom: -1px;

        &:hover:not([disabled]) {
            background: $grey-375;
        }

        &:disabled {
            color: $grey-450;
            cursor: default;
        }

        &.tab-bar__icon-btn--active {
            color: $danger-500;
        }


        &.tab-bar__icon-btn--favourite {
            color: $danger-500;
        }
    }

    .tab-bar__btn-icon {
        display: block;
    }

    // ── Colour dot ───────────────────────────────────────────────────────────
    .tab-bar__dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    // ── Spacer ───────────────────────────────────────────────────────────────
    .tab-bar__spacer {
        flex: 1;
    }

    // ── Dropdown ─────────────────────────────────────────────────────────────
    .tab-bar__more {
        position: relative;
    }

    .tab-bar__dropdown {
        position: absolute;
        top: calc(100% + 1px);
        left: 0;
        z-index: 100;
        list-style: none;
        margin: 0;
        padding: 4px 0;
        background: $white;
        border: 1px solid $grey-400;
        border-radius: 0 4px 4px 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        min-width: 140px;
    }

    .tab-bar__dropdown-item {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 6px 12px;
        font-size: 11px;
        cursor: pointer;
        color: $grey-800;

        &:hover {
            background: $grey-200;
        }

        &.tab-bar__dropdown-item--active {
            font-weight: 600;
            background: $blue-100;
        }

        &.tab-bar__dropdown-item--new {
            border-top: 1px solid $grey-250;
            margin-top: 4px;
            color: $grey-700;
            font-style: italic;
        }
    }
</style>
