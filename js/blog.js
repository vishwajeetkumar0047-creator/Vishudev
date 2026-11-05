/* Blog page: shows published posts from the database */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* tiny formatter: ## heading, **bold**, "- " list items, [text](https://link). Text is escaped first. */
function md(text){
  const inline = s => s
    .replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" decoding="async">')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener nofollow" target="_blank">$1</a>');
  const out = []; let inList = false;
  for(const raw of esc(text).split('\n')){
    const l = raw.trim();
    if(l.startsWith('- ')){ if(!inList){ out.push('<ul>'); inList = true; } out.push('<li>' + inline(l.slice(2)) + '</li>'); continue; }
    if(inList){ out.push('</ul>'); inList = false; }
    if(l.startsWith('## ') || l.startsWith('# ')){ out.push('<h3>' + inline(l.replace(/^#+ /, '')) + '</h3>'); continue; }
    if(l){ const html = inline(l); out.push(html.startsWith('<img') ? html : '<p>' + html + '</p>'); }
  }
  if(inList) out.push('</ul>');
  return out.join('\n');
}

(async function loadPosts(){
  const list = document.getElementById('posts');
  const { data, error } = await db.from('blog_posts')
    .select('title, slug, excerpt, body, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false });
  if(error){ list.innerHTML = '<p class="meta">Could not load posts. Please refresh.</p>'; return; }
  if(!data.length){ list.innerHTML = '<p class="meta">No posts yet. Check back soon.</p>'; return; }
  list.innerHTML = data.map(p => `
    <article class="post" id="${esc(p.slug)}">
      <small>${esc(new Date(p.published_at).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }))}</small>
      <h2>${esc(p.title)}</h2>
      ${p.excerpt ? `<p class="excerpt">${esc(p.excerpt)}</p>` : ''}
      <div class="body">${md(p.body)}</div>
    </article>`).join('');
})();

document.querySelectorAll('.yr').forEach(el => el.textContent = new Date().getFullYear());
