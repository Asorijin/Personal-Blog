import { createContentLoader } from 'vitepress'

export default createContentLoader('posts/面试/**/*.md', {
  transform(posts) {
    return posts
      .filter(post => !post.url.endsWith('/面试/'))
      .map(post => {
        let displayDate = ''
        if (post.frontmatter.date) {
          const date = new Date(post.frontmatter.date)
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
