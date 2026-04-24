---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Asorijin Blog"
  text: "A Programmer's Site"
  actions:
    
---

<script setup>
import { data } from './posts.data'
import { computed } from 'vue'


const groupedPosts = computed(() => {
  const groups = {}
  data.forEach(post => {
    const category = post.category || 'Uncategorized'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(post)
  })
  return groups
})

const previewCount = 3
</script>

<div class="post-list-wrapper">
  <h1>All Blog Posts</h1>

  <div v-for="(posts, category) in groupedPosts" :key="category" class="category-section">
    <div class="category-header">
      <h2 class="category-title">
        <a :href="`/posts/${category}/`" class="category-link">{{ category }}</a>
      </h2>
    </div>
    <ul class="post-list">
      <li v-for="post in posts.slice(0, previewCount)" :key="post.url" class="post-list-item">
        <a :href="post.url" class="post-list-link">
          {{ post.frontmatter.title || post.url }}
        </a>
        <div class="post-list-meta">
          <span v-if="post.frontmatter.author">
            {{ post.frontmatter.author }}
          </span>
          <span v-if="post.frontmatter.author && post.frontmatter.date">
            ·
          </span>
          <span v-if="post.displayDate">
            {{ post.displayDate }}
          </span>
        </div>
      </li>
    </ul>
  </div>
</div>

<div class="bt">
  <a href="http://beian.miit.gov.cn/">冀ICP备2026007532号</a>
</div>

<style>
.bt{
  text-align:center;
  padding-top:180px;
  margin-bottom:-150px;
  font-size:10px;
}

.category-section {
  margin-bottom: 3rem;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--vp-c-divider);
}

.category-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.category-link {
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: color 0.2s;
}

.category-link:hover {
  color: var(--vp-c-brand-1);
}

.view-more {
  font-size: 0.9rem;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 500;
}

.view-more:hover {
  color: var(--vp-c-brand-2);
}
</style>