import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            rollupOptions: {
                input: {
                    index: 'src/main/index.js'
                }
            }
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            rollupOptions: {
                input: {
                    index: 'src/main/preload.js'
                }
            }
        }
    },
    renderer: {
        resolve: {
            alias: {
                '@': resolve('src/renderer')
            }
        },
        plugins: [vue()],
        root: 'src/renderer',
        css: {
            preprocessorOptions: {
                scss: {
                    api: 'modern-compiler',
                    additionalData: `@use "@/assets/styles/_colors.scss" as *;`
                }
            }
        },
        define: {
            __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
            __COMMIT_HASH__: JSON.stringify('74dc521')
        },
        build: {
            rollupOptions: {
                input: 'src/renderer/index.html'
            }
        }
    }
})
