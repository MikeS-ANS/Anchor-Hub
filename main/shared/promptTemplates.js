const fs   = require('fs');
const path = require('path');
const { USER_DATA } = require('./state');

const PROMPT_TEMPLATES_FILE = path.join(USER_DATA, 'pax8hub-prompt-templates.json');

const DEFAULT_AZURE_PROMPT_HEADER =
`You are updating Autotask ContractService pricing records for Azure charges billed through Pax8.
Invoice Reference: {invoiceRef}
Effective Date: {effectiveDate}

Instructions:
For each company below:

Using the provided Autotask Company ID, query /Contracts/query with filters: companyID = [AT ID], contractName contains "Azure", status = 1. If multiple active Azure contracts exist for a company, select the one whose startDate is closest to and on or before {effectiveDate}.
Using the contract ID found, query /ContractServices/query with filter: contractID = [contract ID]. Find the service line where serviceID = {azureServiceId}. This is the Microsoft Azure - Program (pay-as-you-go consumption) line.
PATCH that ContractService record: set unitCost to the Pax8 Cost value and unitPrice to the Client Price value below. Do not modify any other service lines on the contract.
After each update, confirm the company name, ContractService record ID, new unitCost, and new unitPrice.

Do not create new contracts or service lines. Do not modify any service line other than serviceID {azureServiceId}.

Companies to update:`;

const DEFAULT_SERVICE_PROMPT_HEADER =
`You are updating Autotask ContractServiceUnit quantity records for services billed through Pax8.
Invoice Reference: {{INVOICE_ID}} dated {{INVOICE_DATE}}
Billing Period: {{BILLING_MONTH_START}} through {{BILLING_MONTH_END}}

Instructions:
For each company and service below:

Using the Autotask Company ID, locate the correct contract using the service lookup rules defined below. If the service line is not found in the preferred contract, search all other active contracts (status = 1) for that company before giving up.
Using the contract ID, query /ContractServices/query filtering by contractID and serviceID to find the correct service line.
Query /ContractServiceUnits/query filtering by contractServiceID and startDate = {{BILLING_MONTH_START}} to find the current month's unit record.
PATCH that ContractServiceUnit record to update only the units field to the new quantity. Do not modify unitCost, unitPrice, or any other field.
After each update, confirm: company name, service name, ContractServiceUnit record ID, and new unit count.

If a service line is not found in any active contract for a company, do not skip it silently. Instead, pause and ask the user: "No [service name] service line was found for [company name] in any active contract. Would you like me to create it? If yes, please confirm which contract it should be added to and provide the unitCost and unitPrice." Wait for a response before continuing to the next company.
If a ContractServiceUnit record for {{BILLING_MONTH_START}} does not exist on an otherwise valid service line, report it as an exception and ask the user how to proceed before continuing.
Do not create new contracts. Do not create new service lines or unit records unless explicitly confirmed by the user per the prompt above.
Note: Anchor Network Solutions is Anchor's internal account. Skip all Anchor Network Solutions entries silently without prompting.

Service lookup rules:
NERDIO → serviceID: 159 ("Azure Virtual Desktop License")
Preferred contract: contractName contains "Azure", status = 1
If multiple active Azure contracts exist, select the one with startDate closest to and on or before {{BILLING_MONTH_START}}.
If not found there, search all other active contracts for this company.

EXCLAIMER → serviceID: 262 ("Cloud Email Signature Management") OR 288 ("Cloud Email Signature Management - Pro - Monthly")
Preferred contract: contractName contains "Managed Cloud", status = 1
Try serviceID 262 first; if not found try serviceID 288.
If neither is found in the Managed Cloud contract, search all other active contracts for this company using both serviceIDs.

IRONSCALES → serviceID: 275 ("Advance Email Protect")
Preferred contract: contractName contains "Managed Cloud", status = 1
If not found there, search all other active contracts for this company.

PRINTIX → serviceID: 266 ("Cloud Print Management")
Preferred contract: contractName contains "Managed Cloud", status = 1
If not found there, search all other active contracts for this company.

Companies and quantities:`;

const DEFAULT_KASEYA_PROMPT_HEADER =
`You are updating Autotask ContractService records for services billed through Kaseya.
Invoice Reference: {invoiceRef}
Billing Period: {billingStart} through {billingEnd}

[Configure this prompt template in Settings → Kaseya Settings]

Services and quantities to update:`;

function loadPromptTemplates() {
  if (!fs.existsSync(PROMPT_TEMPLATES_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(PROMPT_TEMPLATES_FILE, 'utf8')); }
  catch { return {}; }
}

// Date helpers — parse string directly to avoid UTC/local timezone shifts
function firstOfNextMonth(dateStr) {
  if (!dateStr) {
    const n = new Date();
    const nm = n.getMonth() + 2 > 12 ? 1 : n.getMonth() + 2;
    const ny = n.getMonth() + 2 > 12 ? n.getFullYear() + 1 : n.getFullYear();
    return `${ny}-${String(nm).padStart(2, '0')}-01`;
  }
  const parts = dateStr.split('-').map(Number);
  const yr = parts[0], mo = parts[1];
  const nm = mo === 12 ? 1 : mo + 1;
  const ny = mo === 12 ? yr + 1 : yr;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

function firstOfCurrentMonth(dateStr) {
  if (!dateStr) {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
  }
  const parts = dateStr.split('-').map(Number);
  return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-01`;
}

function lastOfCurrentMonth(dateStr) {
  if (!dateStr) {
    const n = new Date();
    const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }
  const parts = dateStr.split('-').map(Number);
  const yr = parts[0], mo = parts[1];
  const last = new Date(yr, mo, 0).getDate();
  return `${yr}-${String(mo).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

module.exports = {
  PROMPT_TEMPLATES_FILE,
  DEFAULT_AZURE_PROMPT_HEADER,
  DEFAULT_SERVICE_PROMPT_HEADER,
  DEFAULT_KASEYA_PROMPT_HEADER,
  loadPromptTemplates,
  firstOfNextMonth, firstOfCurrentMonth, lastOfCurrentMonth,
};
