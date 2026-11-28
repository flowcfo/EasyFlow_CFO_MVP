/**
 * Microsoft Graph connection to the "EasyFlow Clients" SharePoint site.
 *
 * Excel is the master: each client has their own copy of the Profit System
 * workbook in this site. The portal writes inputs into the workbook and reads the
 * recalculated results back through the Graph Excel API, so the workbook's own
 * formulas do all the math.
 *
 * Auth: app-only (client credentials) for the "EasyFlow Client Portal" Entra app,
 * which has the Sites.Selected permission and a write grant on this one site.
 *
 * Env: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET,
 *      SHAREPOINT_HOST (default livingwaterconsulting221.sharepoint.com),
 *      SHAREPOINT_SITE_PATH (default /sites/EasyFlowClients),
 *      SHAREPOINT_TEMPLATE_FOLDER (default _Template)
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';

function config() {
  return {
    tenant: process.env.MS_TENANT_ID,
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
    host: process.env.SHAREPOINT_HOST || 'livingwaterconsulting221.sharepoint.com',
    sitePath: process.env.SHAREPOINT_SITE_PATH || '/sites/EasyFlowClients',
    templateFolder: process.env.SHAREPOINT_TEMPLATE_FOLDER || '_Template',
  };
}

export function isConfigured() {
  const c = config();
  return Boolean(c.tenant && c.clientId && c.clientSecret);
}

export class GraphError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'GraphError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ---------- token (cached per warm function instance) ----------
let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;
  const c = config();
  if (!isConfigured()) throw new GraphError('Microsoft connection is not configured (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET).', 500, 'not_configured');
  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GraphError(`Microsoft sign-in failed: ${data.error_description || data.error || res.status}`, res.status, data.error || 'token_failed');
  }
  tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

async function graph(method, path, { body, headers = {}, raw = false } = {}) {
  const token = await getToken();
  const url = path.startsWith('http') ? path : `${GRAPH}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = data?.error || {};
    throw new GraphError(err.message || `Graph ${method} ${path} failed (${res.status})`, res.status, err.code, err);
  }
  return data;
}

// ---------- site, drive, template ----------
let siteCache = null;

export async function getSiteAndDrive() {
  if (siteCache) return siteCache;
  const c = config();
  const site = await graph('GET', `/sites/${c.host}:${c.sitePath}?$select=id,name,webUrl`);
  const drive = await graph('GET', `/sites/${site.id}/drive?$select=id,name,webUrl`);
  siteCache = { siteId: site.id, siteName: site.name, siteUrl: site.webUrl, driveId: drive.id };
  return siteCache;
}

export async function findTemplate() {
  const { driveId } = await getSiteAndDrive();
  const folder = encodeURIComponent(config().templateFolder);
  const list = await graph('GET', `/drives/${driveId}/root:/${folder}:/children?$select=id,name,webUrl,file,size,lastModifiedDateTime`);
  const workbook = (list.value || []).find((i) => i.file && /\.xlsx$/i.test(i.name));
  if (!workbook) throw new GraphError(`No .xlsx workbook found in the ${config().templateFolder} folder.`, 404, 'template_missing');
  return workbook;
}

function safeName(s) {
  return String(s || '').replace(/["*:<>?/\\|#%]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Client';
}

export async function ensureFolder(name) {
  const { driveId } = await getSiteAndDrive();
  try {
    return await graph('GET', `/drives/${driveId}/root:/${encodeURIComponent(name)}?$select=id,name,webUrl,folder`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  return graph('POST', `/drives/${driveId}/root/children`, {
    body: { name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' },
  });
}

/**
 * Copy the master template into a folder for one client.
 * Graph copies run asynchronously; we poll the monitor URL until it finishes.
 */
export async function copyTemplateTo(folderName, fileName) {
  const { driveId } = await getSiteAndDrive();
  const template = await findTemplate();
  const folder = await ensureFolder(safeName(folderName));
  const name = `${safeName(fileName)}.xlsx`;

  const res = await graph('POST', `/drives/${driveId}/items/${template.id}/copy?@microsoft.graph.conflictBehavior=rename`, {
    body: { parentReference: { driveId, id: folder.id }, name },
    raw: true,
  });
  if (res.status !== 202) {
    const data = await res.json().catch(() => ({}));
    throw new GraphError(data?.error?.message || `Copy failed (${res.status})`, res.status, data?.error?.code);
  }
  const monitor = res.headers.get('location');
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 700));
    const m = await fetch(monitor); // monitor URLs are pre-authorized; no token
    const status = await m.json().catch(() => ({}));
    if (status.status === 'completed' && status.resourceId) {
      const item = await graph('GET', `/drives/${driveId}/items/${status.resourceId}?$select=id,name,webUrl`);
      return { driveId, folderId: folder.id, folderUrl: folder.webUrl, itemId: item.id, name: item.name, webUrl: item.webUrl };
    }
    if (status.status === 'failed') throw new GraphError('Copying the template failed.', 500, 'copy_failed', status);
  }
  throw new GraphError('Copying the template is taking too long. Try again in a minute.', 504, 'copy_timeout');
}

// ---------- workbook (Excel) ----------
function itemPath(driveId, itemId) {
  return `/drives/${driveId}/items/${itemId}/workbook`;
}

function quoteSheet(sheet) {
  return `'${String(sheet).replace(/'/g, "''")}'`;
}

/** Open a session so a batch of writes recalculates once and is saved together. */
export async function openSession(driveId, itemId, { persist = true } = {}) {
  const s = await graph('POST', `${itemPath(driveId, itemId)}/createSession`, { body: { persistChanges: persist } });
  return s.id;
}

export async function closeSession(driveId, itemId, sessionId) {
  if (!sessionId) return;
  try {
    await graph('POST', `${itemPath(driveId, itemId)}/closeSession`, { body: {}, headers: { 'workbook-session-id': sessionId } });
  } catch {
    // Sessions also expire on their own.
  }
}

/** values: 2D array, e.g. [[123]] for one cell. */
export async function writeRange(driveId, itemId, sheet, address, values, sessionId) {
  return graph('PATCH', `${itemPath(driveId, itemId)}/worksheets(${encodeURIComponent(quoteSheet(sheet))})/range(address='${address}')`, {
    body: { values },
    headers: sessionId ? { 'workbook-session-id': sessionId } : {},
  });
}

/** Returns { address, values, text } after the workbook recalculates. */
export async function readRange(driveId, itemId, sheet, address, sessionId) {
  return graph('GET', `${itemPath(driveId, itemId)}/worksheets(${encodeURIComponent(quoteSheet(sheet))})/range(address='${address}')?$select=address,values,text`, {
    headers: sessionId ? { 'workbook-session-id': sessionId } : {},
  });
}

export async function deleteItem(driveId, itemId) {
  return graph('DELETE', `/drives/${driveId}/items/${itemId}`);
}

/** Quick health check for the CFO view: can we sign in, see the site, find the template? */
export async function connectionStatus() {
  const out = { configured: isConfigured(), signedIn: false, site: null, template: null, error: null };
  if (!out.configured) return out;
  try {
    await getToken();
    out.signedIn = true;
    const site = await getSiteAndDrive();
    out.site = { name: site.siteName, url: site.siteUrl };
    const t = await findTemplate();
    out.template = { name: t.name, url: t.webUrl, modified: t.lastModifiedDateTime };
  } catch (err) {
    out.error = { message: err.message, status: err.status, code: err.code };
  }
  return out;
}
