const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === "") {
    return { value: null };
  }
  if (typeof value !== "string") {
    return { error: `${field} must be a string` };
  }

  const normalized = value.trim();
  if (!normalized) return { value: null };
  if (normalized.length > maxLength) {
    return { error: `${field} must be ${maxLength} characters or less` };
  }
  return { value: normalized };
}

export function isExpoPushToken(value) {
  return typeof value === "string"
    && value.length >= 20
    && value.length <= 512
    && EXPO_PUSH_TOKEN_PATTERN.test(value);
}

export function normalizePushDeviceId(value) {
  if (typeof value !== "string") {
    return { error: "deviceId is required" };
  }

  const deviceId = value.trim();
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    return {
      error: "deviceId must be 8-128 characters using letters, numbers, dots, colons, underscores, or hyphens",
    };
  }

  return { value: deviceId };
}

export function normalizePushDeviceRegistration(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const token = typeof source.token === "string" ? source.token.trim() : "";
  if (!isExpoPushToken(token)) {
    return { error: "A valid Expo push token is required" };
  }

  const platform = typeof source.platform === "string" ? source.platform.trim().toLowerCase() : "";
  if (!["ios", "android"].includes(platform)) {
    return { error: "platform must be ios or android" };
  }

  const deviceId = normalizePushDeviceId(source.deviceId);
  if (deviceId.error) return deviceId;

  const deviceName = optionalText(source.deviceName, "deviceName", 120);
  if (deviceName.error) return deviceName;

  const appVersion = optionalText(source.appVersion, "appVersion", 50);
  if (appVersion.error) return appVersion;

  return {
    value: {
      token,
      platform,
      deviceId: deviceId.value,
      deviceName: deviceName.value,
      appVersion: appVersion.value,
    },
  };
}
