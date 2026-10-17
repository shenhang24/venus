// Display aliases only: filenames, record IDs and source Markdown remain unchanged.
export function showNodeLabel(node,revealedMainTag){return !node.isMainTag||node.id===revealedMainTag;}
export function shortNodeLabel(node, budget = 28) {
  let title = String(node.title || node.path?.split('/').at(-1) || '').trim();
  title = title.replace(/\.md$/i, '')
    .replace(/^(?:GPT|TASK)[-_][a-f0-9]{12,64}[-_]/i, '')
    .replace(/^(?:\d{4}[-年/]\d{1,2}[-月/]\d{1,2}日?[ _·-]*)+/, '')
    .replace(/^(?:(?:分支|副本|复制|Branch|Copy)\s*[·:：\-–—]\s*)+/i, '')
    .replace(/^(?:关于|讨论一下|讨论|请帮我|帮我|如何|怎么)\s*/, '')
    .replace(/\s+/g, ' ').trim();
  if (!title || /^(?:new chat|新对话|未命名对话|untitled)$/i.test(title)) {
    title = node.categories?.slice(0, 2).join(' · ') || '未命名对话';
  }
  // Prefer a meaningful leading topic over appended explanation.
  const lead = title.split(/\s+[—–|｜]\s+|[：:；;\n]/)[0].trim();
  if (lead && lead.length >= 3) title = lead;
  let label = '', used = 0;
  for (const character of title) {
    const width = /[\u0000-\u007f]/.test(character) ? 1 : 2;
    if (used + width > budget) break;
    label += character; used += width;
  }
  if (label.length < title.length) {
    if (/\s/.test(label) && /[a-z]$/i.test(label) && /^[a-z]/i.test(title.slice(label.length)))
      label = label.replace(/\s+\S*$/, '');
    return label.trimEnd() + '…';
  }
  return label || '未命名';
}

// Perspective is based on camera-space depth, so orbit and zoom affect labels alike.
export function labelDetail({ depth, radius, height, fov = 48, priority = false }) {
  if (!(depth > 0) || !(height > 0)) return { visible: false, fontSize: 0, opacity: 0 };
  const pixels = radius * height / (2 * depth * Math.tan(fov * Math.PI / 360));
  if (priority) return { visible: true, fontSize: 12, opacity: 1 };
  const fontSize = Math.min(12, pixels * 4);
  return { visible: fontSize >= 8.5, fontSize: Math.max(8.5, fontSize), opacity: Math.min(0.88, Math.max(0, (fontSize - 7) / 5)) };
}

export function labelLimits(width, height) {
  const area = Math.max(0, width * height);
  return { nodes: Math.max(3, Math.min(18, Math.floor(area / 45000))), reasons: Math.max(1, Math.min(5, Math.floor(area / 180000))) };
}
