<template>
    <div class="app">
        <router-view></router-view>
        <transition name="toast">
            <div v-if="toastMessage" class="app__toast" role="alert">{{ toastMessage }}</div>
        </transition>
    </div>
</template>

<script setup>
import { ref, provide, onMounted, onBeforeUnmount } from 'vue';
import { useLinkHandler } from './composables/useLinkHandler';

// HomePage populates this with its navigation function on mount so that
// page:// links can open a page without a route change.
const navigateToPage = ref(null);
provide('navigateToPage', navigateToPage);

const toastMessage = ref('');
let toastTimer = null;

function showToast(message) {
    toastMessage.value = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastMessage.value = '';
    }, 3000);
}

async function openExternal(url) {
    const ok = await window.electronAPI.openExternal(url);
    if (!ok) showToast('Could not open link — only http/https URLs are supported.');
}

const { handleLinkClick } = useLinkHandler({
    openExternal,
    showToast,
    onPageLink: (filename) => navigateToPage.value?.(filename),
});

onMounted(() => document.addEventListener('click', handleLinkClick));
onBeforeUnmount(() => {
    document.removeEventListener('click', handleLinkClick);
    clearTimeout(toastTimer);
});
</script>

<style lang="scss">
    /* CSS */
    .app {
        height: 100vh;
    }


    body {
        font-family: Roboto;
        // background-color: #fafafa;
        background: rgb(250, 250, 250);
        //background: linear-gradient(180deg, rgba(250,250,250,1) 0%, rgba(204,204,204,1) 80%);
        background: $grey-250;
        margin: 0;
        padding: 0;
        overflow: hidden;
        height: 100vh;
    }
    textarea:focus,
    input:focus {
        outline: none;
        border-color: $blue-500 !important;
    }

    /* Toast notification */
    .app__toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(30, 30, 30, 0.92);
        color: #fff;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 0.875rem;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        z-index: 9999;
        pointer-events: none;
        white-space: nowrap;
    }

    .toast-enter-active,
    .toast-leave-active {
        transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .toast-enter-from,
    .toast-leave-to {
        opacity: 0;
        transform: translateX(-50%) translateY(8px);
    }
</style>
