import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  markdown:{
    math : true
  },
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
    },
    sidebar:[
      {
        text: 'GAMES101',
        collapsed: true,
        items: [
          { text: 'Geometry', link: '/posts/GAMES101/Geometry/' },
          { text: 'Rasterization', link: '/posts/GAMES101/Rasterization/' },
          { text: 'Shading', link: '/posts/GAMES101/Shading/' },
          { text: 'Transformer', link: '/posts/GAMES101/Transformer/' }
        ]
      },
      {
        text: 'UE',
        collapsed: true,
        items: [
          { text: 'Collision', link: '/posts/UE/UE_Collision' },
          { text: 'SharedPtr', link: '/posts/UE/UE_SharedPtr' },
          { text: 'TTypes', link: '/posts/UE/UE_TTypes' },
          { text: 'Without CRTP', link: '/posts/UE/UE_without_CRTP' }
        ]
      }
    ]
  }
})
