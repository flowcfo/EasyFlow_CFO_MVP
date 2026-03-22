/**
 * Node.js bridge to the Python template writer.
 *
 * Spawns a Python process, sends JSON on stdin,
 * reads JSON result from stdout.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_SCRIPT = path.join(__dirname, 'fill_template_cli.py');

const DEFAULT_TEMPLATE = path.join(
  'C:', 'Users', 'nmarc', 'EasyFlowCFO', 'templates', 'EasyFlow_CFO_P_L_Input.xlsx'
);

/**
 * Run the Python template CLI with a JSON payload.
 * @param {object} payload - JSON payload for the Python script
 * @returns {Promise<object>} - parsed JSON response
 */
function runPython(payload) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [CLI_SCRIPT], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Template writer exited with code ${code}: ${stderr || stdout}`));
      }
      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) return reject(new Error(result.error));
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse template writer output: ${stdout}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

/**
 * Map QBO accounts and write to the P&L template.
 *
 * @param {object} options
 * @param {Array} options.accounts - [{name, section, monthly: {'2024-01': 5000, ...}}]
 * @param {string} [options.templatePath] - path to template xlsx
 * @param {string} [options.outputPath] - path for output xlsx
 * @param {boolean} [options.overwriteExisting] - overwrite existing values
 * @param {string} [options.businessType] - for owner pay split default
 * @param {object} [options.ownerPayMonthly] - {'2024-01': 8000, ...}
 * @param {number} [options.directLaborPct] - 0.0 to 1.0
 * @returns {Promise<object>} write summary
 */
export async function mapAndWriteToTemplate({
  accounts,
  templatePath = DEFAULT_TEMPLATE,
  outputPath,
  overwriteExisting = false,
  businessType = 'unknown',
  ownerPayMonthly = {},
  directLaborPct,
}) {
  return runPython({
    action: 'map_and_write',
    accounts,
    template_path: templatePath,
    output_path: outputPath,
    overwrite_existing: overwriteExisting,
    business_type: businessType,
    owner_pay_monthly: ownerPayMonthly,
    direct_labor_pct: directLaborPct,
  });
}

/**
 * Write pre-mapped data directly to the template.
 *
 * @param {Array} mappedData - [{row, col_index, value}]
 * @param {object} [options]
 * @returns {Promise<object>} write summary
 */
export async function writeToTemplate(mappedData, {
  templatePath = DEFAULT_TEMPLATE,
  outputPath,
  overwriteExisting = false,
} = {}) {
  return runPython({
    action: 'write',
    mapped_data: mappedData,
    template_path: templatePath,
    output_path: outputPath,
    overwrite_existing: overwriteExisting,
  });
}

/**
 * Fix known issues in the template without writing data.
 * @param {string} [templatePath]
 * @returns {Promise<object>}
 */
export async function fixTemplate(templatePath = DEFAULT_TEMPLATE) {
  return runPython({
    action: 'fix_only',
    template_path: templatePath,
  });
}

/**
 * Map QBO account names to template rows (dry run, no writing).
 * @param {Array} accounts - [{name, section}]
 * @returns {Promise<object>}
 */
export async function mapAccountsToRows(accounts) {
  return runPython({
    action: 'map_accounts',
    accounts,
  });
}

/**
 * Convert QBO P&L report accounts to the format needed by mapAndWriteToTemplate.
 * Takes the parsed QBO accounts (from ruleMapper's parseQBOReport) and the
 * Easy Numbers mapped values, and structures them for the template writer.
 *
 * @param {object} easyNumbersInputs - the finalized Easy Numbers input shape
 * @param {Array} qboAccounts - parsed QBO accounts with monthly breakdowns
 * @param {object} options - {templatePath, outputPath, businessType, ...}
 * @returns {Promise<object>}
 */
export async function writeEasyNumbersToTemplate(easyNumbersInputs, options = {}) {
  const {
    templatePath = DEFAULT_TEMPLATE,
    outputPath,
    overwriteExisting = false,
    businessType = 'unknown',
    directLaborPct,
    months = [],
  } = options;

  const mappedData = [];

  // Field to row mapping for the Easy Numbers inputs
  const FIELD_TO_ROW = {
    revenue: 11,
    cogs: 17,
    employee_direct_labor: 30,
    subcontractors: 15,
    marketing: 45,
    rent: 62,
    insurance: 86,
    software_subscriptions: 89,
    other_opex: 94,
  };

  if (months.length === 0) {
    // Single annual value — write to most recent 12 months (Jan-Dec 2025)
    for (let m = 1; m <= 12; m++) {
      const year = 2025;
      const ci = ((year - 2023) * 12) + (m - 1) + 1;
      for (const [field, row] of Object.entries(FIELD_TO_ROW)) {
        const annual = easyNumbersInputs[field] || 0;
        const monthly = Math.round(annual / 12);
        if (monthly > 0) {
          mappedData.push({ row, col_index: ci, value: monthly });
        }
      }
    }
  } else {
    for (const monthData of months) {
      const [year, month] = monthData.period.split('-').map(Number);
      const ci = ((year - 2023) * 12) + (month - 1) + 1;
      if (ci < 1 || ci > 48) continue;
      for (const [field, row] of Object.entries(FIELD_TO_ROW)) {
        const value = monthData[field] || 0;
        if (value > 0) {
          mappedData.push({ row, col_index: ci, value });
        }
      }
    }
  }

  // Owner pay split
  const ownerPay = easyNumbersInputs.owner_pay_detected || 0;
  if (ownerPay > 0) {
    const pct = directLaborPct || 0.50;
    const directLabor = Math.floor(ownerPay * pct);
    const mgmt = ownerPay - directLabor;
    const monthlyDirect = Math.round(directLabor / 12);
    const monthlyMgmt = Math.round(mgmt / 12);

    for (let m = 1; m <= 12; m++) {
      const year = 2025;
      const ci = ((year - 2023) * 12) + (m - 1) + 1;
      mappedData.push({ row: 29, col_index: ci, value: monthlyDirect });
      mappedData.push({ row: 70, col_index: ci, value: monthlyMgmt });
    }
  }

  return writeToTemplate(mappedData, {
    templatePath,
    outputPath,
    overwriteExisting,
  });
}
