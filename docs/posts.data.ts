import { createContentLoader } from 'vitepress'

// 根据你的实际文章目录调整这里的路径：
// VitePress 中这里需要以 `/` 开头，表示从文档根目录开始匹配
// 下面的写法会加载 docs 根目录下的所有 .md 文件
export default createContentLoader('posts/*.md', {
  // 你也可以用 '/blog/*.md' 之类的更精确匹配
  transform(posts) {
    // 根据需要排序，比如按日期倒序（如果 frontmatter 里有 date）
    return posts
      .map(post => {
        let displayDate = ''
        if (post.frontmatter.date) {
          const date = new Date(post.frontmatter.date)
          // 使用 toISOString 并截取前10位（时区为 UTC）
          // 如果你希望按本地时区显示，可改用 toLocaleDateString
          displayDate = date.toISOString().slice(0, 10)
        }
        return {
          ...post,
          displayDate
        }
      })
      .sort((a, b) => {
        const da = a.frontmatter.date ? new Date(a.frontmatter.date).getTime() : 0
        const db = b.frontmatter.date ? new Date(b.frontmatter.date).getTime() : 0
        return db - da
      })
  }
})



