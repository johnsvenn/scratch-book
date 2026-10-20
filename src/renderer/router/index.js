import { createRouter, createWebHashHistory } from 'vue-router';
import HomePage from '../components/HomePage.vue';

export default createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            name: 'home-page',
            component: HomePage,
        },
        {
            path: '/:pathMatch(.*)*',
            redirect: '/',
        },
    ],
});
