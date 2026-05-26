import { defineConfig } from 'vitepress'
import type MarkdownIt from 'markdown-it'

// 自定义 ::: details <标题> ... ::: 折叠容器
function detailsPlugin(md: MarkdownIt) {
  // 自定义 block rule 解析 ::: details
  md.block.ruler.before('fence', 'details_container', (state, startLine, endLine, silent) => {
    const pos = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    const line = state.src.slice(pos, max)

    const openMatch = line.match(/^:{3,}\s*details\s*(.*)/)
    if (!openMatch) return false
    if (silent) return true

    let nextLine = startLine
    let autoClose = true
    const old_parent = state.parentType
    const old_lineMax = state.lineMax

    state.parentType = 'details'

    // 找到对应的 ::: 结束行
    for (; nextLine < endLine; nextLine++) {
      const p = state.bMarks[nextLine] + state.tShift[nextLine]
      const m = state.eMarks[nextLine]
      const l = state.src.slice(p, m)
      if (l.match(/^:{3,}\s*$/)) {
        autoClose = false
        break
      }
    }

    // 如果没有找到 ::: 就自己关闭
    if (autoClose) {
      nextLine = startLine + 1
      while (nextLine < endLine && state.isEmpty(nextLine)) nextLine++
    }

    state.lineMax = nextLine + (autoClose ? 1 : 0) // 跳过闭合 ::: 行

    const title = (openMatch[1] || '展开').trim()

    // open token
    const token_o = state.push('details_open', 'details', 1)
    token_o.markup = ':::'
    token_o.block = true
    token_o.attrSet('open', title === '展开(默认展开)' ? 'true' : null)
    token_o.content = title

    // 递归处理内部内容
    state.md.block.tokenize(state, startLine + 1, nextLine)

    // close token
    state.push('details_close', 'details', -1)

    state.parentType = old_parent
    state.lineMax = old_lineMax
    state.line = autoClose ? nextLine + 1 : nextLine
    return true
  })

  // 渲染 open token
  md.renderer.rules.details_open = (tokens, idx) => {
    const title = md.utils.escapeHtml(tokens[idx].content || '展开')
    const openAttr = tokens[idx].attrGet('open')
    const openStr = openAttr === 'true' ? ' open' : ''
    return `<details${openStr}><summary>${title}</summary>\n`
  }

  // 渲染 close token
  md.renderer.rules.details_close = () => '</details>\n'
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  markdown:{
    math : true,
    config: (md: MarkdownIt) => {
      md.use(detailsPlugin)
    }
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
      },
      {
        text: 'Claude Code',
        collapsed: true,
        items: [
          { text: '主工作流解析', link: '/posts/ClaudeCode/claude-code-analysis' }
        ]
      },
      {
        text: '算法',
        collapsed: true,
        items: [
          { text: 'GJK 碰撞检测', link: '/posts/算法/GJK算法' }
        ]
      }
    ]
  }
})
