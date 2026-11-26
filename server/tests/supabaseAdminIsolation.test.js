// Guards against the admin client picking up a user's session.
// If a password sign-in ever runs on supabaseAdmin again, its later queries would
// carry that user's token (row-level security applies, data leaks across requests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

test('admin queries keep the service key after a user signs in', async () => {
  const seen = [];
  const srv = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      seen.push({ url: req.url, auth: req.headers.authorization || '' });
      res.setHeader('content-type', 'application/json');
      if (req.url.startsWith('/auth/v1/token')) {
        res.end(JSON.stringify({
          access_token: 'USER.JWT.TOKEN', token_type: 'bearer', expires_in: 3600,
          expires_at: 9999999999, refresh_token: 'r',
          user: { id: 'u1', aud: 'authenticated', email: 'a@b.c' },
        }));
      } else {
        res.end('[]');
      }
    });
  });
  await new Promise((r) => srv.listen(0, r));
  const { port } = srv.address();

  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'SERVICE_KEY';
  process.env.SUPABASE_ANON_KEY = 'ANON_KEY';
  const { supabaseAdmin, supabaseSignInClient } = await import(`../db/supabase.js?isolation=${port}`);

  await supabaseSignInClient().auth.signInWithPassword({ email: 'a@b.c', password: 'x' });
  await supabaseAdmin.from('users').select('*');
  srv.close();

  const adminQuery = seen.find((s) => s.url.startsWith('/rest/v1/users'));
  assert.ok(adminQuery, 'admin query reached the server');
  assert.equal(adminQuery.auth, 'Bearer SERVICE_KEY');
});
