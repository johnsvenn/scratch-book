import { createApp } from 'vue';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto-mono/400.css';

import App from './App.vue';
import router from './router';
import SyncService from './lib/SyncService';

SyncService.init();
window.addEventListener('beforeunload', () => {
    SyncService.teardown();
});

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        SyncService.teardown();
    });
}

const app = createApp(App);
app.use(router);
app.mount('#app');
