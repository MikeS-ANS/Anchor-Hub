const { app, shell } = require('electron');
const path = require('path');
const fetch = require('node-fetch');
const keytar = require('keytar');
const { SERVICE_NAME, getMainWindow } = require('../shared/state');
const { getPax8Token, pax8Paginate } = require('../shared/pax8');

const PARTIAL_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+Partial:/i;

let invoiceAuditAbortFlag = false;
let lastInvoiceExportData = null; // stored server-side so no large IPC payload

async function pax8FetchInvoiceItems(token, invoiceId) {
  const items = [];
  let page = 0;
  while (true) {
    const r = await fetch(`https://api.pax8.com/v1/invoices/${invoiceId}/items?page=${page}&size=200`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = r.ok ? await r.json() : {};
    const batch = d.content || d.data || d.items || [];
    items.push(...batch);
    const totalPages = d.totalPages ?? d.page?.totalPages ?? (d.totalElements != null ? Math.ceil(d.totalElements / 200) : null);
    if (!batch.length || page + 1 >= (totalPages ?? 1)) break;
    page++;
  }
  return items;
}

async function callClaude(apiKey, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

function detectChanges(currentItems, prevData) {
  const changes = [];

  const currentBySku = {};
  for (const item of currentItems) {
    const sku = item.sku || item.description;
    if (sku) currentBySku[sku] = item;
  }

  const prevBySku = {};
  for (const { items } of prevData) {
    for (const item of items) {
      const sku = item.sku || item.description;
      if (sku && !prevBySku[sku]) prevBySku[sku] = item;
    }
  }

  for (const [sku, item] of Object.entries(currentBySku)) {
    const prev = prevBySku[sku];
    const desc = item.description || sku;
    if (!prev) {
      changes.push({ type: 'NEW', sku, description: desc, currentQty: item.quantity, prevQty: null, currentPrice: item.price, prevPrice: null, currentCost: item.cost_total ?? item.total ?? null });
      continue;
    }
    const qtyDelta = item.quantity - prev.quantity;
    const qtyPct   = prev.quantity ? Math.abs(qtyDelta / prev.quantity * 100) : 0;
    if (qtyPct >= 20) {
      changes.push({ type: 'QTY_CHANGE', sku, description: desc, currentQty: item.quantity, prevQty: prev.quantity, qtyDelta, qtyPct, currentPrice: item.price, prevPrice: prev.price, currentCost: item.cost_total ?? item.total ?? null });
    }
    const priceDelta = (item.price ?? 0) - (prev.price ?? 0);
    if (Math.abs(priceDelta) > 0.01) {
      changes.push({ type: 'PRICE_CHANGE', sku, description: desc, currentQty: item.quantity, prevQty: prev.quantity, currentPrice: item.price, prevPrice: prev.price, priceDelta, currentCost: item.cost_total ?? item.total ?? null });
    }
  }

  for (const [sku, prev] of Object.entries(prevBySku)) {
    if (!currentBySku[sku]) {
      changes.push({ type: 'REMOVED', sku, description: prev.description || sku, currentQty: null, prevQty: prev.quantity, currentPrice: null, prevPrice: prev.price, currentCost: null });
    }
  }

  return changes;
}

function changeToString(c) {
  switch (c.type) {
    case 'NEW':           return `NEW: ${c.description} (qty: ${c.currentQty}, cost: $${c.currentCost ?? '?'})`;
    case 'QTY_CHANGE':    return `QTY CHANGE: ${c.description} — ${c.prevQty} → ${c.currentQty} (${c.qtyDelta > 0 ? '+' : ''}${c.qtyDelta}, ${c.qtyPct?.toFixed(0)}%)`;
    case 'PRICE_CHANGE':  return `PRICE CHANGE: ${c.description} — $${c.prevPrice} → $${c.currentPrice}`;
    case 'REMOVED':       return `REMOVED: ${c.description} (was qty: ${c.prevQty})`;
    case 'NEW_CLIENT':    return `NEW CLIENT — first appearance on this invoice`;
    case 'CLIENT_REMOVED':return `CLIENT REMOVED — had charges before but absent from current invoice`;
    default: return c.description || '';
  }
}

function buildInvoiceChangesPrompt(invoice, companyChanges) {
  const lines = companyChanges.map(c =>
    `${c.company}:\n${c.changes.map(ch => `  - ${changeToString(ch)}`).join('\n')}`
  ).join('\n\n');

  return `You are a billing analyst reviewing an MSP's monthly Pax8 invoice.

Invoice ${invoice.id}, dated ${invoice.invoiceDate}, Total: $${invoice.total ?? invoice.totalAmount}

Changes detected vs. prior months:

${lines}

Write a concise plain-text executive summary (4-6 sentences) of the most significant billing changes. Do NOT use markdown, bold, asterisks, or headers — plain sentences only. Call out anything that looks like a potential error or needs immediate attention. Be specific about company names and dollar amounts. End with a recommended action if warranted.`;
}

function buildInvoicePrompt(companyName, invoice, lineItems, history) {
  const date   = invoice.invoiceDate || invoice.date || 'Unknown';
  const total  = invoice.totalAmount ?? invoice.total ?? 'Unknown';

  const itemsText = lineItems.length
    ? lineItems.map(i => {
        const name  = i.productName || i.name || i.description || 'Unknown';
        const qty   = i.quantity != null ? ` | Qty: ${i.quantity}` : '';
        const price = i.unitPrice != null ? ` | Unit: $${i.unitPrice}` : '';
        const tot   = i.totalAmount != null ? ` | Total: $${i.totalAmount}` : '';
        return `  - ${name}${qty}${price}${tot}`;
      }).join('\n')
    : '  (No line items available)';

  const histText = history.length
    ? history.map(inv => {
        const d = inv.invoiceDate || inv.date || '?';
        const t = inv.totalAmount ?? inv.total ?? '?';
        return `  - ${d}: $${t}`;
      }).join('\n')
    : '  (No history available)';

  return `You are a billing analyst reviewing MSP client invoices. Analyze this Pax8 invoice for "${companyName}".

CURRENT INVOICE:
Date: ${date}  |  Invoice ID: ${invoice.id}  |  Total: $${total}

LINE ITEMS:
${itemsText}

INVOICE HISTORY (${history.length} previous invoices):
${histText}

Look for anomalies such as:
- New charges not seen in prior invoices
- Quantity increases or decreases greater than 20%
- Price changes on existing products
- Missing recurring charges that appeared before
- Unusually large total amount change vs. trend

If everything looks normal respond ONLY with: NO_ANOMALY
If anomalies are found, respond with a concise bullet list (max 5 items). Be specific — name the product and the change.`;
}

module.exports = function registerInvoiceMonitor(ipcMain) {
  ipcMain.handle('abort-invoice-audit', () => { invoiceAuditAbortFlag = true; return true; });

  ipcMain.handle('run-invoice-audit', async (event, { companyFilter = '', compareCount = 1 } = {}) => {
    invoiceAuditAbortFlag = false;
    const send = (msg, type = 'info') => getMainWindow().webContents.send('invoice-log', { msg, type });
    const results = { analyzed: 0, anomalies: [], clean: 0, errors: [], invoiceId: null, invoiceDate: null, invoiceTotal: null, aiSummary: null };

    try {
      const claudeKey = await keytar.getPassword(SERVICE_NAME, 'claude_api_key');
      if (!claudeKey) throw new Error('Claude API key not configured. Please add it in Settings.');

      send('Authenticating with Pax8...');
      const token = await getPax8Token();
      send('✓ Pax8 token obtained', 'success');

      // Fetch all partner invoices, sort newest first
      send('Fetching partner invoices...');
      const allInvoices = await pax8Paginate(token, '/invoices');
      allInvoices.sort((a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0));
      if (!allInvoices.length) throw new Error('No invoices found.');
      send(`✓ ${allInvoices.length} invoices found — loading ${compareCount + 1} months`, 'success');

      // Fetch line items for current + compareCount previous invoices
      const toFetch = allInvoices.slice(0, compareCount + 1);
      const itemsMap = {};
      for (const inv of toFetch) {
        if (invoiceAuditAbortFlag) break;
        send(`  Loading ${inv.invoiceDate || inv.id}...`);
        try {
          itemsMap[inv.id] = await pax8FetchInvoiceItems(token, inv.id);
          send(`    ✓ ${itemsMap[inv.id].length} line items`, 'success');
        } catch (e) { itemsMap[inv.id] = []; }
      }

      const currentInv   = toFetch[0];
      const currentItems = itemsMap[currentInv.id] || [];
      const prevInvoices = toFetch.slice(1);

      results.invoiceId    = currentInv.id;
      results.invoiceDate  = currentInv.invoiceDate;
      results.invoiceTotal = currentInv.total ?? currentInv.totalAmount;

      send('────────────────────────────', 'divider');
      send(`Current invoice: ${currentInv.id} (${currentInv.invoiceDate}) — $${results.invoiceTotal}`);

      const isInvoiceProrate = i => PARTIAL_RE.test(i.description || '')
        || (i.type || i.chargeType || '').toLowerCase() === 'prorate'
        || /\(Canceled\)\s*prorated/i.test(i.description || '');

      // Separate partial/prorate items (they change every month by design)
      const partialItems   = currentItems.filter(i => isInvoiceProrate(i));
      const regularItems   = currentItems.filter(i => !isInvoiceProrate(i));

      // Group current (regular) items by company
      const currentByCompany = {};
      for (const item of regularItems) {
        const cid   = String(item.company_id || item.companyId || 'unknown');
        const cname = item.company_name || item.companyName || cid;
        if (!currentByCompany[cid]) currentByCompany[cid] = { name: cname, items: [] };
        currentByCompany[cid].items.push(item);
      }

      // Group previous items by company
      const prevByCompany = {};
      for (const inv of prevInvoices) {
        for (const item of (itemsMap[inv.id] || [])) {
          const cid = String(item.company_id || item.companyId || 'unknown');
          if (!prevByCompany[cid]) prevByCompany[cid] = [];
          prevByCompany[cid].push({ ...item, _invoiceDate: inv.invoiceDate });
        }
      }

      const allPrevIds = new Set(Object.keys(prevByCompany));
      const companyChanges = [];
      const filter = companyFilter.trim().toLowerCase();

      // Check each company in current invoice
      for (const [cid, { name: cname, items: currItems }] of Object.entries(currentByCompany)) {
        if (filter && !cname.toLowerCase().includes(filter)) continue;
        results.analyzed++;

        const prevItems = prevByCompany[cid] || [];
        const prevData  = prevItems.length ? [{ items: prevItems }] : [];
        const changes = prevData.length
          ? detectChanges(currItems, prevData)
          : [{ type: 'NEW_CLIENT', description: 'First appearance on invoice' }];

        if (changes.length) {
          companyChanges.push({ company: cname, changes });
          send(`  ⚠ ${cname}: ${changes.length} change${changes.length > 1 ? 's' : ''}`, 'warn');
        } else {
          results.clean++;
        }
      }

      // Clients that were on previous invoices but not current
      for (const cid of allPrevIds) {
        if (!currentByCompany[cid]) {
          const sample = prevByCompany[cid]?.[0];
          const cname  = sample?.company_name || sample?.companyName || cid;
          if (filter && !cname.toLowerCase().includes(filter)) continue;
          companyChanges.push({ company: cname, changes: [{ type: 'CLIENT_REMOVED', description: cname }] });
          send(`  ⚠ ${cname}: removed from invoice`, 'warn');
        }
      }

      results.anomalies     = companyChanges;
      results.currentItems  = regularItems;
      results.partialItems  = partialItems;
      lastInvoiceExportData = results;

      if (!companyChanges.length) {
        send('✓ No billing changes detected vs. prior invoices', 'success');
      } else {
        send(`Sending ${companyChanges.length} changes to Claude for analysis...`);
        try {
          results.aiSummary = await callClaude(claudeKey, buildInvoiceChangesPrompt(currentInv, companyChanges));
          send('✓ AI analysis complete', 'success');
        } catch (e) {
          send(`⚠ AI analysis failed: ${e.message}`, 'warn');
          results.aiSummary = null;
        }
      }

      send('────────────────────────────', 'divider');
      send(`Companies on invoice: ${results.analyzed}`);
      send(`Companies with changes: ${companyChanges.length}`, companyChanges.length ? 'warn' : 'success');

      return { success: true, results };
    } catch (err) {
      send(`Fatal: ${err.message}`, 'error');
      return { success: false, error: err.message, results };
    }
  });

  ipcMain.handle('print-report', async () => {
    const results = lastInvoiceExportData;
    if (!results) return { error: 'No audit data — run the invoice monitor first.' };
    try {
    const ExcelJS = require('exceljs');
    const filePath = path.join(app.getPath('downloads'), `pax8-invoice-report-${results.invoiceDate || new Date().toISOString().slice(0,10)}.xlsx`);

    const wb  = new ExcelJS.Workbook();
    wb.creator = 'Pax8 Hub';

    const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    const WARN_FILL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
    const NEW_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
    const DEL_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const BOLD        = { bold: true };

    function addHeaderRow(ws, cols) {
      const row = ws.addRow(cols.map(c => c.header));
      row.eachCell(cell => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; cell.alignment = { vertical: 'middle' }; });
      row.height = 20;
      cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.width || 20; });
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    }

    // ── Tab 1: Summary ───────────────────────────────────────────────
    const wsSummary = wb.addWorksheet('Summary');
    wsSummary.getColumn(1).width = 28;
    wsSummary.getColumn(2).width = 60;

    const titleRow = wsSummary.addRow(['Pax8 Invoice Analysis Report']);
    titleRow.getCell(1).font = { bold: true, size: 16 };
    wsSummary.mergeCells('A1:B1');
    wsSummary.addRow([]);
    wsSummary.addRow(['Invoice ID',    results.invoiceId]);
    wsSummary.addRow(['Invoice Date',  results.invoiceDate]);
    wsSummary.addRow(['Invoice Total', results.invoiceTotal != null ? Number(results.invoiceTotal) : '']);
    wsSummary.getRow(5).getCell(2).numFmt = '$#,##0.00';
    wsSummary.addRow(['Run Date',      new Date().toLocaleString()]);
    wsSummary.addRow([]);
    wsSummary.addRow(['Companies on Invoice', results.analyzed]);
    wsSummary.addRow(['Unchanged',            results.clean]);
    wsSummary.addRow(['With Changes',         results.anomalies.length]);
    [3,4,5,6,8,9,10].forEach(r => { wsSummary.getRow(r).getCell(1).font = BOLD; });
    wsSummary.addRow([]);
    wsSummary.addRow(['AI Summary']);
    wsSummary.getRow(12).getCell(1).font = BOLD;
    if (results.aiSummary) {
      const aiRow = wsSummary.addRow(['', results.aiSummary]);
      aiRow.getCell(2).alignment = { wrapText: true };
      aiRow.height = 120;
      wsSummary.mergeCells(`B13:B13`);
    }

    // ── Tab 2: All Changes ───────────────────────────────────────────
    const wsChanges = wb.addWorksheet('Changes');
    addHeaderRow(wsChanges, [
      { header: 'Company',        width: 36 },
      { header: 'Change Type',    width: 16 },
      { header: 'Product',        width: 52 },
      { header: 'SKU',            width: 22 },
      { header: 'Prev Qty',       width: 12 },
      { header: 'Current Qty',    width: 12 },
      { header: 'Qty Change %',   width: 14 },
      { header: 'Prev Unit Price',width: 16 },
      { header: 'Curr Unit Price',width: 16 },
      { header: 'Current Cost',   width: 16 },
    ]);
    const typeFill = { NEW: NEW_FILL, NEW_CLIENT: NEW_FILL, REMOVED: DEL_FILL, CLIENT_REMOVED: DEL_FILL, QTY_CHANGE: WARN_FILL, PRICE_CHANGE: WARN_FILL };
    for (const a of results.anomalies) {
      for (const c of a.changes) {
        const row = wsChanges.addRow([
          a.company,
          c.type.replace(/_/g, ' '),
          c.description,
          c.sku || '',
          c.prevQty ?? '',
          c.currentQty ?? '',
          c.qtyPct != null ? c.qtyPct / 100 : '',
          c.prevPrice != null ? Number(c.prevPrice) : '',
          c.currentPrice != null ? Number(c.currentPrice) : '',
          c.currentCost != null ? Number(c.currentCost) : '',
        ]);
        const fill = typeFill[c.type];
        if (fill) row.eachCell(cell => { cell.fill = fill; });
        if (c.qtyPct != null) row.getCell(7).numFmt = '0.0%';
        [8,9,10].forEach(n => { if (row.getCell(n).value) row.getCell(n).numFmt = '$#,##0.00'; });
      }
    }

    // ── Tab 3: Current Invoice ───────────────────────────────────────
    const wsInvoice = wb.addWorksheet('Current Invoice');
    addHeaderRow(wsInvoice, [
      { header: 'Company',    width: 36 },
      { header: 'SKU',        width: 22 },
      { header: 'Product',    width: 52 },
      { header: 'Qty',        width: 10 },
      { header: 'Unit Price', width: 14 },
      { header: 'Cost Total', width: 14 },
      { header: 'Period Start',width: 14 },
      { header: 'Period End',  width: 14 },
    ]);
    for (const item of (results.currentItems || [])) {
      const row = wsInvoice.addRow([
        item.company_name || item.companyName || '',
        item.sku || '',
        item.description || '',
        item.quantity != null ? Number(item.quantity) : '',
        item.price    != null ? Number(item.price)    : '',
        item.cost != null ? Number(item.cost) * Math.max(Number(item.quantity || 1), 1) : (item.cost_total != null ? Number(item.cost_total) : (item.total != null ? Number(item.total) : '')),
        item.start_period || '',
        item.end_period   || '',
      ]);
      [5,6].forEach(n => { if (row.getCell(n).value) row.getCell(n).numFmt = '$#,##0.00'; });
    }

    // ── Tab 4: New Items ─────────────────────────────────────────────
    const wsNew = wb.addWorksheet('New Items');
    addHeaderRow(wsNew, [
      { header: 'Company',    width: 36 },
      { header: 'Product',    width: 52 },
      { header: 'SKU',        width: 22 },
      { header: 'Qty',        width: 10 },
      { header: 'Unit Price', width: 14 },
      { header: 'Cost Total', width: 14 },
    ]);
    for (const a of results.anomalies) {
      for (const c of a.changes.filter(x => x.type === 'NEW' || x.type === 'NEW_CLIENT')) {
        const row = wsNew.addRow([a.company, c.description, c.sku || '', c.currentQty ?? '', c.currentPrice != null ? Number(c.currentPrice) : '', c.currentCost != null ? Number(c.currentCost) : '']);
        row.eachCell(cell => { cell.fill = NEW_FILL; });
        [5,6].forEach(n => { if (row.getCell(n).value) row.getCell(n).numFmt = '$#,##0.00'; });
      }
    }

    // ── Tab 5: Removed Items ─────────────────────────────────────────
    const wsRemoved = wb.addWorksheet('Removed Items');
    addHeaderRow(wsRemoved, [
      { header: 'Company',    width: 36 },
      { header: 'Product',    width: 52 },
      { header: 'SKU',        width: 22 },
      { header: 'Prev Qty',   width: 12 },
      { header: 'Prev Price', width: 14 },
    ]);
    for (const a of results.anomalies) {
      for (const c of a.changes.filter(x => x.type === 'REMOVED' || x.type === 'CLIENT_REMOVED')) {
        const row = wsRemoved.addRow([a.company, c.description, c.sku || '', c.prevQty ?? '', c.prevPrice != null ? Number(c.prevPrice) : '']);
        row.eachCell(cell => { cell.fill = DEL_FILL; });
        if (row.getCell(5).value) row.getCell(5).numFmt = '$#,##0.00';
      }
    }

    // ── Tab 6: Partial Charges ───────────────────────────────────────
    const wsPartial = wb.addWorksheet('Partial Charges');
    addHeaderRow(wsPartial, [
      { header: 'Company',     width: 36 },
      { header: 'Product',     width: 52 },
      { header: 'SKU',         width: 22 },
      { header: 'Qty',         width: 10 },
      { header: 'Unit Price',  width: 14 },
      { header: 'Cost Total',  width: 14 },
    ]);
    const PARTIAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
    for (const item of (results.partialItems || [])) {
      const row = wsPartial.addRow([
        item.company_name || item.companyName || '',
        item.description || '',
        item.sku || '',
        item.quantity != null ? Number(item.quantity) : '',
        item.price     != null ? Number(item.price)    : '',
        item.cost != null ? Number(item.cost) * Math.max(Number(item.quantity || 1), 1) : (item.cost_total != null ? Number(item.cost_total) : (item.total != null ? Number(item.total) : '')),
      ]);
      row.eachCell(cell => { cell.fill = PARTIAL_FILL; });
      [5,6].forEach(n => { if (row.getCell(n).value) row.getCell(n).numFmt = '$#,##0.00'; });
    }

    await wb.xlsx.writeFile(filePath);
    shell.openPath(filePath);
    return { success: true };
    } catch (err) {
      console.error('Excel export error:', err);
      return { success: false, error: err.message };
    }
  });
};

module.exports.pax8FetchInvoiceItems = pax8FetchInvoiceItems;
module.exports.PARTIAL_RE = PARTIAL_RE;
