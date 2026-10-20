<template>
    <div ref="wrapper" class="page-layout">
        <!-- ROW 1: Tab bar -->
        <PageTags :active-tag-name="activeIndex.tagName"
                  :user-tags="allUserTags"
                  :tag-colors="tagColors"
                  :has-favourites="hasFavourites"
                  @set-index="onSetIndex"
                  @show-favourites="showFavourites"
                  @manage-tags="showManageTags"
                  @show-settings="showSettings"
                  @create-new-tag="onCreateNewTagFromTab" />

        <!-- ROW 2: Contextual Controls -->
        <section class="page-layout__nav-section">
            <nav class="page-layout__nav">
                <PageNavigation v-model:current-page-number="currentPageNumber"
                                :list-data-length="listData.length"
                                :can-go-next="canGoNext"
                                @current-page-change="selectListItemByOrder"
                                @reorder-pages="showReorderList"
                                @search="displaySearch = true" />

                <PageControls :is-favourite="currentPage.tags?.includes('favourite') || false"
                              :active-tag-name="activeIndex.tagName"
                              :can-create-new-page="isCreationAllowed"
                              @add-to-favourites="addToFavourites"
                              @create-new-page-file="createNewPageFile"
                              @archive-file="archiveFile"
                              @unarchive-file="unarchiveFile"
                              @delete-file="deleteFile" />
            </nav>
        </section>

        <!-- ROW 3: Modified at -->
        <section class="page-layout__meta">
            <div class="page-layout__modified-at page-layout__date-text">
                Modified: {{ formatDate(currentPage.modifiedAt) }}
                <span class="page-layout__saving">
                    {{ currentPage.isSaving ? 'Saving...' : '' }}
                </span>
            </div>
        </section>

        <!-- ROW 4 & 5: Editor (Title + Content) -->
        <section class="page-layout__pad">
            <div class="page-layout__header">
                <input ref="title"
                       v-model="currentPage.title"
                       type="text"
                       class="page-layout__title-input"
                       placeholder="Title..." />

                <button class="page-layout__slug-btn"
                        title="Create or edit page slug for linking"
                        @click="openSlugModal(currentPage)">
                    <CircleCheck v-if="currentPage.slug" 
                                 :size="16" />    
                    <Link2 v-else 
                           :size="16" />
                </button>

                <div class="page-layout__markdown-toggle">
                    <Eye :size="16" :class="{ 'active': currentPage.isMarkdown }" />
                    <label class="switch">
                        <input v-model="currentPage.isMarkdown"
                               type="checkbox" 
                               @change="enqueueSave()" />
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>

            <textarea v-if="!currentPage.isMarkdown"
                      v-model="currentPage.content"
                      ref="content"
                      class="page-layout__content-textarea"
                      placeholder="Notes..."
                      @mousedown="saveCursorPos"
                      @contextmenu="saveCursorPos"
                      @dblclick="toggleEditMode"></textarea>

            <MarkdownRenderer v-else :content="currentPage.content"
                              @dblclick="toggleEditMode" />
        </section>

        <!-- ROW 6: Page Tag Pills -->
        <section class="page-layout__tags">
            <PageTagPills :tags="currentPage.tags"
                          :all-tags="pickerTags"
                          :tag-colors="tagColors"
                          :disabled="activeIndex.tagName === archiveIndex.tagName"
                          @filter-by-tag="onSetIndex"
                          @remove-tag="onRemoveTagFromPage"
                          @add-tag="onAddTagToPage"
                          @create-and-add-tag="onCreateAndAddTagToPage"
                          @manage-tags="showManageTags" />
        </section>

        <!-- ROW 7: Footer -->
        <section class="page-layout__foot">
            <div class="page-layout__created-at page-layout__date-text">
                Created: {{ formatDate(currentPage.createdAt) }}
            </div>
            <div class="page-layout__build-info page-layout__date-text">
                Version: {{ appVersion }} {{ commitHash }}
            </div>
        </section>
    </div>

    <!-- Modal dialogs -->
    <TagListModal v-if="activeTagItems.length"
             id="tag-list"
             :items="activeTagItems"
             :title="activeTagNameModal"
             @navigate-to="onSearchNavigate"
             @close-tag-list="closeTagList"
             @update:items="updateTagOrder" />

    <ManageTagsModal v-if="displayManageTags"
                :all-tags="pickerTags"
                :tag-colors="tagColors"
                @close="displayManageTags = false"
                @rename-tag="onRenameTag"
                @recolor-tag="onRecolorTag"
                @delete-tag="onDeleteTagGlobally" />

    <SettingsModal v-if="displaySettings" @close-settings="closeSettings" />

    <SearchModal v-if="displaySearch"
                 @close="displaySearch = false"
                 @navigate-to="onSearchNavigate" />

    <ConfirmModal v-if="displayDeleteConfirm"
                  title="Delete Page"
                  message="Are you sure you want to delete this page? This action cannot be undone."
                  confirm-text="Delete"
                  cancel-text="Cancel"
                  @confirm="executeDelete"
                  @cancel="displayDeleteConfirm = false" />

    <SlugModal v-if="displaySlugModal"
               :page="slugTargetPage"
               @save="onSlugSave"
               @close="displaySlugModal = false" />

    <SearchModal v-if="displayLinkPicker"
                 mode="link"
                 @close="displayLinkPicker = false"
                 @pick-page="onPickPage" />
