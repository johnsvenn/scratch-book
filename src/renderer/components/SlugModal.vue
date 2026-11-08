<template>
    <BaseModal :title="modalTitle" @close="$emit('close')">
        <div class="slug-modal">
            <p class="slug-modal__description">
                A slug lets you create <code>page://{{ slugValue || 'my-slug' }}</code> links
                that navigate to this page from anywhere in your notes.
            </p>

            <div class="slug-modal__field">
                <label class="slug-modal__label" for="slug-input">Slug</label>
                <div class="slug-modal__input-row">
                    <span class="slug-modal__prefix">page://</span>
                    <input id="slug-input"
                           ref="slugInput"
                           v-model="slugValue"
                           type="text"
                           class="slug-modal__input"
                           :class="{ 'slug-modal__input--error': errorMessage }"
                           placeholder="my-slug"
                           spellcheck="false"
                           @input="onInput" />
                </div>
                <p v-if="errorMessage" class="slug-modal__error">{{ errorMessage }}</p>
            </div>

            <div class="slug-modal__actions">
                <BaseButton :disabled="!!errorMessage || !slugValue.trim() || isValidating"
                            @click="onSave">
                    Save
                </BaseButton>
                <BaseButton v-if="showCopyBtn"
                            variant="secondary"
                            @click="onCopy">
                    {{ copied ? 'Copied!' : 'Copy link' }}
                </BaseButton>
            </div>
        </div>
    </BaseModal>
</template>

<script setup>
    import { ref, computed, onMounted } from 'vue';
    import BaseModal from './BaseModal/BaseModal.vue';
    import BaseButton from './BaseButton/BaseButton.vue';
    import { generateUniqueSlug } from '../lib/SlugService.js';
    import db from '../lib/db.js';

    const props = defineProps({
        /** The page object whose slug is being set/edited. */
        page: {
            type: Object,
            required: true,
        },
    });

    const emit = defineEmits(['save', 'close']);

    const slugInput = ref(null);
    const slugValue = ref('');
    const errorMessage = ref('');
    const isValidating = ref(false);
    const copied = ref(false);

    let validationTimer = null;

    const modalTitle = computed(() =>
        props.page?.slug ? 'Edit Slug' : 'Create Slug'
    );

    const showCopyBtn = computed(() =>
        !!props.page?.slug
    );

    onMounted(async () => {
        if (props.page?.slug) {
            // Page already has a slug — pre-fill with it
            slugValue.value = props.page.slug;
        } else if (props.page?.title) {
            // Derive a unique slug from the title
            slugValue.value = await generateUniqueSlug(props.page.title, props.page.filename);
        }
        slugInput.value?.focus();
        slugInput.value?.select();
    });

    function onInput() {
        errorMessage.value = '';
        clearTimeout(validationTimer);

        const val = slugValue.value.trim();

        // Basic format validation
        if (val && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val)) {
            errorMessage.value = 'Use only lowercase letters, numbers and hyphens (no spaces).';
            return;
        }

        if (!val) {
            return;
        }

        // Debounced uniqueness check
        isValidating.value = true;
        validationTimer = setTimeout(async () => {
            try {
                const taken = await db.isSlugTaken(val, props.page?.filename);
                if (taken) {
                    errorMessage.value = 'This slug is already in use by another page.';
                }
            } finally {
                isValidating.value = false;
            }
        }, 300);
    }

    async function onSave() {
        const val = slugValue.value.trim();
        if (!val || errorMessage.value) {
            return;
        }

        // Final uniqueness check before saving
        const taken = await db.isSlugTaken(val, props.page?.filename);
        if (taken) {
            errorMessage.value = 'This slug is already in use by another page.';
            return;
        }

        emit('save', val);
    }

    async function onCopy() {
        const val = slugValue.value.trim();
        if (!val) {
            return;
        }
        try {
            await navigator.clipboard.writeText(`page://${val}`);
            copied.value = true;
            setTimeout(() => {
                copied.value = false;
            }, 2000);
        } catch {
            // clipboard unavailable
        }
    }
</script>

<style scoped lang="scss">
    .slug-modal {
        padding: 16px 20px 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .slug-modal__description {
        margin: 0;
        font-size: 13px;
        color: $grey-600;
        line-height: 1.5;

        code {
            background: $grey-150;
            border: 1px solid $grey-300;
            border-radius: 3px;
            padding: 1px 5px;
            font-family: 'Roboto Mono', monospace;
            font-size: 12px;
            color: $grey-800;
        }
    }

    .slug-modal__field {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .slug-modal__label {
        font-size: 12px;
        font-weight: 600;
        color: $grey-700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .slug-modal__input-row {
        display: flex;
        align-items: center;
        border: 1px solid $grey-400;
        border-radius: 4px;
        overflow: hidden;
        transition: border-color 0.15s;

        &:focus-within {
            border-color: $blue-500;
        }
    }

    .slug-modal__prefix {
        padding: 0 8px;
        height: 34px;
        line-height: 34px;
        background: $grey-100;
        border-right: 1px solid $grey-400;
        font-family: 'Roboto Mono', monospace;
        font-size: 13px;
        color: $grey-550;
        flex-shrink: 0;
        white-space: nowrap;
    }

    .slug-modal__input {
        flex: 1;
        height: 34px;
        padding: 0 10px;
        border: none;
        outline: none;
        font-family: 'Roboto Mono', monospace;
        font-size: 13px;
        color: $grey-800;
        background: transparent;

        &--error {
            color: $danger-500;
        }
    }

    .slug-modal__error {
        margin: 0;
        font-size: 12px;
        color: $danger-500;
    }

    .slug-modal__actions {
        display: flex;
        gap: 8px;
    }
</style>
