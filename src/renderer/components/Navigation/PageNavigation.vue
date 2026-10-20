<template>
    <div class="page-navigation">
        <BaseButton icon="ArrowDownUp"
                    label="Reorder Pages"
                    ref="reorderPagesButton"
                    class="page-navigation__reorder"
                    @click="$emit('reorder-pages')" />

        <BaseButton icon="ChevronsLeft"
                    :disabled="isFirstPage"
                    label="First Page"
                    @click="toFirstPage" />
        <BaseButton icon="ChevronLeft"
                    :disabled="isFirstPage"
                    label="Previous Page"
                    @click="toPreviousPage" />
        <div class="page-navigation__input-wrapper">
            <span class="page-navigation__sizer" ref="sizerRef">{{ navCurrentPageNumber }}</span>
            <input v-model="navCurrentPageNumber"
                   class="page-navigation__input"
                   type="number"
                   min="1"
                   :max="numberOfPages + 1"
                   @change="manualUpdate" />
            <span class="page-navigation__suffix">of {{ numberOfPages }}</span>
        </div>
        <BaseButton icon="ChevronRight"
                    :disabled="!canGoNext"
                    label="Next Page"
                    @click="toNextPage" />
        <BaseButton icon="ChevronsRight"
                    :disabled="isLastPage"
                    label="Last Page"
                    @click="toLastPage" />
        <BaseButton icon="Search"
                    label="Search"
                    class="page-navigation__search"
                    @click="$emit('search')" />
    </div>
</template>

<script setup>
    import { ref, watch, computed, nextTick } from 'vue';
    import BaseButton from '../BaseButton/BaseButton.vue';

    const props = defineProps({
        currentPageNumber: {
            type: Number,
            required: true,
        },
        listDataLength: {
            type: Number,
            required: true,
        },
        canGoNext: {
            type: Boolean,
            required: true,
        },
    });
    const emit = defineEmits(['currentPageChange', 'update:currentPageNumber', 'reorder-pages', 'search']);

    const navCurrentPageNumber = ref(props.currentPageNumber);
    const navLastPageNumber = ref(props.currentPageNumber);
    const numberOfPages = ref(props.listDataLength === 0 ? 1 : props.listDataLength);
    const sizerRef = ref(null);

    function updateInputWidth() {
        nextTick(() => {
            if (sizerRef.value) {
                const width = sizerRef.value.offsetWidth;
                sizerRef.value.closest('.page-navigation__input-wrapper')
                    ?.querySelector('.page-navigation__input')
                    ?.style.setProperty('--input-width', `${Math.max(width, 10)}px`);
            }
        });
    }

    const isFirstPage = computed(() => navCurrentPageNumber.value <= 1);
    const isLastPage = computed(() => navCurrentPageNumber.value >= numberOfPages.value);

    watch(
        () => props.currentPageNumber,
        (value) => {
            navCurrentPageNumber.value = value;
            navLastPageNumber.value = value;
        },
        { immediate: true }
    );

    watch(
        () => props.listDataLength,
        (value) => {
            numberOfPages.value = value === 0 ? 1 : value;
        },
        { immediate: true }
    );

    watch(navCurrentPageNumber, () => {
        updateInputWidth();
    }, { immediate: true });

    function toPreviousPage() {
        if (isFirstPage.value) return;
        const next = navCurrentPageNumber.value > 1 ? navCurrentPageNumber.value - 1 : 1;
        updatePage(next);
    }

    function toNextPage() {
        if (!props.canGoNext) return;
        updatePage(navCurrentPageNumber.value + 1);
    }

    function toFirstPage() {
        if (isFirstPage.value) return;
        updatePage(1);
    }

    function toLastPage() {
        if (isLastPage.value) return;
        updatePage(numberOfPages.value);
    }

    function manualUpdate() {
        let num = parseInt(navCurrentPageNumber.value);
        if (isNaN(num) || num === 0) {
            navCurrentPageNumber.value = navLastPageNumber.value;
            return;
        }
        if (num > numberOfPages.value) num = numberOfPages.value;
        if (num < 1) num = 1;

        updatePage(num);
    }

    function updatePage(next) {
        if (next === navLastPageNumber.value) return;
        
        emit('currentPageChange', navLastPageNumber.value, next);
        emit('update:currentPageNumber', next);
        
        navCurrentPageNumber.value = next;
        navLastPageNumber.value = next;
    }
</script>

<style scoped lang="scss">
    @use 'sass:color';

    .page-navigation__input-wrapper {
        display: inline-flex;
        align-items: center;
        border-radius: 4px;
        border: 1px solid $grey-400;
        padding: 4px 6px;
        gap: 4px;
        line-height: 25px;
        position: relative;
        background-color: $white;
    }

    .page-navigation__sizer {
        position: absolute;
        visibility: hidden;
        white-space: pre;
        font: inherit;
        pointer-events: none;
    }

    .page-navigation__input {
        text-align: right;
        border: none;
        outline: none;
        padding: 0;
        line-height: inherit;
        font: inherit;
        min-width: 1ch;
        width: var(--input-width, 2ch);
        -moz-appearance: textfield;
        appearance: textfield;

        &::-webkit-inner-spin-button,
        &::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
    }

    .page-navigation__suffix {
        white-space: nowrap;
        user-select: none;
        pointer-events: none;
    }

    .page-navigation {
        height: 32px;
        margin-bottom: 0;
        padding: 0;
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .page-navigation__reorder {
        margin-right: 10px;
    }

    .page-navigation__search {
        margin-left: 10px;
        color: $blue-500;
    }
</style>
