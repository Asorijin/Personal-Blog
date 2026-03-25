import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({

  vite:{
    server:{
      host: '0.0.0.0',
      port:5173,
      allowedHosts:['asorijin.work']
    }
  },
  title: " ",
  description: "A VitePress Site",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Asorijin/Personal-Blog' }
    ],

    footer:{
      message: '如有技术错误或应改进之处感谢前往GitHub指出'
    }
  }
})
