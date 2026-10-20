<template>
    <BaseModal title="Manage tags" @close="$emit('close')">
        <div class="manage-tags__list">
            <div v-for="tag in allTags" :key="tag.name" class="manage-tags__row">
                <!-- Left side: dot & name/input -->
                <div class="manage-tags__tag-info">
                    <span class="manage-tags__dot"
                          :style="{ background: editingTag === tag.name ? editColor : getTagColor(tag.name) }"></span>
                          
                    <template v-if="editingTag === tag.name">
                        <input v-model="editName"
                               type="text"
                               class="manage-tags__input"
                               @keyup.enter="saveEdit" />
                    </template>
                    <template v-else>
                        <span class="manage-tags__name">{{ tag.name }}</span>
                        <span class="manage-tags__count">{{ tag.count }} {{ tag.count === 1 ? 'page' : 'pages' }}</span>
                    </template>
                </div>

                <!-- Right side: Actions -->
                <div class="manage-tags__actions">
                    <template v-if="editingTag === tag.name">
                        <!-- Color Picker options -->
                        <div class="manage-tags__palette">
                            <span v-for="c in TAG_COLORS"
                                  :key="c"
                                  class="manage-tags__color-option"
                                  :style="{ background: c }"
                                  :class="{ 'manage-tags__color-option--selected': c === editColor }"
                                  @click="editColor = c"></span>
                        </div>
                        <button class="manage-tags__btn manage-tags__btn--primary" @click="saveEdit">Save</button>
                        <button class="manage-tags__btn" @click="cancelEdit">Cancel</button>
                    </template>
                    <template v-else>
                        <button class="manage-tags__icon-btn" title="Edit Tag" @click="startEdit(tag)">
                            <Edit2 :size="14" />
                        </button>
                        <button class="manage-tags__icon-btn manage-tags__icon-btn--danger" 
                                title="Delete Tag"
                                @click="requestDelete(tag.name)">
                            <Trash2 :size="14" />
                        </button>
                    </template>
                </div>
            </div>
        </div>
        
        <div v-if="allTags.length === 0" class="manage-tags__empty">
            You haven't created any tags yet.
        </div>
    </BaseModal>

    <ConfirmModal v-if="pendingDeleteTag"
                  title="Delete tag"
                  :message="deleteMessage"
                  confirm-text="Delete"
                  @confirm="confirmDelete"
                  @cancel="pendingDeleteTag = null" />
</template>

<script setup>
    import { ref, computed } from 'vue';
    import { Edit2, Trash2 } from 'lucide-vue-next';
    import { TAG_COLORS } from '../../lib/TagMeta';
    import BaseModal from '../BaseModal/BaseModal.vue';
    import ConfirmModal from '../BaseModal/ConfirmModal.vue';

    const props = defineProps({
        allTags: {
            type: Array, // [{name, count}]
            default: () => [],
        },
        tagColors: {
            type: Object, // Map or Object
            default: () => ({}),
        },
    });

    // Emits are meant to be handled by HomePage (or a store) to persist changes universally
    const emit = defineEmits(['close', 'rename-tag', 'recolor-tag', 'delete-tag']);

    const editingTag = ref(null);
    const editName = ref('');
    const editColor = ref('');
    const pendingDeleteTag = ref(null);

    const deleteMessage = computed(() =>
        `Are you sure you want to delete the tag "${pendingDeleteTag.value}"? It will be removed from all pages.`
    );

    function getTagColor(tagName) {
        if (props.tagColors instanceof Map) {
            return props.tagColors.get(tagName) ?? '#aaa'; // Keep default for user-defined tags for now
        }
        return props.tagColors[tagName] ?? '#aaa';
    }

    function startEdit(tag) {
        editingTag.value = tag.name;
        editName.value = tag.name;
        editColor.value = getTagColor(tag.name);
    }

    function cancelEdit() {
        editingTag.value = null;
    }

    function saveEdit() {
        const newName = editName.value.trim().toLowerCase();
        if (!newName) return;
        
        const oldName = editingTag.value;
        const colorChanged = editColor.value !== getTagColor(oldName);
        const nameChanged = newName !== oldName;

        if (nameChanged) {
            emit('rename-tag', oldName, newName);
        }
        
        if (colorChanged || nameChanged) {
            // Recolor using the new name if it changed
            emit('recolor-tag', nameChanged ? newName : oldName, editColor.value);
        }

        editingTag.value = null;
    }

    function requestDelete(tagName) {
        pendingDeleteTag.value = tagName;
    }

    function confirmDelete() {
        const tagName = pendingDeleteTag.value;
        emit('delete-tag', tagName);
        if (editingTag.value === tagName) {
            editingTag.value = null;
        }
        pendingDeleteTag.value = null;
    }
</script>

<style scoped lang="scss">
    .manage-tags__list {
        overflow-y: auto;
        padding: 10px 20px;
        flex: 1;
    }

    .manage-tags__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid $grey-200;

        &:last-child {
            border-bottom: none;
        }
    }

    .manage-tags__tag-info {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
    }

    .manage-tags__dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .manage-tags__name {
        font-weight: 500;
        font-size: 14px;
        color: $grey-800;
    }

    .manage-tags__input {
        flex: 1;
        max-width: 200px;
        height: 28px;
        padding: 0 10px;
        border: 1px solid $grey-400;
        border-radius: 4px;
        font-size: 14px;
        outline: none;

        &:focus {
            border-color: $grey-550;
        }
    }

    .manage-tags__count {
        font-size: 12px;
        color: $grey-600;
        background: $grey-150;
        padding: 2px 8px;
        border-radius: 12px;
    }

    .manage-tags__actions {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .manage-tags__icon-btn {
        background: none;
        border: none;
        padding: 4px;
        color: $grey-700;
        cursor: pointer;
        border-radius: 4px;

        &:hover {
            background: $grey-200;
            color: $grey-850;
        }

        &--danger:hover {
            background: $danger-100;
            color: $danger-500;
        }
    }

    .manage-tags__btn {
        height: 26px;
        padding: 0 12px;
        font-size: 12px;
        border: 1px solid $grey-400;
        border-radius: 4px;
        background: $white;
        cursor: pointer;

        &:hover {
            background: $grey-200;
        }

        &--primary {
            background: $grey-850;
            color: $white;
            border-color: $grey-850;

            &:hover {
                background: $grey-800;
                border-color: $grey-800;
            }
        }
    }

    .manage-tags__palette {
        display: flex;
        gap: 4px;
        margin-left: 12px;
        margin-right: 12px;
    }

    .manage-tags__color-option {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid transparent;

        &:hover {
            transform: scale(1.1);
        }

        &--selected {
            border-color: $grey-800;
        }
    }

    .manage-tags__empty {
        padding: 30px;
        text-align: center;
        color: $grey-600;
    }
</style>
