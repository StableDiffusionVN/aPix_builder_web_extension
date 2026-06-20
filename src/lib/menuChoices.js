/** Parse one menu choice: "Label:value" when labelSyntax is on, else plain. */
export function parseMenuChoice(choice, options = {}) {
  const raw = String(choice ?? "").trim();
  if (!raw) return null;
  if (options.labelSyntax !== true) {
    return { label: raw, value: raw, raw };
  }
  const colonIndex = raw.indexOf(":");
  if (colonIndex > 0) {
    const label = raw.slice(0, colonIndex).trim();
    const value = raw.slice(colonIndex + 1).trim();
    if (label && value) return { label, value, raw };
  }
  return { label: raw, value: raw, raw };
}

export function parseMenuChoices(choices = [], options = {}) {
  return (Array.isArray(choices) ? choices : [])
    .map(choice => parseMenuChoice(choice, options))
    .filter(Boolean);
}

export function menuChoiceOptions(source) {
  const labelSyntax = typeof source === "boolean"
    ? source
    : source?.menuLabelSyntax === true;
  return { labelSyntax };
}

export function resolveMenuStoredValue(storedValue, choices = [], options = {}) {
  const parsed = parseMenuChoices(choices, options);
  if (!parsed.length) return storedValue ?? "";
  if (storedValue == null || storedValue === "") return parsed[0].value;
  if (parsed.some(item => item.value === storedValue)) return storedValue;
  const byRaw = parsed.find(item => item.raw === storedValue);
  if (byRaw) return byRaw.value;
  const byLabel = parsed.find(item => item.label === storedValue);
  if (byLabel) return byLabel.value;
  return storedValue;
}

export function choiceOptionsFromField(field, choices = field?.ui?.choices || field?.choices || []) {
  return parseMenuChoices(choices, menuChoiceOptions(field?.ui));
}
