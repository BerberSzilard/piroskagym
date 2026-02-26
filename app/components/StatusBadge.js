export default function StatusBadge({ status }) {
  const normalizedStatus = (status === "canceled" ? "cancelled" : status) || "active";

  const paletteByStatus = {
    active: {
      background: "#eaf8ee",
      border: "#b9e8c6",
      color: "#1d6f3a",
    },
    expired: {
      background: "#f5f5f7",
      border: "#d9d9df",
      color: "#555",
    },
    cancelled: {
      background: "#fff1f1",
      border: "#f2c3c3",
      color: "#a13737",
    },
  };

  const palette = paletteByStatus[normalizedStatus] || paletteByStatus.expired;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        textTransform: "capitalize",
      }}
    >
      {normalizedStatus}
    </span>
  );
}
