<template>
    <BaseModal :title="getTitle" @close="close()">
        <draggable v-model="localItems"
                   class="tag-list__list"
                   tag="ul"
                   handle=".tag-list__drag-handle"
                   item-key="filename"
                   @start="dragging = true"
                   @end="dragging = false">
            <template #item="{ element }">
                <li class="tag-list__list-item" @click="navigateTo(element.filename)">
                    <GripVertical class="tag-list__drag-handle" :size="18" />
                    <div class="tag-list__item-title">{{ element.title }}</div>
                    <div class="tag-list__date">
                        {{ formatDate(element.createdAt) }}
                    </div>
                </li>
            </template>
        </draggable>
    </BaseModal>
</template>

<script setup>
    import { ref, computed } from 'vue';
    import draggable from 'vuedraggable';
    import { GripVertical } from 'lucide-vue-next';
    import { formatDate } from '../../lib/DatetimeFunctions';
    import BaseModal from '../BaseModal/BaseModal.vue';

    const props = defineProps({
        items: {
            type: Array,
            required: true
        },
        title: {
            type: String,
            default: 'Pages'
        }
    });
    const emit = defineEmits(['navigateTo', 'close-tag-list', 'update:items']);

    const localItems = computed({
        get() {
            return props.items.filter((item) => {
                return (item.title && item.title.trim()) || (item.content && item.content.trim());
            });
        },
        set(val) {
            emit('update:items', val);
        },
    });

    const getTitle = computed(() => {
        if (props.title === 'favourite') {
            return 'Favourites';
        }
        if (props.title === 'archive') {
            return 'Archive';
        }
        if (props.title === 'current') {
            return 'All Pages';
        }
        return props.title;
    });

    const dragging = ref(false);

    function navigateTo(filename) {
        emit('navigateTo', filename);
    }

    function close() {
        emit('close-tag-list');
    }
</script>

<style scoped lang="scss">
    @use 'sass:color';

    .tag-list__list {
        white-space: nowrap;
        list-style: none;
        padding: 20px;
    }

    .tag-list__list-item {
        background: $grey-250;
        margin: 0;
        padding: 0 10px 0 5px;
        border-bottom: 1px solid $grey-300;
        line-height: 40px;
        min-height: 40px;
        vertical-align: middle;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        column-gap: 10px;
        cursor: pointer;

        &:hover {
            background: color.adjust($grey-250, $lightness: -10%);
        }
        &:last-child {
            border-bottom: none;
        }
    }

    .tag-list__drag-handle {
        margin-top: 8px;
        color: $grey-700;
        cursor: move;
        &:hover {
            color: $black;
        }
    }

    .tag-list__item-title {
        text-align: left;
        flex-grow: 1;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .tag-list__date {
        font-size: 10px;
        color: $grey-700;
    }
</style>
