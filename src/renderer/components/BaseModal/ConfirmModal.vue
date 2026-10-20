<template>
    <BaseModal :title="title" :show-close-button="false" @close="$emit('cancel')">
        <div class="confirm-modal__content">
            <p>{{ message }}</p>
        </div>
        <div class="confirm-modal__actions">
            <BaseButton @click="$emit('cancel')">{{ cancelText }}</BaseButton>
            <BaseButton is-danger @click="$emit('confirm')">{{ confirmText }}</BaseButton>
        </div>
    </BaseModal>
</template>

<script setup>
    import BaseModal from './BaseModal.vue';
    import BaseButton from '../BaseButton/BaseButton.vue';

    defineProps({
        title: {
            type: String,
            required: true
        },
        message: {
            type: String,
            required: true
        },
        confirmText: {
            type: String,
            default: 'Confirm'
        },
        cancelText: {
            type: String,
            default: 'Cancel'
        }
    });

    defineEmits(['confirm', 'cancel']);
</script>

<style scoped lang="scss">
    :deep(.base-modal__wrapper) {
        width: 500px;
    }

    .confirm-modal__content {
        padding: 20px;
        font-size: 14px;
        color: #333;
        
        p {
            margin: 0;
            line-height: 1.5;
        }
    }

    .confirm-modal__actions {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 16px 20px;
        border-top: 1px solid #ccc;
        border-radius: 0 0 8px 8px;
    }
</style>
