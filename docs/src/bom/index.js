// FILE: docs/src/bom/index.js
export function renderBOM(sections) {
  const tbody = document.getElementById('bomTable');
  if (!tbody) return;

  const rows = Array.isArray(sections) ? sections : [];
  tbody.innerHTML = rows.map(r => {
    const [item, qty, L_mm, W_mm, notes] = r;
    return `<tr>
      <td>${escapeHtml(item ?? '')}</td>
      <td>${escapeHtml(qty ?? '')}</td>
      <td>${escapeHtml(L_mm ?? '')}</td>
      <td>${escapeHtml(W_mm ?? '')}</td>
      <td>${escapeHtml(notes ?? '')}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5">None</td></tr>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```0
