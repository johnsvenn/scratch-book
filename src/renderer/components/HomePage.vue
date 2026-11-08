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
                    {{ isSaving ? 'Saving...' : '' }}
                </span>
            </div>
        </section>

        <!-- ROW 4 & 5: Editor (Title + Content) -->
        <section class="page-layout__pad">
            <div class="page-layout__header">
                <input ref="title"
                       type="text"
                       class="page-layout__title-input"
                       placeholder="Title..."
                       :value="currentPage.title"
                       @input="setField('title', $event.target.value)" />

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
                        <input :checked="currentPage.isMarkdown"
                               type="checkbox"
                               @change="setMarkdown($event.target.checked)" />
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>

            <textarea v-if="!currentPage.isMarkdown"
                      ref="content"
                      class="page-layout__content-textarea"
                      placeholder="Notes..."
                      :value="currentPage.content"
                      @input="setField('content', $event.target.value)"
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
    import { ref, reactive, toRef, computed, watch, onMounted, onBeforeUnmount, inject, nextTick } from 'vue';

    import PageTags from './Navigation/PageTags.vue';
    import TagListModal from './TagList/TagListModal.vue';
    import PageNavigation from './Navigation/PageNavigation.vue';
    import PageControls from './Navigation/PageControls.vue';
    import PageTagPills from './Navigation/PageTagPills.vue';
    import ManageTagsModal from './TagList/ManageTagsModal.vue';
    import SettingsModal from './Settings/SettingsModal.vue';
    import SearchModal from './Navigation/SearchModal.vue';
    import SlugModal from './SlugModal.vue';
    import { IPC } from '../../shared/protocol.js';
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
    import pageWriter from '../lib/Pages/PageWriter';
    import { createEditorSession } from '../lib/EditorSession';
    import TagMeta from '../lib/TagMeta';
    import db from '../lib/db';

    const title = ref(null);

    const listData = ref([]);
    // The page being edited, its saved copy and saving live in the editor session.
    const editor = createEditorSession({ writer: pageWriter, reactive, onSaved: onPageSaved });
    editor.load(new Page());
    const currentPage = toRef(editor.state, 'page');
    const isSaving = toRef(editor.state, 'isSaving');
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
            editor.saveCurrent(); // Force a final save
        };
    });

    const removeInsertLinkListener = window.electronAPI.on(IPC.insertLink, openLinkPicker);

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
            editor.scheduleSave();
        }
    );

    watch(currentPageNumber, (newVal) => {
        if (activeIndex.value?.tagName) {
            tagPageCache.value.set(activeIndex.value.tagName, newVal);
        }
    });

    watch(
        activeTagItems,
        async (newItems) => {
            if (!newItems || newItems.length === 0 || !activeTagNameModal.value) {
                return;
            }
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
        if (!item) {
            return;
        }
        const tag = activeIndex.value?.tagName;
        if (tag && tag !== Constants.CURRENT_TAG && tag !== Constants.ARCHIVE_TAG && tag !== Constants.FAVOURITE_TAG) {
            if (!item.tags) {
                item.tags = [];
            }
            if (!item.tags.includes(tag)) {
                // New array, not push: page tags are replaced, never mutated in place.
                item.tags = [...item.tags, tag];
            }
        }
    }

    async function setup() {
        listData.value = activeIndex.value.list();
        
        let targetPageNumber = 1;
        const tagName = activeIndex.value?.tagName;
        if (tagName && tagPageCache.value.has(tagName)) {
            targetPageNumber = tagPageCache.value.get(tagName);
            if (targetPageNumber < 1) {
                targetPageNumber = 1;
            }
            if (listData.value.length > 0 && targetPageNumber > listData.value.length) {
                targetPageNumber = listData.value.length;
            }
        }

        currentPageNumber.value = targetPageNumber;

        if (listData.value.length > 0) {
            // Setup is pulling from Indexed DB now, so content is already there
            const page = listData.value[targetPageNumber - 1];
            if (page) {
                editor.load(page);
            }
        } else {
            const blank = new Page();
            assignActiveTagTo(blank);
            editor.load(blank);
        }
        await loadUserTags();
        updateHasFavourites();
    }

    // Called by the editor session after each save, so the index and list stay in step.
    async function onPageSaved(updated) {
        await activeIndex.value.update(updated);
        listData.value = activeIndex.value.list();
        updateHasFavourites();
    }

    // The template and handlers change page fields only through the session.
    function setField(name, value) {
        editor.setField(name, value);
    }

    function toggleEditMode() {
        setField('isMarkdown', !currentPage.value.isMarkdown);
        editor.saveCurrent();
    }

    function setMarkdown(value) {
        setField('isMarkdown', value);
        return editor.saveCurrent();
    }

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
        // load() saves the page being left, if it changed
        editor.load(new Page());

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
        if (oldPageIndex === newPageIndex) {
            return;
        }

        if (newPageIndex > listData.value.length) {
            await createNewPageFile();
            return;
        }
        currentPageNumber.value = newPageIndex;
        editor.load(listData.value[newPageIndex - 1]); // saves the page being left, if it changed
    }



    async function archiveFile() {
        if (!currentPage.value.tags) {
            setField('tags', []);
        }
        setField('tags', [...new Set([...currentPage.value.tags, Constants.ARCHIVE_TAG])].filter(t => t !== Constants.CURRENT_TAG));
        setField('isArchived', true);
        
        await editor.saveCurrent();
        await resetCurrentPage();
    }

    async function unarchiveFile() {
        if (!currentPage.value.tags) {
            setField('tags', []);
        }
        setField('tags', [...new Set([...currentPage.value.tags, Constants.CURRENT_TAG])].filter(t => t !== Constants.ARCHIVE_TAG));
        setField('isArchived', false);
        
        await editor.saveCurrent();
        await resetCurrentPage();
    }

    function deleteFile() {
        displayDeleteConfirm.value = true;
    }

    async function executeDelete() {
        displayDeleteConfirm.value = false;
        await pageWriter.remove(currentPage.value);
        await activeIndex.value.delete(currentPage.value);
        editor.discard(); // the page is gone: do not save its unsaved edits on the way out
        await resetCurrentPage();
        updateHasFavourites();
    }

    async function resetCurrentPage() {
        listData.value = activeIndex.value.list();
        let newCurrentPage = listData.value[currentPageNumber.value - 1];
        if (newCurrentPage) {
            editor.load(newCurrentPage);
        } else if (listData.value.length > 0) {
            currentPageNumber.value = listData.value.length;
            newCurrentPage = listData.value[currentPageNumber.value - 1];
            editor.load(newCurrentPage);
        } else {
            currentPageNumber.value = 1;
            const blank = new Page();
            assignActiveTagTo(blank);
            editor.load(blank);
        }
    }

    async function createNewPageFile() {
        let item = new Page();
        assignActiveTagTo(item); // Ensure it gets the current tag
        await activeIndex.value.append(item);
        listData.value = activeIndex.value.list(); // Crucial: Refresh listData so Vue knows about it
        editor.load(item); // saves the page being left, if it changed
        currentPageNumber.value = listData.value.length;
    }

    async function addToFavourites() {
        if (!currentPage.value.tags) {
            setField('tags', []);
        }
        
        const currentlyFav = currentPage.value.tags.includes(Constants.FAVOURITE_TAG);
        
        if (!currentlyFav) {
            // New array, not push: the saved copy shares this array, so a push would not be seen as a change.
            setField('tags', [...currentPage.value.tags, Constants.FAVOURITE_TAG]);
            setField('isFavourite', true);
        } else {
            setField('tags', currentPage.value.tags.filter(t => t !== Constants.FAVOURITE_TAG));
            setField('isFavourite', false);
        }

        if (currentPage.value.tags.includes(Constants.FAVOURITE_TAG) && !currentPage.value.title) {
            alert('Please enter a title');
            title.value.focus();
        } else {
            await editor.saveCurrent();
            updateHasFavourites();
        }
    }

    // --- Tag Management Methods ---

    async function onRemoveTagFromPage(tagName) {
        if (!currentPage.value.tags) {
            return;
        }
        setField('tags', currentPage.value.tags.filter(t => t !== tagName));
        await editor.saveCurrent();
        await loadUserTags(); // Update global counts
        if (activeIndex.value.tagName === tagName) {
            await resetCurrentPage(); // We just removed ourselves from the active filter
        }
    }

    async function onAddTagToPage(tagName) {
        if (!currentPage.value.tags) {
            setField('tags', []);
        }
        if (!currentPage.value.tags.includes(tagName)) {
            // New array, not push: the saved copy shares this array, so a push would not be seen as a change.
            setField('tags', [...currentPage.value.tags, tagName]);
            await editor.saveCurrent();
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
        // Writer rewrites every page that uses the old tag (disk, store and search)
        await pageWriter.renameTag(oldName, newName);
        await UnifiedIndex.read();

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
        // Writer removes the tag from all pages (disk, store and search)
        await pageWriter.removeTag(tagName);
        await UnifiedIndex.read();

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
        displaySlugModal.value = false;
        if (page.filename === currentPage.value?.filename) {
            setField('slug', slug);
            await editor.saveCurrent();
        } else {
            await editor.saveOther({ ...page, slug });
        }

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
        setField('content', content.slice(0, from) + link + content.slice(to));

        // Put the caret straight after the inserted link
        nextTick(() => {
            const textarea = document.querySelector('.page-layout__content-textarea');
            if (!textarea) {
                return;
            }
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
                await editor.saveCurrent();
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
