import { CheckCircle2, Eye, EyeOff, MonitorCog, Server, X } from "lucide-react";
import { useState } from "react";
import { t } from "../lib/i18n";

export function SettingsPanel({ open, settings, onChange, onSave, onTestComfy, onClose }) {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  if (!open) return null;

  async function test() {
    setTesting(true);
    setTestMessage("");
    try {
      await onTestComfy();
      setTestMessage(t("settings.comfyConnected"));
    } catch (error) {
      setTestMessage(error.message || t("settings.comfyConnectFailed"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-header"><h2 id="settings-title">{t("settings.title")}</h2><button className="square-button" onClick={onClose} aria-label={t("settings.closeAria")}><X size={18} /></button></div>
        <p>{t("settings.intro")}</p>
        <label className="field">
          <span>{t("settings.appearance")}</span>
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
          <span>ComfyUI URL</span>
          <div className="input-action-row">
            <Server size={16} />
            <input value={settings.comfyUrl} onChange={event => onChange({ ...settings, comfyUrl: event.target.value })} placeholder={t("settings.comfyPlaceholder")} />
            <button onClick={test} disabled={testing}>{testing ? t("common.testing") : t("common.test")}</button>
          </div>
        </label>
        {testMessage && <div className="connection-result">{testMessage}</div>}
        <label className="field">
          <span>RunningHub API Key</span>
          <div className="input-action-row">
            <textarea
              rows={3}
              style={{ WebkitTextSecurity: showKey ? "none" : "disc", resize: "vertical", minHeight: 60, width: "100%", fontFamily: "inherit" }}
              value={settings.runningHubApiKey}
              onChange={event => onChange({ ...settings, runningHubApiKey: event.target.value })}
              placeholder={t("settings.keyPlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="reveal-button" onClick={() => setShowKey(value => !value)} aria-label={showKey ? t("settings.hideKey") : t("settings.showKey")}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          <span className="field-hint" style={{ fontSize: 12, opacity: 0.7 }}>{t("settings.failoverNote")}</span>
        </label>
        <div className="settings-note"><CheckCircle2 size={15} /> {t("settings.securityNote")}</div>
        <button className="primary-button" onClick={onSave}>{t("settings.save")}</button>
      </aside>
    </div>
  );
}
