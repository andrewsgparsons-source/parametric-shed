// src/bom/index.js

export function renderBOM(sections) {
  const tbody = document.getElementById('bomTable');
  if (!tbody) return;

  const rows = Array.isArray(sections) ? sections : [];
  tbody.innerHTML = rows.map(r => {
    const item = r[0] ?? '';
    const qty = r[1] ?? '';
    const L = r[2] ?? '';
    const W = r[3] ?? '';
    const notes = r[4] ?? '';
    return `<tr>
      <td>${escapeHtml(String(item))}</td>
      <td>${escapeHtml(String(qty))}</td>
      <td>${escapeHtml(String(L))}</td>
      <td>${escapeHtml(String(W))}</td>
      <td>${escapeHtml(String(notes))}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5">None</td></tr>`;
}

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
