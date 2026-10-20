<template>
    <div ref="modalRef"
         class="base-modal"
         tabindex="-1"
         @keydown.esc="$emit('close')"
         @click.self="$emit('close')">
        <div class="base-modal__wrapper">
            <div class="base-modal__header">
                <h2 class="base-modal__title">{{ title }}</h2>
                <button v-if="showCloseButton" class="base-modal__close" @click="$emit('close')">
                    <X size="20" />
                </button>
            </div>
            <div class="base-modal__body">
                <slot />
            </div>
        </div>
    </div>
</template>

<script setup>
    import { ref, onMounted } from 'vue';
    import { X } from 'lucide-vue-next';

    defineProps({
        title: {
            type: String,
            required: true,
        },
        showCloseButton: {
            type: Boolean,
            default: true,
        },
    });

    defineEmits(['close']);

    const modalRef = ref(null);

    onMounted(() => {
        modalRef.value?.focus();
    });
</script>

<style scoped lang="scss">
    .base-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.4);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        outline: none;
    }

    .base-modal__wrapper {
        width: 600px;
        max-width: 90vw;
        max-height: 80vh;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
    }

    .base-modal__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #ccc;
        border-radius: 8px 8px 0 0;
        background: #f5f5f5;
    }

    .base-modal__title {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
    }

    .base-modal__close {
        border: none;
        background: none;
        padding: 0;
        font-size: 12px;
        cursor: pointer;

        &:hover {
            opacity: 0.6;
        }
    }

    .base-modal__body {
        overflow-y: auto;
        flex: 1;
    }
</style>
