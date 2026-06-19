function displayChoice(choice, field) {
  const value = typeof choice === "object" ? choice.value ?? choice.label ?? choice.name : choice;
  const text = String(value ?? "");
  return field.ui.menuLabelSyntax && text.includes(":") ? text.split(":")[0] : text;
}

export function DynamicFields({ fields, values, onChange, loading }) {
  const visible = fields.filter(field => !["image", "image_mask", "file"].includes(field.ui.type));
  if (!loading && !visible.length) return null;
  return (
    <section className="tool-section configure-section" aria-labelledby="configure-title">
      <h2 id="configure-title">Thiết lập</h2>
      {loading && <div className="inline-status">Đang tải trường dữ liệu từ RunningHub…</div>}
      <div className="field-stack">
        {visible.map(field => {
          const type = field.ui.type;
          const choices = field.ui.choices || field.choices || [];
          if (["menu", "menu-sub", "dropdown", "checkpoints", "loras"].includes(type) && choices.length) {
            return (
              <label className="field" key={field.key}>
                <span>{field.ui.label || field.key}</span>
                <select value={values[field.key] ?? ""} onChange={event => onChange(field.key, event.target.value)}>
                  {choices.map(choice => {
                    const value = typeof choice === "object" ? choice.value ?? choice.label ?? choice.name : choice;
                    return <option key={String(value)} value={String(value)}>{displayChoice(choice, field)}</option>;
                  })}
                </select>
              </label>
            );
          }
          if (["int", "float", "slider"].includes(type) && field.ui.display === "slider") {
            return (
              <label className="field range-field" key={field.key}>
                <span>{field.ui.label || field.key}<output>{values[field.key]}</output></span>
                <input type="range" min={field.ui.minimum ?? 0} max={field.ui.maximum ?? 1} step={field.ui.step ?? 0.1} value={values[field.key] ?? field.ui.value ?? 0} onChange={event => onChange(field.key, Number(event.target.value))} />
              </label>
            );
          }
          if (type === "text") {
            return (
              <label className="field" key={field.key}>
                <span>{field.ui.label || field.key}</span>
                <textarea rows={3} value={values[field.key] ?? ""} placeholder="Mô tả thay đổi bạn muốn…" onChange={event => onChange(field.key, event.target.value)} />
              </label>
            );
          }
          return (
            <label className="field" key={field.key}>
              <span>{field.ui.label || field.key}</span>
              <input
                type={["int", "float"].includes(type) ? "number" : "text"}
                min={field.ui.minimum}
                max={field.ui.maximum}
                step={field.ui.step}
                value={values[field.key] ?? ""}
                onChange={event => onChange(field.key, event.target.type === "number" ? Number(event.target.value) : event.target.value)}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
