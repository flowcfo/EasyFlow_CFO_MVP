import { SYSTEM_PROMPT_OWNER, SYSTEM_PROMPT_PARTNER_TEMPLATE, METHODOLOGY_BLOCK } from './systemPrompt.js';

export function buildSystemPrompt(userType, partnerBrandName) {
  if (userType === 'client' && partnerBrandName) {
    return SYSTEM_PROMPT_PARTNER_TEMPLATE.replace(/\[PARTNER_BRAND_NAME\]/g, partnerBrandName);
  }

  return SYSTEM_PROMPT_OWNER;
}

export function injectBrandIntoPrompt(basePrompt, userType, partnerBrandName) {
  if (userType === 'client' && partnerBrandName) {
    return basePrompt
      .replace(/Easy Numbers CFO/g, partnerBrandName)
      .replace(/EasyFlow CFO/g, partnerBrandName)
      .replace(/easyflowcfo\.com/g, `your ${partnerBrandName} advisor`);
  }
  return basePrompt;
}
