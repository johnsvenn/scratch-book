<template>
    <button class="base-button"
            :class="{ 'base-button--favourite': isFavourite, 'base-button--danger': isDanger }"
            :aria-label="label"
            @click="$emit('click')">
        <component :is="iconComponent" v-if="iconComponent" class="base-button__icon" :size="18" />
        <span v-if="$slots.default" class="base-button__label">
            <slot />
        </span>
    </button>
</template>

<script setup>
    import { computed } from 'vue';
    import * as LucideIcons from 'lucide-vue-next';

    const props = defineProps({
        icon: {
            type: String,
            required: false,
            default: null,
        },
        isFavourite: {
            type: Boolean,
            default: false,
        },
        isDanger: {
            type: Boolean,
            default: false,
        },
        label: {
            type: String,
            required: false,
            default: null,
        },
    });

    defineEmits(['click']);

    const iconComponent = computed(() => {
        if (!props.icon) return null;
        return LucideIcons[props.icon] || null;
    });
</script>

<style scoped lang="scss">
    @use 'sass:color';
    .base-button {
        border: 1px solid $grey-400;
        background: $grey-250;
        line-height: 1;
        height: 34px;
        padding: 0 10px;
        min-width: 50px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        border-radius: 4px;
        color: $grey-800;
        text-decoration: none;
        text-align: center;

        .base-button__icon {
            display: flex;
        }

        &.base-button--favourite {
            color: $danger-500;
            background-color: $danger-100;
            border-color: $grey-500;
        }

        &.base-button--danger {
            color: $danger-500;
            background-color: $danger-100;
            border-color: $danger-500;
        }

        &:disabled {
            color: $grey-400;
        }

        &:hover:not([disabled]) {
            background: color.adjust($grey-250, $lightness: -10%);
        }

        &:focus {
            outline: none;
        }
    }
</style>
