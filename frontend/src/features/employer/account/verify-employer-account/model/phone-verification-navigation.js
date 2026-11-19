export function getPasswordSetupFromPhoneUrl(passwordSettingsUrl, phoneVerificationUrl) {
  const params = new URLSearchParams({ returnUrl: phoneVerificationUrl })
  return `${passwordSettingsUrl}?${params}`
}
