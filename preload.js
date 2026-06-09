const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),

  // Credentials
  saveCred:    (key, value) => ipcRenderer.invoke('creds-save', key, value),
  getCred:     (key)        => ipcRenderer.invoke('creds-get', key),
  deleteCred:  (key)        => ipcRenderer.invoke('creds-delete', key),
  checkCreds:  ()           => ipcRenderer.invoke('creds-check'),

  // Integrations
  runSubscriptionAudit: (opts) => ipcRenderer.invoke('run-subscription-audit', opts),
  abortAudit:           () => ipcRenderer.invoke('abort-audit'),
  fetchPax8Companies:   () => ipcRenderer.invoke('fetch-pax8-companies'),
  detectAtZone:         () => ipcRenderer.invoke('detect-at-zone'),

  // CSV mappings & export
  getCsvStatus:         () => ipcRenderer.invoke('get-csv-status'),
  openCsvFolder:        () => ipcRenderer.invoke('open-csv-folder'),
  exportDiscrepancies:  (d) => ipcRenderer.invoke('export-discrepancies', d),

  // Invoice Monitor
  runInvoiceAudit:   (opts) => ipcRenderer.invoke('run-invoice-audit', opts),
  abortInvoiceAudit: ()     => ipcRenderer.invoke('abort-invoice-audit'),
  printReport:       ()     => ipcRenderer.invoke('print-report'),

  // Margin Analyzer
  runMarginAnalysis:  (opts) => ipcRenderer.invoke('run-margin-analysis', opts),
  abortMarginAnalysis: ()   => ipcRenderer.invoke('abort-margin-analysis'),
  exportMarginReport:  ()   => ipcRenderer.invoke('export-margin-report'),
  getMarginSettings:   ()   => ipcRenderer.invoke('get-margin-settings'),
  saveMarginSettings:  (s)  => ipcRenderer.invoke('save-margin-settings', s),

  // Company Mapping
  runMappingSync:       ()        => ipcRenderer.invoke('run-company-mapping-sync'),
  getMappings:          ()        => ipcRenderer.invoke('get-mappings'),
  saveMappings:         (data)    => ipcRenderer.invoke('save-mappings', data),
  exportMappingCsv:     ()        => ipcRenderer.invoke('export-mapping-csv'),
  exportFullMappingCsv: ()        => ipcRenderer.invoke('export-full-mapping-csv'),
  importMappingCsv:     (type)    => ipcRenderer.invoke('import-mapping-csv', type),
  setCompanyExcluded:   (d)       => ipcRenderer.invoke('set-company-excluded', d),
  acceptCompanyMatch:   (d)       => ipcRenderer.invoke('accept-company-match', d),

  // Kaseya Invoice Processor
  browseKaseyaXls:        ()     => ipcRenderer.invoke('browse-kaseya-xls'),
  processKaseyaXls:       (opts) => ipcRenderer.invoke('process-kaseya-xls', opts),
  getKaseyaSettings:      ()     => ipcRenderer.invoke('get-kaseya-settings'),
  saveKaseyaSettings:     (s)    => ipcRenderer.invoke('save-kaseya-settings', s),
  exportKaseyaReport:     (data) => ipcRenderer.invoke('export-kaseya-report', data),
  generateKaseyaAtPrompt:  (data) => ipcRenderer.invoke('generate-kaseya-at-prompt', data),
  getKaseyaSnapshots:      ()     => ipcRenderer.invoke('get-kaseya-snapshots'),
  compareKaseyaSnapshots:  (opts) => ipcRenderer.invoke('compare-kaseya-snapshots', opts),
  deleteKaseyaSnapshot:    (key)  => ipcRenderer.invoke('delete-kaseya-snapshot', key),
  loadKaseyaSnapshot:      (key)  => ipcRenderer.invoke('load-kaseya-snapshot', key),

  // Invoice Processor
  browseInvoiceCsv:       ()     => ipcRenderer.invoke('browse-invoice-csv'),
  processInvoiceCsv:      (opts) => ipcRenderer.invoke('process-invoice-csv', opts),
  fetchPax8InvoiceList:   ()     => ipcRenderer.invoke('fetch-pax8-invoice-list'),
  processPax8Invoice:     (opts) => ipcRenderer.invoke('process-pax8-invoice', opts),
  exportInvoiceBreakdown: (data) => ipcRenderer.invoke('export-invoice-breakdown', data),
  generateAtPrompt:       (data) => ipcRenderer.invoke('generate-at-prompt', data),
  generateServicePrompt:  (data) => ipcRenderer.invoke('generate-service-prompt', data),
  getPromptTemplates:    ()  => ipcRenderer.invoke('get-prompt-templates'),
  savePromptTemplates:   (t) => ipcRenderer.invoke('save-prompt-templates', t),

  // Contract Changes
  runContractChanges:         (opts) => ipcRenderer.invoke('run-contract-changes', opts),
  exportContractChangesExcel: (rows) => ipcRenderer.invoke('export-contract-changes-excel', rows),

  // Contract Renewals
  runContractRenewals:  (opts) => ipcRenderer.invoke('run-contract-renewals', opts),
  getRenewalSettings:   ()     => ipcRenderer.invoke('get-renewal-settings'),
  saveRenewalSettings:  (s)    => ipcRenderer.invoke('save-renewal-settings', s),

  // BlackPoint / CompassOne
  runBlackpointUsage:     ()     => ipcRenderer.invoke('run-blackpoint-usage'),
  exportBlackpointReport: (data) => ipcRenderer.invoke('export-blackpoint-report', data),

  // Tool Visibility
  getToolVisibility:  ()    => ipcRenderer.invoke('get-tool-visibility'),
  saveToolVisibility: (vis) => ipcRenderer.invoke('save-tool-visibility', vis),

  // Auto-updater
  restartAndInstall:  ()    => ipcRenderer.send('restart-and-install'),
  checkForUpdates:    ()    => ipcRenderer.invoke('check-for-updates'),
  getAppVersion:      ()    => ipcRenderer.invoke('get-app-version'),
  onUpdateDownloaded: (cb)  => {
    ipcRenderer.on('update-downloaded', (_, info) => cb(info));
    return () => ipcRenderer.removeAllListeners('update-downloaded');
  },

  // Event listeners
  onAuditLog: (cb) => {
    ipcRenderer.on('audit-log', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('audit-log');
  },
  onInvoiceLog: (cb) => {
    ipcRenderer.on('invoice-log', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('invoice-log');
  },
  onMarginLog: (cb) => {
    ipcRenderer.on('margin-log', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('margin-log');
  },
  onMappingLog: (cb) => {
    ipcRenderer.on('mapping-log', (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('mapping-log');
  }
});
