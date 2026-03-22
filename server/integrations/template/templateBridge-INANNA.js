/**
 * Optional bridge to external P&amp;L template tooling (e.g. Python). Not required for core API.
 */
export async function fixTemplate(templatePath) {
  return { ok: false, error: 'Template fix is not available in this build', templatePath };
}

export async function mapAccountsToRows(accounts) {
  return { rows: [], accounts: accounts || [] };
}

export async function writeEasyNumbersToTemplate(_inputs, _opts) {
  return { ok: false, error: 'Template writer is not available in this build' };
}
