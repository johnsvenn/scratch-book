<template>
    <div class="page-controls page-controls--right">
        <BaseButton ref="favouriteButton"
                    icon="Heart"
                    :is-favourite="isFavourite"
                    :disabled="activeTagName === Constants.ARCHIVE_TAG"
                    label="Favourite"
                    @click="$emit('add-to-favourites')" />
        <BaseButton ref="newButton"
                    icon="FilePlusCorner"
                    :disabled="!canCreateNewPage"
                    label="New"
                    @click="$emit('create-new-page-file')" />
        <BaseButton v-if="activeTagName !== Constants.ARCHIVE_TAG"
                    ref="archiveButton"
                    icon="ArchiveX"
                    label="Archive"
                    @click="$emit('archive-file')" />
        <BaseButton v-if="activeTagName === Constants.ARCHIVE_TAG"
                    ref="unarchiveButton"
                    icon="ArchiveRestore"
                    label="Unarchive"
                    @click="$emit('unarchive-file')" />
        <BaseButton ref="deleteButton"
                    icon="Trash2"
                    label="Delete"
                    @click="$emit('delete-file')" />
    </div>
</template>

<script setup>
    import BaseButton from '../BaseButton/BaseButton.vue';
    import Constants from '../../lib/constants';

    defineProps({
        isFavourite: Boolean,
        activeTagName: String,
        canCreateNewPage: Boolean,
    });

    defineEmits([
        'add-to-favourites',
        'create-new-page-file',
        'archive-file',
        'unarchive-file',
        'delete-file',
    ]);
</script>

<style scoped lang="scss">
    .page-controls {
        height: 32px;
        margin-bottom: 0;
       display: flex; 
        align-items: center; 
        gap: 2px;

        &.page-controls--right {
            float: right;
        }
    }
</style>
