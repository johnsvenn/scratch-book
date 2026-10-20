<template>
    <div class="markdown-renderer" v-html="renderedHtml"></div>
</template>

<script setup>
import { computed } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
});

// DOMPurify's default URI allowlist (http, https, mailto, …) strips the
// page:// scheme used for internal links, so extend it with `page`.
const ALLOWED_URI_REGEXP = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|page):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

const renderedHtml = computed(() => {
  const rawHtml = marked.parse(props.content || '');
  return DOMPurify.sanitize(rawHtml, { ALLOWED_URI_REGEXP });
});
</script>

<style lang="scss">
.markdown-renderer {
  flex: 1;
  width: 100%;
  font-family: 'Roboto', sans-serif;
  background: white;
  border-radius: 4px;
  border: 1px solid #ccc;
  padding: 20px;
  overflow-y: auto;
  min-height: 0; /* Allow shrinking to enable scrollbar */
  box-sizing: border-box;
  color: #333;
  line-height: 1.6;

  /* Basic Markdown Styling */
  h1, h2, h3, h4, h5, h6 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    line-height: 1.25;
    color: #000;
  }

  h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }

  p {
    margin-top: 0;
    margin-bottom: 16px;
  }

  code {
    font-family: 'Roboto Mono', monospace;
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 85%;
    background-color: rgba(175, 184, 193, 0.2);
    border-radius: 6px;
  }

  pre {
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #f6f8fa;
    border-radius: 6px;
    margin-bottom: 16px;

    code {
      background-color: transparent;
      padding: 0;
      margin: 0;
      font-size: 100%;
      word-break: normal;
      white-space: pre;
    }
  }

  blockquote {
    padding: 0 1em;
    color: #636c76;
    border-left: 0.25em solid #d0d7de;
    margin: 0 0 16px 0;
  }

  ul, ol {
    margin-top: 0;
    margin-bottom: 16px;
    padding-left: 2em;
  }

  li {
    margin-top: 0.25em;
  }

  hr {
    height: 0.25em;
    padding: 0;
    margin: 24px 0;
    background-color: #d0d7de;
    border: 0;
  }

  img {
    max-width: 100%;
    box-sizing: content-box;
  }

  table {
    display: block;
    width: 100%;
    width: max-content;
    max-width: 100%;
    overflow: auto;
    margin-top: 0;
    margin-bottom: 16px;
    border-spacing: 0;
    border-collapse: collapse;

    tr {
      background-color: #ffffff;
      border-top: 1px solid #d8dee4;

      &:nth-child(2n) {
        background-color: #f6f8fa;
      }
    }

    th, td {
      padding: 6px 13px;
      border: 1px solid #d0d7de;
    }

    th {
      font-weight: 600;
    }
  }

  /* Scrollbar styling matched to textarea */
  &::-webkit-scrollbar-track {
    background-color: #f5f5f5;
    border-left: 1px solid #ccc;
  }

  &::-webkit-scrollbar {
    width: 12px;
    background-color: #f5f5f5;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 2px;
    -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
    background-color: #ddd;
  }
}
</style>
