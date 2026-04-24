---
title: Unreal Engine 系列
layout: page
---

<script setup>
import { data } from './ue.data'
</script>

<div class="category-page">
  <h1>Unreal Engine 系列文章</h1>
  <p class="category-description">UE5 开发笔记与技术总结</p>

  <ul class="post-list">
    <li v-for="post in data" :key="post.url" class="post-list-item">
      <a :href="post.url" class="post-list-link">
        {{ post.frontmatter.title || post.url }}
      </a>
      <div class="post-list-meta">
        <span v-if="post.frontmatter.description" class="post-description">
          {{ post.frontmatter.description }}
        </span>
        <span v-if="post.displayDate" class="post-date">
          {{ post.displayDate }}
        </span>
      </div>
    </li>
  </ul>
</div>

<style scoped>
.category-page {
  max-width: 48rem;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.category-description {
  font-size: 1.1rem;
  color: var(--vp-c-text-2);
  margin-bottom: 2rem;
}

.post-list {
  list-style: none;
  padding: 0;
}

.post-list-item {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.post-list-link {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.post-list-link:hover {
  color: var(--vp-c-brand-2);
}

.post-list-meta {
  margin-top: 0.5rem;
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
}

.post-description {
  flex: 1;
}

.post-date {
  white-space: nowrap;
}
</style>