</template>

<script setup>
    import { ref, computed, watch, onMounted, onBeforeUnmount, inject, nextTick } from 'vue';

    import PageTags from './Navigation/PageTags.vue';
    import TagListModal from './TagList/TagListModal.vue';
    import PageNavigation from './Navigation/PageNavigation.vue';
    import PageControls from './Navigation/PageControls.vue';
    import PageTagPills from './Navigation/PageTagPills.vue';
    import ManageTagsModal from './TagList/ManageTagsModal.vue';
    import SettingsModal from './Settings/SettingsModal.vue';
    import SearchModal from './Navigation/SearchModal.vue';
    import SlugModal from './SlugModal.vue';
    import ConfirmModal from './BaseModal/ConfirmModal.vue';
    import MarkdownRenderer from './MarkdownRenderer.vue';
    import { CircleCheck, Eye, Link2 } from 'lucide-vue-next';
    
    import { formatDate } from '../lib/DatetimeFunctions';

    import Constants from '../lib/constants';
    import {
        defaultIndex,
        archiveIndex,
        UnifiedIndex,
        DEFAULT_INDEX_FILENAME,
        ARCHIVE_INDEX_FILENAME,
    } from '../lib/PageIndex';
    import Page from '../lib/Pages/Page';
    import PageService from '../lib/Pages/PageService';
    import storeFactory from '../lib/storeFactory';
    import TagMeta from '../lib/TagMeta';
    import db from '../lib/db';

    const filestore = storeFactory(Constants.FILESTORE.FILE_SYSTEM);

    const title = ref(null);

    const listData = ref([]);
    const currentPage = ref(PageService.newItem());
    const originalPage = ref(null);
    const currentPageNumber = ref(1);
    const activeIndex = ref(defaultIndex);
    const activeTagItems = ref([]);
    const activeTagNameModal = ref('');
    const tagPageCache = ref(new Map());
    
    // Global User Tags State
    const allUserTags = ref([]);
    const pickerTags = ref([]); // allUserTags plus tags that no page currently uses
    const tagColors = ref(new Map());

    const displaySettings = ref(false);
    const displayManageTags = ref(false);
    const displaySearch = ref(false);
    const displayDeleteConfirm = ref(false);
    const displaySlugModal = ref(false);
    const slugTargetPage = ref(null);
    const pendingLinkFilename = ref(null);
    const displayLinkPicker = ref(false);
    // Caret/selection in the content textarea, captured before the native
    // context menu takes focus so "Insert Link…" can write at the right spot.
    const savedCursorPos = ref({ start: null, end: null, selectedText: '' });
    const hasFavourites = ref(false);
    const isSaving = ref(false);
    let saveQueue = Promise.resolve();

    // Provided by App.vue; lets page:// links navigate without a route change
    const navigateToPage = inject('navigateToPage', ref(null));

    const appVersion = __APP_VERSION__;
    const commitHash = __COMMIT_HASH__;

    function updateHasFavourites() {
        hasFavourites.value = defaultIndex.list().some((item) => {
            return item.tags && item.tags.includes(Constants.FAVOURITE_TAG);
        });
    }

    async function loadUserTags() {
        allUserTags.value = UnifiedIndex.getAllUserTags();
        const tagNames = allUserTags.value.map(t => t.name);
        const map = await TagMeta.ensureColors(tagNames);
        // Force reactivity
        tagColors.value = new Map(map);
        // Tags persisted in TagMeta stay in the picker after their last page removes them
        const unusedTags = [...map.keys()]
            .filter(name => !tagNames.includes(name))
            .map(name => ({ name, count: 0 }));
        pickerTags.value = [...allUserTags.value, ...unusedTags];
    }

    onMounted(async () => {
        await UnifiedIndex.init();
        await setup();
        window.onbeforeunload = () => {
            enqueueSave(); // Force a final save
        };
    });

    const removeInsertLinkListener = window.electronAPI.on('insert-link', openLinkPicker);

    onMounted(() => {
        navigateToPage.value = onSearchNavigate;
    });

    onBeforeUnmount(() => {
        removeInsertLinkListener();
        navigateToPage.value = null;
    });

    watch(
        () => [
            currentPage.value?.title,
            currentPage.value?.content,
            currentPage.value?.isMarkdown,
            JSON.stringify(currentPage.value?.tags || []),
        ],
        () => {
            debouncedSave();
        }
    );

    watch(currentPageNumber, (newVal) => {
        if (activeIndex.value?.tagName) {
            tagPageCache.value.set(activeIndex.value.tagName, newVal);
        }
    });

    // Watcher to sync isSaving with the page object if needed by other components
    watch(isSaving, (val) => {
        if (currentPage.value) {
            currentPage.value.isSaving = val;
        }
    });

    watch(
        activeTagItems,
        async (newItems) => {
            if (!newItems || newItems.length === 0 || !activeTagNameModal.value) return;
        },
        { deep: true }
    );

    const isCreationAllowed = computed(() => {
        if (activeIndex.value.tagName === archiveIndex.tagName) {
            return false;
        } else if (listData.value.length === 0) {
            return true;
        } else if (currentPageNumber.value < listData.value.length) {
            return true;
        } else {
            // Must have some content to allow advancing to a brand new blank page
            return !!(currentPage.value?.title || currentPage.value?.content);
        }
    });

    const canGoNext = computed(() => {
        return currentPageNumber.value < listData.value.length || isCreationAllowed.value;
    });

    function assignActiveTagTo(item) {
        if (!item) return;
        const tag = activeIndex.value?.tagName;
        if (tag && tag !== Constants.CURRENT_TAG && tag !== Constants.ARCHIVE_TAG && tag !== Constants.FAVOURITE_TAG) {
            if (!item.tags) item.tags = [];
            if (!item.tags.includes(tag)) {
                item.tags.push(tag);
            }
        }
    }

    async function setup() {
        listData.value = activeIndex.value.list();
        
        let targetPageNumber = 1;
        const tagName = activeIndex.value?.tagName;
        if (tagName && tagPageCache.value.has(tagName)) {
            targetPageNumber = tagPageCache.value.get(tagName);
            if (targetPageNumber < 1) targetPageNumber = 1;
            if (listData.value.length > 0 && targetPageNumber > listData.value.length) {
                targetPageNumber = listData.value.length;
            }
        }

        currentPageNumber.value = targetPageNumber;

        if (listData.value.length > 0) {
            currentPage.value = listData.value[targetPageNumber - 1];
            // Setup is pulling from Indexed DB now, so content is already there
            // But we can ensure it's set properly just in case
            if (currentPage.value) {
                originalPage.value = Object.assign({}, currentPage.value);
            }
        } else {
            assignActiveTagTo(currentPage.value);
            originalPage.value = Object.assign({}, currentPage.value);
        }
        await loadUserTags();
        updateHasFavourites();
    }

    async function save(itemToSave = null, baselineToUse = null) {
        const item = itemToSave || currentPage.value;
        const isCurrent = !itemToSave || itemToSave.filename === currentPage.value?.filename;
        
        if (!item && listData.value) {
            await createNewPageFile();
            return;
        }
        if (hasItemChanged(itemToSave, baselineToUse)) {
            try {
                // Skip if empty - PageService.updateItem will return early if so, 
                // but we check here to avoid isSaving flicker and redundant index calls
                const pageToUpdate = new Page(item);
                if (pageToUpdate.isEmpty()) {
                    return;
                }

                if (isCurrent) {
                    isSaving.value = true;  
                }
                
                // Capture current state to avoid race condition
                const updated = await PageService.updateItem(Object.assign({}, item));
                
                // If we are saving the current page, sync back the modifiedAt
                if (isCurrent && currentPage.value) {
                    currentPage.value.modifiedAt = updated.modifiedAt;
                }
                
                await activeIndex.value.update(updated);
                
                listData.value = activeIndex.value.list();
                
                // Update originalPage reference for the item we just saved
                if (isCurrent) {
                    originalPage.value = Object.assign({}, updated);
                }
                
                updateHasFavourites();
            } finally {
                if (isCurrent) {
                    isSaving.value = false;
                }
            }
        }
    }

    function toggleEditMode() {
        currentPage.value.isMarkdown = !currentPage.value.isMarkdown;
        enqueueSave();
    }

    function enqueueSave(itemToSave = null) {
        const pageSnapshot = itemToSave ? Object.assign({}, itemToSave) : null;
        // If we are snapshotting the current page, we should also snapshot its baseline
        const isCurrent = !itemToSave || (currentPage.value && itemToSave.filename === currentPage.value.filename);
        const baselineSnapshot = isCurrent ? Object.assign({}, originalPage.value) : null;

        saveQueue = saveQueue
            .catch(() => {})
            .then(() => save(pageSnapshot, baselineSnapshot));
        return saveQueue;
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    const debouncedSave = debounce(() => {
        enqueueSave();
    }, 2000); // Reducing debounce to 2s

    function onSetIndex(tagName) {
        if (tagName === Constants.ARCHIVE_TAG) {
            setIndex(ARCHIVE_INDEX_FILENAME);
        } else if (tagName === Constants.CURRENT_TAG) {
            setIndex(DEFAULT_INDEX_FILENAME);
        } else {
            setIndex(`tag_${tagName}.json`, tagName);
        }
    }

    async function setIndex(indexFile, dynamicTagName = null) {
        if (currentPage.value) {
            enqueueSave(currentPage.value); // Background save
        }
        currentPage.value = PageService.newItem();

        if (indexFile === ARCHIVE_INDEX_FILENAME) {
            activeIndex.value = archiveIndex;
        } else if (indexFile === DEFAULT_INDEX_FILENAME) {
            activeIndex.value = defaultIndex;
        } else if (dynamicTagName) {
            activeIndex.value = UnifiedIndex.getTagIndex(dynamicTagName);
        }

        setup();
    }

    async function showReorderList() {
        activeTagNameModal.value = activeIndex.value.tagName;
        activeTagItems.value = await activeIndex.value.filter(activeIndex.value.tagName);
    }

    function closeTagList() {
        activeTagItems.value = [];
        activeTagNameModal.value = '';
    }

    async function updateTagOrder(newItems) {
        activeTagItems.value = newItems;
        await activeIndex.value.saveTagOrder(activeTagNameModal.value, newItems);
        
        if (activeIndex.value.tagName === activeTagNameModal.value) {
            listData.value = activeIndex.value.list();
    
            // Sync the currentPageNumber
            const newIndex = listData.value.findIndex(p => p.filename === currentPage.value?.filename);
            if (newIndex !== -1) {
                currentPageNumber.value = newIndex + 1;
            }
        }
    }

    async function selectListItemByOrder(oldPageIndex, newPageIndex) {
        if (oldPageIndex === newPageIndex) return;
        
        // Save current page in background
        if (currentPage.value) {
            enqueueSave(currentPage.value);
        }

        if (newPageIndex > listData.value.length) {
            await createNewPageFile();
            return;
        }
        currentPageNumber.value = newPageIndex;
        currentPage.value = listData.value[newPageIndex - 1];
        originalPage.value = Object.assign({}, currentPage.value);
    }



    async function archiveFile() {
        if (!currentPage.value.tags) currentPage.value.tags = [];
        currentPage.value.tags = [...new Set([...currentPage.value.tags, Constants.ARCHIVE_TAG])].filter(t => t !== Constants.CURRENT_TAG);
        currentPage.value.isArchived = true;
        
        await save();
        await resetCurrentPage();
    }

    async function unarchiveFile() {
        if (!currentPage.value.tags) currentPage.value.tags = [];
        currentPage.value.tags = [...new Set([...currentPage.value.tags, Constants.CURRENT_TAG])].filter(t => t !== Constants.ARCHIVE_TAG);
        currentPage.value.isArchived = false;
        
        await save();
        await resetCurrentPage();
    }

    function deleteFile() {
        displayDeleteConfirm.value = true;
    }

    async function executeDelete() {
        displayDeleteConfirm.value = false;
        await filestore.deleteFile(currentPage.value.filename);
        await activeIndex.value.delete(currentPage.value);
        await resetCurrentPage();
        updateHasFavourites();
    }

    async function resetCurrentPage() {
        listData.value = activeIndex.value.list();
        let newCurrentPage = listData.value[currentPageNumber.value - 1];
        if (newCurrentPage) {
            currentPage.value = newCurrentPage;
            originalPage.value = Object.assign({}, currentPage.value);
        } else if (listData.value.length > 0) {
            currentPageNumber.value = listData.value.length;
            newCurrentPage = listData.value[currentPageNumber.value - 1];
            currentPage.value = newCurrentPage;
            originalPage.value = Object.assign({}, currentPage.value);
        } else {
            currentPageNumber.value = 1;
            currentPage.value = PageService.newItem();
            assignActiveTagTo(currentPage.value);
            originalPage.value = Object.assign({}, currentPage.value);
        }
    }

    async function createNewPageFile() {
        if (currentPage.value) {
            enqueueSave(currentPage.value); // Background save
        }
        let item = await PageService.createItem();
        assignActiveTagTo(item); // Ensure it gets the current tag
        await activeIndex.value.append(item);
        listData.value = activeIndex.value.list(); // Crucial: Refresh listData so Vue knows about it
        currentPage.value = item;
        originalPage.value = Object.assign({}, currentPage.value);
        currentPageNumber.value = listData.value.length;
    }

    async function addToFavourites() {
        if (!currentPage.value.tags) currentPage.value.tags = [];
        
        const currentlyFav = currentPage.value.tags.includes(Constants.FAVOURITE_TAG);
        
        if (!currentlyFav) {
            currentPage.value.tags.push(Constants.FAVOURITE_TAG);
            currentPage.value.isFavourite = true;
        } else {
            currentPage.value.tags = currentPage.value.tags.filter(t => t !== Constants.FAVOURITE_TAG);
            currentPage.value.isFavourite = false;
        }

        if (currentPage.value.tags.includes(Constants.FAVOURITE_TAG) && !currentPage.value.title) {
            alert('Please enter a title');
            title.value.focus();
        } else {
            await save();
            updateHasFavourites();
        }
    }

    // --- Tag Management Methods ---

    async function onRemoveTagFromPage(tagName) {
        if (!currentPage.value.tags) return;
        currentPage.value.tags = currentPage.value.tags.filter(t => t !== tagName);
        await save();
        await loadUserTags(); // Update global counts
        if (activeIndex.value.tagName === tagName) {
            await resetCurrentPage(); // We just removed ourselves from the active filter
        }
    }

    async function onAddTagToPage(tagName) {
        if (!currentPage.value.tags) currentPage.value.tags = [];
        if (!currentPage.value.tags.includes(tagName)) {
            currentPage.value.tags.push(tagName);
            await save();
            await loadUserTags();
        }
    }

    async function onCreateAndAddTagToPage(tagName) {
        await TagMeta.ensureColors([tagName]);
        await onAddTagToPage(tagName);
    }

    function onCreateNewTagFromTab() {
        showManageTags();
        // Since ManageTagsModal doesn't natively "create" a standalone blank tag yet (tags are inferred from pages),
        // we could just open Manage Tags. The user can create tags by attaching them in the editor.
    }

    function showManageTags() {
        displayManageTags.value = true;
    }

    async function onRenameTag(oldName, newName) {
        // Find every page using the old tag and rename it
        for (const item of UnifiedIndex.items) {
            if (item.tags && item.tags.includes(oldName)) {
                item.tags = item.tags.filter(t => t !== oldName);
                if (!item.tags.includes(newName)) item.tags.push(newName);
                await db.put(item);
            }
        }
        
        // Rename color metadata
        const color = await TagMeta.getColor(oldName);
        await TagMeta.set(newName, color);
        await TagMeta.remove(oldName);

        // Rename tag ordering
        const order = await db.getOrder(oldName);
        if (order) {
            await db.putOrder(newName, order);
            await db.putOrder(oldName, []);
        }

        // If currently viewing the old tag, flip to the new tag
        if (activeIndex.value.tagName === oldName) {
            onSetIndex(newName);
        } else {
            await loadUserTags();
            await resetCurrentPage();
        }
    }

    async function onRecolorTag(tagName, color) {
        await TagMeta.set(tagName, color);
        await loadUserTags();
    }

    async function onDeleteTagGlobally(tagName) {
        // Remove from all pages
        for (const item of UnifiedIndex.items) {
            if (item.tags && item.tags.includes(tagName)) {
                item.tags = item.tags.filter(t => t !== tagName);
                await db.put(item);
            }
        }
        
        await TagMeta.remove(tagName);
        await db.putOrder(tagName, []);

        if (activeIndex.value.tagName === tagName) {
            onSetIndex(Constants.CURRENT_TAG);
        } else {
            await loadUserTags();
            await resetCurrentPage();
        }
    }

    async function showFavourites() {
        activeTagNameModal.value = Constants.FAVOURITE_TAG;
        activeTagItems.value = await UnifiedIndex.filterByTag(Constants.FAVOURITE_TAG);
    }

    function hasItemChanged(itemToCompare = null, baseline = null) {
        const item = itemToCompare || currentPage.value;
        const isCurrent = !itemToCompare || (currentPage.value && itemToCompare.filename === currentPage.value.filename);
        const compareAgainst = baseline || (isCurrent ? originalPage.value : null);
        
        let hasChanged = false;
        if (!item) return false;

        // If we don't have something to compare against (e.g. background save with no baseline), 
        // we should save to be safe.
        if (!compareAgainst) return true; 

        for (let entry of Object.entries(item)) {
            let key = entry[0];
            let value = entry[1];
            if (compareAgainst && value !== compareAgainst[key] && key !== 'modifiedAt' && key !== 'isSaving') {
                hasChanged = true;
                break;
            }
        }
        return hasChanged;
    }

    function saveCursorPos(event) {
        const { selectionStart, selectionEnd, value } = event.target;
        savedCursorPos.value = {
            start: selectionStart,
            end: selectionEnd,
            selectedText: value.slice(selectionStart, selectionEnd),
        };
    }

    function openLinkPicker() {
        displayLinkPicker.value = true;
    }

    function openSlugModal(page) {
        slugTargetPage.value = page;
        displaySlugModal.value = true;
    }

    function onPickPage(page) {
        displayLinkPicker.value = false;
        if (page.slug) {
            onInsertLink(page);
            return;
        }
        // No slug yet: assign one first, then insert the link once it is saved
        pendingLinkFilename.value = page.filename;
        openSlugModal(page);
    }

    async function onSlugSave(slug) {
        const page = slugTargetPage.value;
        page.slug = slug;
        displaySlugModal.value = false;
        await enqueueSave(page);

        if (pendingLinkFilename.value === page.filename) {
            pendingLinkFilename.value = null;
            onInsertLink(page);
        }
    }

    function onInsertLink(page) {
        const content = currentPage.value.content || '';
        const { start, end, selectedText } = savedCursorPos.value;
        const from = start ?? content.length;
        const to = end ?? content.length;

        const label = selectedText || page.title;
        const link = `[${label}](page://${page.slug})`;
        currentPage.value.content = content.slice(0, from) + link + content.slice(to);

        // Put the caret straight after the inserted link
        nextTick(() => {
            const textarea = document.querySelector('.page-layout__content-textarea');
            if (!textarea) return;
            const caret = from + link.length;
            textarea.focus();
            textarea.setSelectionRange(caret, caret);
        });
    }

    function showSettings() {
        displaySettings.value = true;
    }

    function closeSettings() {
        displaySettings.value = false;
    }

    async function onSearchNavigate(filename) {
        console.log('xxxx filename:', filename);
        displaySearch.value = false;

        // Pages live in the default (All Pages) index, or in the archive if archived.
        const targetIndex = [defaultIndex, archiveIndex].find((index) =>
            index.list().some((item) => item.filename === filename)
        ) ?? defaultIndex;
        let newIndex = targetIndex.list().findIndex((item) => item.filename === filename);

        if (newIndex !== -1) {
            if (activeIndex.value.tagName !== targetIndex.tagName) {
                // Ensure any changes on the current page are saved before switching context
                if (currentPage.value) {
                    enqueueSave(currentPage.value);
                }
                activeIndex.value = targetIndex;
                listData.value = activeIndex.value.list();

                closeTagList();
                // Pass -1 as oldPageIndex to bypass the early return in selectListItemByOrder
                // if the new page number happens to match the old page number from the previous index
                await selectListItemByOrder(-1, newIndex + 1);
            } else {
                closeTagList();
                await selectListItemByOrder(currentPageNumber.value, newIndex + 1);
            }
        } else {
            closeTagList();
        }
    }
</script>

<style lang="scss">
    @use 'sass:color';
    .page-layout {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: #f5f5f5;
    }

    .page-layout__meta {
        padding: 0 10px 0 10px;
        display: flex;
        justify-content: flex-start;
        height: 20px;
    }

    .page-layout__tags {
        padding: 6px 10px 0 10px;
    }

    .page-layout__pad {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 5px 10px 0 10px;
        min-height: 0; /* Enable shrinking/scrolling for flex children */


    .page-layout__title-input {
            width: 100%;
            line-height: 30px;
            height: 30px;
            font-family: 'Roboto Mono';
            padding: 0 10px 0 10px;
            border-radius: 4px;
            border: 1px solid #cccccc;
            box-sizing: border-box;
            margin-bottom: 6px;
        }

        .page-layout__header {
            display: flex;
            align-items: center;
            gap: 0;
            margin-bottom: 6px;

            .page-layout__title-input {
                margin-bottom: 0;
                flex: 1;
            }
        }

        .page-layout__slug-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 30px;
            padding: 0 4px;
            border: none;
            background: none;
            color: #999;
            cursor: pointer;

            svg {
                opacity: 1;
            }
        }

        .page-layout__markdown-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 0 0 0 10px;
            height: 30px;
            color: #999;
            transition: color 0.3s ease;

            &.active {
                color: #999;
            }

            svg {
                opacity: 0.6;
                &.active {
                    opacity: 1;
                    color: #999;
                }
            }
        }

        /* The switch - the box around the slider */
        .switch {
          position: relative;
          display: inline-block;
          width: 34px;
          height: 20px;
        }

        /* Hide default HTML checkbox */
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        /* The slider */
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          -webkit-transition: .4s;
          transition: .4s;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          -webkit-transition: .4s;
          transition: .4s;
        }

        input:checked + .slider {
          background-color: #999;
        }

        input:focus + .slider {
          box-shadow: 0 0 1px #999;
        }

        input:checked + .slider:before {
          -webkit-transform: translateX(14px);
          -ms-transform: translateX(14px);
          transform: translateX(14px);
        }

        /* Rounded sliders */
        .slider.round {
          border-radius: 20px;
        }

        .slider.round:before {
          border-radius: 50%;
        }

        .page-layout__content-textarea {
            flex: 1;
            width: 100%;
            font-family: 'Roboto Mono';
            border-radius: 4px;
            border-color: #ccc;
            resize: none;
            overflow-y: scroll;
            box-sizing: border-box;
            padding: 10px;
        }

        .page-layout__content-textarea::-webkit-scrollbar-track {
            background-color: #f5f5f5;
            border-left: 1px solid #ccc;
        }

        .page-layout__content-textarea::-webkit-scrollbar {
            width: 12px;
            background-color: #f5f5f5;
        }

        .page-layout__content-textarea::-webkit-scrollbar-thumb {
            border-radius: 2px;
            -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
            background-color: #ddd;
        }
    }



    .page-layout__nav {
        padding: 10px 10px 5px 10px;
        background: #f5f5f5;
        display: flex;
        justify-content: space-between;
    }

    .page-layout__foot {
        height: 20px;
        padding: 0 10px 0 10px;
        display: flex;
        justify-content: space-between;
    }

    .page-layout__date-text {
        font-size: 10px;
        line-height: 20px;
        color: #999;
    }

    .fade-enter-active,
    .fade-leave-active {
        transition: opacity 1s ease;
    }

    .fade-enter-from,
    .fade-leave-to {
        opacity: 0;
    }
</style>
