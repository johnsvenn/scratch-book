<template>
    <div class="page-tag-pills">
        <!-- Pills for tags attached to this page -->
        <span v-for="tag in userTags"
              :key="tag"
              class="page-tag-pills__pill"
              :class="{ 'page-tag-pills__pill--disabled': disabled }"
              :style="pillStyle(tag)">
            <span class="page-tag-pills__dot" :style="{ background: disabled ? '#bbb' : getTagColor(tag) }"></span>
            {{ tag }}
            <button class="page-tag-pills__remove"
                    aria-label="Remove tag"
                    @click.stop="$emit('remove-tag', tag)">
                <X :size="10" />
            </button>
        </span>
        
        <!-- Add tag button and popover -->
        <div v-if="!disabled" ref="popoverWrapper" class="page-tag-pills__add-wrapper">
            <button class="page-tag-pills__add"
                    :class="{ 'page-tag-pills__add--active': popoverOpen }"
                    @click="togglePopover">
                + tag
            </button>
            <AddTagToPageModal v-if="popoverOpen"
                          :page-tags="userTags"
                          :all-tags="allTags"
                          :tag-colors="tagColors"
                          @close="popoverOpen = false"
                          @add-new-tag="onAddNewTag"
                          @toggle-tag="onToggleTag"
                          @open-manage-tags="onOpenManageTags" />
        </div>
    </div>
</template>

<script setup>
    import { ref, computed } from 'vue';
    import { X } from 'lucide-vue-next';
    import { RESERVED_TAGS } from '../../lib/TagMeta';
    import { useTagPillStyle } from '../../composables/useTagPillStyle';
    import AddTagToPageModal from '../TagList/AddTagToPageModal.vue';

    const props = defineProps({
        tags: {
            type: Array, // Array of string tags assigned to the CURRENT page
            default: () => [],
        },
        allTags: {
            type: Array, // All available tags in the system {name, count}
            default: () => [],
        },
        tagColors: {
            type: Object, // Map<string, string> or plain object
            default: () => ({}),
        },
        disabled: {
            type: Boolean,
            default: false,
        },
    });

    const emit = defineEmits([
        'filter-by-tag',
        'remove-tag',
        'add-tag',
        'create-and-add-tag',
        'manage-tags'
    ]);

    const popoverOpen = ref(false);
    const popoverWrapper = ref(null);

    /** Only user tags, strip out internal ones like 'current' or 'archive' */
    const userTags = computed(() => {
        return (props.tags || []).filter((t) => !RESERVED_TAGS.has(t));
    });

    const { getTagColor: _getTagColor, pillStyle: _pillStyle } = useTagPillStyle(computed(() => props.tagColors));

    function getTagColor(tagName) {
        return _getTagColor(tagName);
    }

    /**
     * In the mockup, the pill background is an extremely pale/transparent
     * version of the dot color, and the border is a pale version of the dot color.
     * When disabled, a uniform grey style is used instead.
     */
    function pillStyle(tagName) {
        if (props.disabled) {
            return {
                backgroundColor: '#f5f5f5',
                borderColor: '#e0e0e0',
                color: '#999'
            };
        }
        return _pillStyle(tagName);
    }

    function togglePopover() {
        popoverOpen.value = !popoverOpen.value;
    }

    function onAddNewTag(tagName) {
        emit('create-and-add-tag', tagName);
        popoverOpen.value = false;
    }

    function onOpenManageTags() {
        popoverOpen.value = false;
        emit('manage-tags');
    }

    function onToggleTag(tagName, isSet) {
        if (isSet) {
            emit('add-tag', tagName);
        } else {
            console.log("Removing tag:", tagName);
            emit('remove-tag', tagName);
        }
    }

    function onClickOutside(event) {
        if (popoverWrapper.value && !popoverWrapper.value.contains(event.target)) {
            popoverOpen.value = false;
        }
    }

    import { onMounted, onUnmounted } from 'vue';
    onMounted(() => document.addEventListener('click', onClickOutside, true));
    onUnmounted(() => document.removeEventListener('click', onClickOutside, true));
</script>

<style scoped lang="scss">
    .page-tag-pills {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        min-height: 28px;
    }

    .page-tag-pills__pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 24px;
        padding: 0 10px;
        font-size: 11px;
        border: 1px solid $grey-400;
        border-radius: 12px;
        background: $white;
        color: $grey-725;
        transition: transform 0.1s, filter 0.1s;
        box-sizing: border-box;
        line-height: 20px;

    }

    .page-tag-pills__dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .page-tag-pills__remove {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        padding: 2px;
        margin: 0;
        margin-left: 2px;
        color: inherit;
        opacity: 0.6;
        cursor: pointer;
        border-radius: 50%;

        &:hover {
            opacity: 1;
            background: rgba(0, 0, 0, 0.05);
        }
    }

    .page-tag-pills__add-wrapper {
        position: relative;
    }

    .page-tag-pills__add {
        height: 22px;
        padding: 0 10px;
        font-size: 11px;
        border: 1px solid $grey-400;
        border-radius: 12px;
        background: $white;
        color: $grey-725;
        cursor: pointer;
        transition: background 0.1s;
        line-height: 20px;

        &:hover {
            background: $grey-200;
        }

        &.page-tag-pills__add--active {
            background: $grey-225;
            border-color: $grey-450;
        }
    }
</style>
