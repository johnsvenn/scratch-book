<template>
    <BaseModal title="Tags for this page" @close="$emit('close')">
        <div class="add-tag-modal">
            <div class="add-tag-modal__pills">
                <span v-for="tag in allTags"
                      :key="tag.name"
                      class="add-tag-modal__pill"
                      :class="{ 'add-tag-modal__pill--active': isSet(tag.name) }"
                      @click="toggle(tag.name)">
                    <span class="add-tag-modal__dot" :style="{ background: getTagColor(tag.name) }"></span>
                    {{ tag.name }}
                </span>
            </div>

            <form class="add-tag-modal__form" @submit.prevent="submitNewTag">
                <input ref="inputRef"
                       v-model="newTagName"
                       type="text"
                       class="add-tag-modal__input"
                       placeholder="new tag name..." />
                <button type="submit"
                        class="add-tag-modal__submit"
                        :disabled="!isValidNewTag">
                    add
                </button>
                <button type="button"
                        class="add-tag-modal__manage"
                        aria-label="Manage Tags"
                        title="Manage Tags"
                        @click="$emit('open-manage-tags')">
                    <Tag :size="14" />
                </button>
            </form>
        </div>
    </BaseModal>
</template>

<script setup>
    import { ref, computed, onMounted, nextTick } from 'vue';
    import { Tag } from 'lucide-vue-next';
    import { getAutoColor } from '../../lib/TagMeta';
    import BaseModal from '../BaseModal/BaseModal.vue';

    const props = defineProps({
        pageTags: {
            type: Array,
            default: () => [],
        },
        allTags: {
            type: Array, // [{name, count}]
            default: () => [],
        },
        tagColors: {
            type: Object, // Map or Object
            default: () => ({}),
        },
    });

    const emit = defineEmits(['close', 'toggle-tag', 'add-new-tag', 'open-manage-tags']);

    const newTagName = ref('');
    const inputRef = ref(null);

    // Focus input on open for quick typing
    onMounted(() => {
        nextTick(() => {
            if (inputRef.value) {
                inputRef.value.focus();
            }
        });
    });

    function getTagColor(tagName) {
        if (props.tagColors instanceof Map) {
            return props.tagColors.get(tagName) ?? getAutoColor(tagName);
        }
        return props.tagColors[tagName] ?? getAutoColor(tagName);
    }

    function isSet(tagName) {
        return props.pageTags.includes(tagName);
    }

    function toggle(tagName) {
        emit('toggle-tag', tagName, !isSet(tagName));
    }

    const isValidNewTag = computed(() => {
        const t = newTagName.value.trim().toLowerCase();
        return t.length > 0 && !props.allTags.some(existing => existing.name === t);
    });

    function submitNewTag() {
        if (!isValidNewTag.value) {
            return;
        }
        const t = newTagName.value.trim().toLowerCase();
        emit('add-new-tag', t);
        newTagName.value = '';
    }
</script>

<style scoped lang="scss">
    .add-tag-modal {
        padding: 16px 20px;
    }

    .add-tag-modal__pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 16px;
        max-height: 200px;
        overflow-y: auto;
    }

    .add-tag-modal__pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 24px;
        padding: 0 10px;
        font-size: 12px;
        border: 1px solid $grey-400;
        border-radius: 12px;
        background: $white;
        color: $grey-750;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.1s, background 0.1s;

        &:hover {
            opacity: 0.9;
            background: $grey-175;
        }

        &.add-tag-modal__pill--active {
            opacity: 1;
            background: $grey-250;
            border-color: $grey-550;
            color: $grey-850;
        }
    }

    .add-tag-modal__dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
    }

    .add-tag-modal__form {
        display: flex;
        gap: 8px;
        border-top: 1px solid $grey-250;
        padding-top: 16px;
    }

    .add-tag-modal__input {
        flex: 1;
        height: 28px;
        padding: 0 10px;
        font-size: 13px;
        border: 1px solid $grey-400;
        border-radius: 4px;
        outline: none;

        &:focus {
            border-color: $grey-550;
        }
    }

    .add-tag-modal__submit {
        height: 28px;
        padding: 0 12px;
        background: $white;
        border: 1px solid $grey-400;
        border-radius: 8px;
        font-size: 12px;
        cursor: pointer;

        &:hover:not([disabled]) {
            background: $grey-200;
        }

        &:disabled {
            opacity: 0.5;
            cursor: default;
        }
    }

    .add-tag-modal__manage {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        padding: 0;
        background: $white;
        border: 1px solid $grey-400;
        border-radius: 8px;
        color: $grey-700;
        cursor: pointer;

        &:hover {
            background: $grey-200;
            color: $grey-850;
        }
    }
</style>
