import { CheckCircle2, Eye, EyeOff, Globe, KeyRound, LoaderCircle, MonitorCog, Plus, Server, Trash2, Wifi, X } from "lucide-react";
import { useState } from "react";
import { t } from "../lib/i18n";

// Tách chuỗi key thành danh sách (đồng bộ parseRhApiKeys ở services/runningHub.js) —
// LƯU lại vẫn là chuỗi nối "\n" để failover hiện có dùng nguyên vẹn.
function splitKeys(raw) {
  return String(raw || "").split(/[\n,]+/).map(key => key.trim()).filter(Boolean);
}

function maskKey(key) {
  const trimmed = String(key).trim();
  if (trimmed.length <= 4) return "•".repeat(8);
  return `${"•".repeat(10)}${trimmed.slice(-4)}`;
}

// URL rút gọn hiển thị: che user:pass nếu có.
function maskServerUrl(url) {
  return String(url).replace(/\/\/[^@/]+@/, "//");
}

export function SettingsPanel({ open, settings, onChange, onSave, onTestComfy, onClose }) {
  const [revealedKeys, setRevealedKeys] = useState(() => new Set());
  const [newServer, setNewServer] = useState("");
  const [newKey, setNewKey] = useState("");
  const [testingUrl, setTestingUrl] = useState("");
  const [testResult, setTestResult] = useState(null); // { url, ok, message }
  if (!open) return null;

  // Tương thích cũ: chưa có mảng comfyServers thì suy từ comfyUrl.
  const servers = Array.isArray(settings.comfyServers) && settings.comfyServers.length
    ? settings.comfyServers
    : (settings.comfyUrl ? [settings.comfyUrl] : []);
  const keys = splitKeys(settings.runningHubApiKey);

  function updateServers(nextServers, nextActive) {
    onChange({
      ...settings,
      comfyServers: nextServers,
      // Code chạy hiện dùng settings.comfyUrl — server active ghi vào đây, KHÔNG đổi field.
      comfyUrl: nextActive !== undefined ? nextActive : settings.comfyUrl
    });
  }

  function addServer() {
    const url = newServer.trim();
    if (!url || servers.includes(url)) return;
    updateServers([...servers, url], settings.comfyUrl || url);
    setNewServer("");
  }

  function removeServer(url) {
    const nextServers = servers.filter(server => server !== url);
    updateServers(nextServers, settings.comfyUrl === url ? (nextServers[0] || "") : undefined);
  }

  async function testServer(url) {
    setTestingUrl(url);
    setTestResult(null);
    try {
      await onTestComfy(url);
      setTestResult({ url, ok: true, message: t("settings.comfyConnected") });
    } catch (error) {
      setTestResult({ url, ok: false, message: error.message || t("settings.comfyConnectFailed") });
    } finally {
      setTestingUrl("");
    }
  }

  function updateKeys(nextKeys) {
    onChange({ ...settings, runningHubApiKey: nextKeys.join("\n") });
  }

  function addKey() {
    const added = splitKeys(newKey).filter(key => !keys.includes(key));
    if (!added.length) return;
    updateKeys([...keys, ...added]);
    setNewKey("");
  }

  function toggleReveal(index) {
    setRevealedKeys(current => {
      const next = new Set(current);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-header"><h2 id="settings-title">{t("settings.title")}</h2><button className="square-button" onClick={onClose} aria-label={t("settings.closeAria")}><X size={18} /></button></div>
        <p>{t("settings.intro")}</p>

        <div className="settings-section">
          <h3 className="settings-section-title"><MonitorCog size={13} /> {t("settings.appearance")}</h3>
          <label className="field">
            <span>{t("settings.themeLabel")}</span>
            <div className="input-action-row">
              <MonitorCog size={16} />
              <select value={settings.theme || "system"} onChange={event => onChange({ ...settings, theme: event.target.value })}>
                <option value="system">{t("settings.theme.system")}</option>
                <option value="dark">{t("settings.theme.dark")}</option>
                <option value="light">{t("settings.theme.light")}</option>
              </select>
            </div>
          </label>
          <label className="field">
            <span>{t("settings.language")}</span>
            <div className="input-action-row">
              <Globe size={16} />
              <select value={settings.language || "auto"} onChange={event => onChange({ ...settings, language: event.target.value })}>
                <option value="auto">{t("settings.language.auto")}</option>
                <option value="vi">{t("settings.language.vi")}</option>
                <option value="en">{t("settings.language.en")}</option>
              </select>
            </div>
          </label>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title"><Server size={13} /> {t("settings.comfyServers")}</h3>
          {servers.length ? (
            <div className="settings-item-list">
              {servers.map(url => (
                <div key={url} className={`settings-item-row${settings.comfyUrl === url ? " is-active" : ""}`}>
                  <input
                    type="radio"
                    name="comfy-active-server"
                    checked={settings.comfyUrl === url}
                    onChange={() => updateServers(servers, url)}
                    aria-label={t("settings.selectServer")}
                    title={t("settings.selectServer")}
                  />
                  <span className="settings-item-text" title={maskServerUrl(url)}>{maskServerUrl(url)}</span>
                  <button
                    type="button"
                    className="settings-icon-button"
                    onClick={() => testServer(url)}
                    disabled={Boolean(testingUrl)}
                    aria-label={t("common.test")}
                    title={t("common.test")}
                  >
                    {testingUrl === url ? <LoaderCircle className="spin" size={14} /> : <Wifi size={14} />}
                  </button>
                  <button
                    type="button"
                    className="settings-icon-button danger-text"
                    onClick={() => removeServer(url)}
                    aria-label={t("common.delete")}
                    title={t("common.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="settings-empty">{t("settings.noServers")}</div>
          )}
          {testResult ? (
            <div className={`connection-result ${testResult.ok ? "is-ok" : "is-fail"}`}>
              {maskServerUrl(testResult.url)} — {testResult.message}
            </div>
          ) : null}
          <div className="settings-add-row">
            <input
              value={newServer}
              onChange={event => setNewServer(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addServer(); } }}
              placeholder={t("settings.comfyPlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" onClick={addServer} disabled={!newServer.trim()}>
              <Plus size={14} /> {t("settings.addServer")}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title"><KeyRound size={13} /> {t("settings.rhKeys")}</h3>
          {keys.length ? (
            <div className="settings-item-list">
              {keys.map((key, index) => (
                <div key={`${index}-${key.slice(-4)}`} className="settings-item-row">
                  <span className="settings-item-index">#{index + 1}</span>
                  <span className="settings-item-text settings-key-text" title={revealedKeys.has(index) ? key : undefined}>
                    {revealedKeys.has(index) ? key : maskKey(key)}
                  </span>
                  <button
                    type="button"
                    className="settings-icon-button"
                    onClick={() => toggleReveal(index)}
                    aria-label={revealedKeys.has(index) ? t("settings.hideKey") : t("settings.showKey")}
                    title={revealedKeys.has(index) ? t("settings.hideKey") : t("settings.showKey")}
                  >
                    {revealedKeys.has(index) ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    className="settings-icon-button danger-text"
                    onClick={() => updateKeys(keys.filter((_, keyIndex) => keyIndex !== index))}
                    aria-label={t("common.delete")}
                    title={t("common.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="settings-empty">{t("settings.noKeys")}</div>
          )}
          <div className="settings-add-row">
            <input
              value={newKey}
              onChange={event => setNewKey(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addKey(); } }}
              placeholder={t("settings.keyPlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" onClick={addKey} disabled={!newKey.trim()}>
              <Plus size={14} /> {t("settings.addKey")}
            </button>
          </div>
          <span className="settings-hint">{t("settings.failoverNote")}</span>
        </div>

        <div className="settings-note"><CheckCircle2 size={15} /> {t("settings.securityNote")}</div>
        <button className="primary-button" onClick={onSave}>{t("settings.save")}</button>
      </aside>
    </div>
  );
}
