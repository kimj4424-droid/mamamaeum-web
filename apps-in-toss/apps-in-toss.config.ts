import { defineConfig } from '@apps-in-toss/web-framework/config'

export default defineConfig({
  // 앱인토스 콘솔의 appName과 반드시 같아야 합니다.
  appName: 'mamamaeum',
  brand: { primaryColor: '#EC6B53' },
  permissions: [
    { name: 'clipboard', access: 'read' },
    { name: 'clipboard', access: 'write' },
  ],
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
    withTitle: true,
    theme: 'light',
  },
  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
  },
  webBundleDir: 'dist',
})
