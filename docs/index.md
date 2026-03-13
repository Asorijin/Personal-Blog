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
console.log('Posts data:', data)
</script>

<div class="post-list-wrapper">
  <h1>All Blog Posts</h1>

  <ul class="post-list">
    <li v-for="post in data" :key="post.url" class="post-list-item">
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
</style>