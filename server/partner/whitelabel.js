import { supabaseAdmin } from '../db/supabase.js';

export async function getWhiteLabelConfig(partnerId) {
  const { data, error } = await supabaseAdmin
    .from('partners')
    .select('brand_name, logo_url, primary_color')
    .eq('id', partnerId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateWhiteLabelConfig(partnerId, updates) {
  const allowedFields = ['brand_name', 'logo_url', 'primary_color'];
  const sanitized = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      sanitized[key] = updates[key];
    }
  }

  const { data, error } = await supabaseAdmin
    .from('partners')
    .update(sanitized)
    .eq('id', partnerId)
    .select('brand_name, logo_url, primary_color')
    .single();

  if (error) throw error;
  return data;
}

export async function uploadPartnerLogo(partnerId, fileBuffer, filename, contentType) {
  const path = `partner-logos/${partnerId}/${filename}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from('assets')
    .upload(path, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (uploadErr) throw uploadErr;

  const { data: urlData } = supabaseAdmin.storage
    .from('assets')
    .getPublicUrl(path);

  const logo_url = urlData.publicUrl;

  await supabaseAdmin
    .from('partners')
    .update({ logo_url })
    .eq('id', partnerId);

  return logo_url;
}

export function getClientBrandConfig(partner) {
  return {
    brand_name: partner.brand_name,
    logo_url: partner.logo_url,
    primary_color: partner.primary_color || '#F05001',
    is_white_labeled: true,
  };
}
